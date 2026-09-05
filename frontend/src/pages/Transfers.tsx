import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, Loader2, CheckCircle2, Sparkles, ArrowLeftRight } from 'lucide-react'
import { api, getApiError } from '@/api/client'
import { useTransfers, useWarehouses } from '@/api/queries'
import { useToast } from '@/store/toast'
import { formatQty, formatDate, todayIso } from '@/lib/format'
import Modal from '@/components/Modal'
import AddProductBar from '@/components/AddProductBar'
import WarehouseTabs from '@/components/WarehouseTabs'
import type { ProductSearchResult, Transfer, TransferSuggestion } from '@/api/types'
import { Card, EmptyState, SkeletonList, SkeletonRows, fieldClass } from '@/components/ui'

interface DraftLine {
  productId: string
  productName: string
  quantity: number
}

const STATUS_LABELS: Record<string, string> = { draft: 'Черновик', posted: 'Проведён', cancelled: 'Отменён' }
const STATUS_CLS: Record<string, string> = {
  draft: 'bg-gray-100 dark:bg-gray-800 text-fg-muted',
  posted: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300',
  cancelled: 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300',
}

export default function Transfers() {
  const { data: transfers, isLoading } = useTransfers()
  const { data: warehouses } = useWarehouses()
  const { push } = useToast()
  const qc = useQueryClient()

  const mainWh = warehouses?.find((w) => w.kind === 'main')
  const shopWh = warehouses?.find((w) => w.is_sellable)

  const [createOpen, setCreateOpen] = useState(false)
  const [date, setDate] = useState(todayIso())
  const [fromId, setFromId] = useState('')
  const [toId, setToId] = useState('')
  const [comment, setComment] = useState('')
  const [lines, setLines] = useState<DraftLine[]>([])
  const [saving, setSaving] = useState(false)
  const [suggesting, setSuggesting] = useState(false)

  const [confirmDoc, setConfirmDoc] = useState<Transfer | null>(null)
  const [posting, setPosting] = useState(false)

  function openCreate() {
    setDate(todayIso())
    setFromId(mainWh?.id ?? warehouses?.[0]?.id ?? '')
    setToId(shopWh?.id ?? warehouses?.[1]?.id ?? '')
    setComment('')
    setLines([])
    setCreateOpen(true)
  }

  function addLine(p: ProductSearchResult) {
    if (lines.some((l) => l.productId === p.id)) return
    setLines((prev) => [...prev, { productId: p.id, productName: p.name, quantity: 1 }])
  }

  function updateQty(id: string, qty: number) {
    setLines((prev) => prev.map((l) => (l.productId === id ? { ...l, quantity: qty } : l)))
  }

  function removeLine(id: string) {
    setLines((prev) => prev.filter((l) => l.productId !== id))
  }

  async function fillDeficit() {
    setSuggesting(true)
    try {
      const { data } = await api.get<TransferSuggestion[]>('/transfers/suggest/')
      if (data.length === 0) {
        push('Дефицита не найдено — витрина укомплектована', 'info')
        return
      }
      setLines(data.map((s) => ({ productId: s.product_id, productName: s.product_name, quantity: s.suggested_qty })))
      push(`Подобрано ${data.length} позиций для пополнения дефицита`, 'success')
    } catch (err) {
      push(getApiError(err).detail, 'error')
    } finally {
      setSuggesting(false)
    }
  }

  async function saveDraft() {
    if (!fromId || !toId || lines.length === 0) return
    if (fromId === toId) {
      push('Склад-источник и склад-приёмник должны отличаться', 'error')
      return
    }
    setSaving(true)
    try {
      await api.post('/transfers/', {
        date,
        from_warehouse: fromId,
        to_warehouse: toId,
        comment,
        items: lines.map((l) => ({ product: l.productId, quantity: l.quantity })),
      })
      push('Перемещение сохранено как черновик', 'success')
      setCreateOpen(false)
      qc.invalidateQueries({ queryKey: ['transfers'] })
    } catch (err) {
      push(getApiError(err).detail, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function confirmPost() {
    if (!confirmDoc) return
    setPosting(true)
    try {
      await api.post(`/transfers/${confirmDoc.id}/post_document/`)
      push(`Перемещение ${confirmDoc.number} проведено`, 'success')
      setConfirmDoc(null)
      qc.invalidateQueries({ queryKey: ['transfers'] })
      qc.invalidateQueries({ queryKey: ['stock'] })
    } catch (err) {
      push(getApiError(err).detail, 'error')
    } finally {
      setPosting(false)
    }
  }

  return (
    <div className="space-y-4">
      <WarehouseTabs />
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-semibold text-fg">Перемещения</h1>
        <button onClick={openCreate} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 text-sm font-semibold text-white transition-transform hover:bg-gray-800 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white">
          <Plus size={16} /> Новое перемещение
        </button>
      </div>

      {/* На телефоне — карточки: в таблицу из шести колонок экран не помещается. */}
      <div className="md:hidden space-y-2">
        {isLoading && <SkeletonList rows={3} />}
        {transfers?.length === 0 && <Card padded={false}><EmptyState icon={<ArrowLeftRight size={20} />} title="Перемещений ещё нет" /></Card>}
        {transfers?.map((t) => (
          <div key={t.id} className="rounded-2xl border border-line bg-surface p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-medium text-fg">{t.number}</div>
                <div className="text-xs text-gray-400">{formatDate(t.date)} · {t.from_warehouse_name} → {t.to_warehouse_name} · позиций: {t.items.length}</div>
              </div>
              <span className={`text-xs rounded-full px-2 py-0.5 shrink-0 ${STATUS_CLS[t.status]}`}>{STATUS_LABELS[t.status]}</span>
            </div>
            {t.status === 'draft' && (
              <button
                onClick={() => setConfirmDoc(t)}
                className="mt-2 inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-emerald-50 px-3 text-xs font-semibold text-emerald-700 transition-transform hover:bg-emerald-100 active:scale-[0.98] dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-900/50 h-11 w-full text-sm"
              >
                Провести
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="hidden md:block rounded-2xl border border-line bg-surface overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface-muted text-fg-muted">
            <tr>
              <th className="text-left font-medium px-4 py-2.5">№</th>
              <th className="text-left font-medium px-2 py-2.5">Дата</th>
              <th className="text-left font-medium px-2 py-2.5">Откуда</th>
              <th className="text-left font-medium px-2 py-2.5">Куда</th>
              <th className="text-right font-medium px-2 py-2.5">Позиций</th>
              <th className="text-left font-medium px-2 py-2.5">Статус</th>
              <th className="text-right font-medium px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {isLoading && <SkeletonRows rows={4} cols={7} />}
            {transfers?.length === 0 && <tr><td colSpan={7} className="px-4 py-4"><EmptyState icon={<ArrowLeftRight size={20} />} title="Перемещений ещё нет" /></td></tr>}
            {transfers?.map((t) => (
              <tr key={t.id}>
                <td className="px-4 py-2.5 font-medium text-fg">{t.number}</td>
                <td className="px-2 py-2.5 text-gray-500">{formatDate(t.date)}</td>
                <td className="px-2 py-2.5 text-gray-500">{t.from_warehouse_name}</td>
                <td className="px-2 py-2.5 text-gray-500">{t.to_warehouse_name}</td>
                <td className="px-2 py-2.5 text-right tabular-nums">{t.items.length}</td>
                <td className="px-2 py-2.5"><span className={`text-xs rounded-full px-2 py-0.5 ${STATUS_CLS[t.status]}`}>{STATUS_LABELS[t.status]}</span></td>
                <td className="px-4 py-2.5 text-right">
                  {t.status === 'draft' && (
                    <button onClick={() => setConfirmDoc(t)} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-emerald-50 px-3 text-xs font-semibold text-emerald-700 transition-transform hover:bg-emerald-100 active:scale-[0.98] dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-900/50">Провести</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={createOpen} onClose={() => !saving && setCreateOpen(false)} title="Новое перемещение" width="max-w-2xl"
        footer={
          <>
            <button onClick={() => setCreateOpen(false)} disabled={saving} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold text-fg-muted transition-transform hover:bg-surface-muted hover:text-fg active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40">Отмена</button>
            <button onClick={saveDraft} disabled={saving || lines.length === 0} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 text-sm font-semibold text-white transition-transform hover:bg-gray-800 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white">
              {saving && <Loader2 className="animate-spin" size={14} />} Сохранить черновик
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-fg-muted">Дата</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`mt-1 ${fieldClass} h-11 md:h-10`} />
            </div>
            <div>
              <label className="text-xs font-medium text-fg-muted">Откуда</label>
              <select value={fromId} onChange={(e) => setFromId(e.target.value)} className={`mt-1 ${fieldClass} select-field h-11 md:h-10`}>
                {warehouses?.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-fg-muted">Куда</label>
              <select value={toId} onChange={(e) => setToId(e.target.value)} className={`mt-1 ${fieldClass} select-field h-11 md:h-10`}>
                {warehouses?.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
          </div>

          <button
            onClick={fillDeficit}
            disabled={suggesting}
            className="flex items-center gap-1.5 rounded-xl border border-dashed border-line-strong text-gray-600 dark:text-gray-300 px-3 py-2 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
          >
            {suggesting ? <Loader2 className="animate-spin" size={15} /> : <Sparkles size={15} />}
            Пополнить дефицит автоматически
          </button>

          <div>
            <AddProductBar onSelect={addLine} label="Добавить товар вручную" />
          </div>

          {lines.length > 0 && (
            <div className="rounded-xl border border-line overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-surface-muted text-fg-muted">
                  <tr>
                    <th className="text-left font-medium px-3 py-2">Товар</th>
                    <th className="text-right font-medium px-2 py-2 w-24">Кол-во</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {lines.map((l) => (
                    <tr key={l.productId}>
                      <td className="px-3 py-2 text-gray-800 dark:text-gray-200">{l.productName}</td>
                      <td className="px-2 py-2">
                        <input type="number" value={l.quantity} onChange={(e) => updateQty(l.productId, parseFloat(e.target.value) || 0)} className="w-full text-right bg-transparent outline-none tabular-nums" />
                      </td>
                      <td className="px-2 py-2">
                        <button onClick={() => removeLine(l.productId)} className="text-gray-300 hover:text-red-500"><Trash2 size={14} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Modal>

      <Modal open={!!confirmDoc} onClose={() => !posting && setConfirmDoc(null)} title="Провести перемещение?"
        footer={
          <>
            <button onClick={() => setConfirmDoc(null)} disabled={posting} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold text-fg-muted transition-transform hover:bg-surface-muted hover:text-fg active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40">Отмена</button>
            <button onClick={confirmPost} disabled={posting} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 text-sm font-semibold text-white transition-transform hover:bg-gray-800 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white">
              {posting ? <Loader2 className="animate-spin" size={14} /> : <CheckCircle2 size={14} />} Провести
            </button>
          </>
        }
      >
        {confirmDoc && (
          <div className="text-sm space-y-2">
            <p className="text-gray-600 dark:text-gray-300">
              {confirmDoc.from_warehouse_name} → {confirmDoc.to_warehouse_name}. Если товара недостаточно на складе-источнике, документ не проведётся.
            </p>
            <div className="space-y-1">
              {confirmDoc.items.map((i) => (
                <div key={i.product} className="flex justify-between text-gray-500">
                  <span>{i.product_name}</span>
                  <span className="tabular-nums">{formatQty(i.quantity)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Plus, Loader2, CheckCircle2, PackageMinus } from 'lucide-react'
import { api, getApiError } from '@/api/client'
import { useWarehouses, useWriteOffs } from '@/api/queries'
import { useToast } from '@/store/toast'
import { formatQty, formatDate, todayIso } from '@/lib/format'
import Modal from '@/components/Modal'
import AddProductBar from '@/components/AddProductBar'
import WarehouseTabs from '@/components/WarehouseTabs'
import type { ProductSearchResult, Warehouse, WriteOff } from '@/api/types'
import { Card, EmptyState, LineCard, LinesTotal, QtyField, SkeletonList, SkeletonRows, fieldClass, unitLabel } from '@/components/ui'

interface DraftLine {
  productId: string
  productName: string
  quantity: number
  unit?: string
  /** Остатки по складам — чтобы не списать больше, чем есть. */
  mainQty: number
  shopQty: number
}

/** Сколько этого товара числится на выбранном складе. */
function qtyAt(l: { mainQty: number; shopQty: number }, warehouse?: Warehouse) {
  if (!warehouse) return 0
  return warehouse.kind === 'main' ? l.mainQty : l.shopQty
}

const STATUS_LABELS: Record<string, string> = { draft: 'Черновик', posted: 'Проведено' }
const STATUS_CLS: Record<string, string> = {
  draft: 'bg-gray-100 dark:bg-gray-800 text-fg-muted',
  posted: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300',
}

export default function WriteOffs() {
  const { data: docs, isLoading } = useWriteOffs()
  const { data: warehouses } = useWarehouses()
  const { push } = useToast()
  const qc = useQueryClient()

  const [createOpen, setCreateOpen] = useState(false)
  const [date, setDate] = useState(todayIso())
  const [warehouseId, setWarehouseId] = useState('')
  const [reasonText, setReasonText] = useState('')
  const [lines, setLines] = useState<DraftLine[]>([])
  const [saving, setSaving] = useState(false)

  const [confirmDoc, setConfirmDoc] = useState<WriteOff | null>(null)
  const [posting, setPosting] = useState(false)

  function openCreate() {
    setDate(todayIso())
    setWarehouseId(warehouses?.[0]?.id ?? '')
    setReasonText('')
    setLines([])
    setCreateOpen(true)
  }

  function addLine(p: ProductSearchResult) {
    if (lines.some((l) => l.productId === p.id)) return
    setLines((prev) => [
      ...prev,
      { productId: p.id, productName: p.name, quantity: 1, unit: p.unit, mainQty: p.main_qty, shopQty: p.shop_qty },
    ])
  }

  function updateQty(id: string, qty: number) {
    setLines((prev) => prev.map((l) => (l.productId === id ? { ...l, quantity: qty } : l)))
  }

  function removeLine(id: string) {
    setLines((prev) => prev.filter((l) => l.productId !== id))
  }

  const totalQty = lines.reduce((s, l) => s + l.quantity, 0)
  const selectedWarehouse = warehouses?.find((w) => w.id === warehouseId)

  async function saveDraft() {
    if (!warehouseId || lines.length === 0) return
    setSaving(true)
    try {
      await api.post('/writeoffs/', {
        date,
        warehouse: warehouseId,
        reason_text: reasonText,
        items: lines.map((l) => ({ product: l.productId, quantity: l.quantity })),
      })
      push('Списание сохранено как черновик', 'success')
      setCreateOpen(false)
      qc.invalidateQueries({ queryKey: ['writeoffs'] })
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
      await api.post(`/writeoffs/${confirmDoc.id}/post_document/`)
      push(`Списание ${confirmDoc.number} проведено`, 'success')
      setConfirmDoc(null)
      qc.invalidateQueries({ queryKey: ['writeoffs'] })
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
        <h1 className="text-xl font-semibold text-fg">Списания</h1>
        <button onClick={openCreate} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 text-sm font-semibold text-white transition-transform hover:bg-gray-800 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white">
          <Plus size={16} /> Новое списание
        </button>
      </div>

      {/* На телефоне — карточки: в таблицу из шести колонок экран не помещается. */}
      <div className="md:hidden space-y-2">
        {isLoading && <SkeletonList rows={3} />}
        {docs?.length === 0 && <Card padded={false}><EmptyState icon={<PackageMinus size={20} />} title="Списаний ещё не было" /></Card>}
        {docs?.map((d) => (
          <div key={d.id} className="rounded-2xl border border-line bg-surface p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-medium text-fg">{d.number}</div>
                <div className="text-xs text-gray-400">{formatDate(d.date)} · {d.warehouse_name}{d.reason_text && ` · ${d.reason_text}`}</div>
              </div>
              <span className={`text-xs rounded-full px-2 py-0.5 shrink-0 ${STATUS_CLS[d.status]}`}>{STATUS_LABELS[d.status]}</span>
            </div>
            {d.status === 'draft' && (
              <button
                onClick={() => setConfirmDoc(d)}
                className="mt-2 inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-red-50 px-3 text-xs font-semibold text-red-700 transition-transform hover:bg-red-100 active:scale-[0.98] dark:bg-red-950/40 dark:text-red-300 dark:hover:bg-red-900/50 h-11 w-full text-sm"
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
              <th className="text-left font-medium px-2 py-2.5">Склад</th>
              <th className="text-left font-medium px-2 py-2.5">Причина</th>
              <th className="text-left font-medium px-2 py-2.5">Статус</th>
              <th className="text-right font-medium px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {isLoading && <SkeletonRows rows={4} cols={6} />}
            {docs?.length === 0 && <tr><td colSpan={6} className="px-4 py-4"><EmptyState icon={<PackageMinus size={20} />} title="Списаний ещё не было" /></td></tr>}
            {docs?.map((d) => (
              <tr key={d.id}>
                <td className="px-4 py-2.5 font-medium text-fg">{d.number}</td>
                <td className="px-2 py-2.5 text-gray-500">{formatDate(d.date)}</td>
                <td className="px-2 py-2.5 text-gray-500">{d.warehouse_name}</td>
                <td className="px-2 py-2.5 text-gray-500">{d.reason_text || '—'}</td>
                <td className="px-2 py-2.5"><span className={`text-xs rounded-full px-2 py-0.5 ${STATUS_CLS[d.status]}`}>{STATUS_LABELS[d.status]}</span></td>
                <td className="px-4 py-2.5 text-right">
                  {d.status === 'draft' && (
                    <button onClick={() => setConfirmDoc(d)} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-red-50 px-3 text-xs font-semibold text-red-700 transition-transform hover:bg-red-100 active:scale-[0.98] dark:bg-red-950/40 dark:text-red-300 dark:hover:bg-red-900/50">Провести</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={createOpen} onClose={() => !saving && setCreateOpen(false)} title="Новое списание" width="max-w-2xl"
        footer={
          <>
            <button onClick={() => setCreateOpen(false)} disabled={saving} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold text-fg-muted transition-transform hover:bg-surface-muted hover:text-fg active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40">Отмена</button>
            <button onClick={saveDraft} disabled={saving || lines.length === 0} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 text-sm font-semibold text-white transition-transform hover:bg-gray-800 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white">
              {saving && <Loader2 className="animate-spin" size={14} />} Сохранить черновик
            </button>
          </>
        }
      >
        <div className="space-y-5">
          <section>
            <h4 className="mb-2 text-xs font-semibold tracking-wide text-fg-muted uppercase">Документ</h4>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-fg-muted">Дата</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`mt-1 ${fieldClass} h-11 md:h-10`} />
            </div>
            <div>
              <label className="text-xs font-medium text-fg-muted">Склад</label>
              <select value={warehouseId} onChange={(e) => { setWarehouseId(e.target.value); setLines([]) }} className={`mt-1 ${fieldClass} select-field h-11 md:h-10`}>
                {warehouses?.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
          </div>
          <div className="mt-3">
            <label className="text-xs font-medium text-fg-muted">Причина</label>
            <input value={reasonText} onChange={(e) => setReasonText(e.target.value)} placeholder="Брак, порча, потеря…" className={`mt-1 ${fieldClass} h-11 md:h-10`} />
          </div>
          </section>

          <section className="space-y-3">
            <h4 className="text-xs font-semibold tracking-wide text-fg-muted uppercase">Товары {lines.length > 0 && <span className="text-fg-muted/70">· {lines.length}</span>}</h4>
            <AddProductBar onSelect={addLine} label="Добавить товар для списания" />

          {lines.length === 0 ? (
            <div className="rounded-xl border border-dashed border-line-strong px-4 py-8 text-center text-sm text-fg-muted">
              Товары не добавлены. Найдите товар выше — затем укажите, сколько штук списать.
            </div>
          ) : (
            <div className="space-y-2">
              {lines.map((l) => (
                <LineCard
                  key={l.productId}
                  title={l.productName}
                  onRemove={() => removeLine(l.productId)}
                >
                  <QtyField
                    label="Сколько списать"
                    value={l.quantity}
                    unit={l.unit}
                    onChange={(v) => updateQty(l.productId, v)}
                    tone={l.quantity > qtyAt(l, selectedWarehouse) ? 'warning' : undefined}
                    hint={
                      l.quantity > qtyAt(l, selectedWarehouse)
                        ? `На складе только ${formatQty(qtyAt(l, selectedWarehouse))} ${unitLabel(l.unit)}`
                        : `Числится на складе: ${formatQty(qtyAt(l, selectedWarehouse))} ${unitLabel(l.unit)}`
                    }
                  />
                </LineCard>
              ))}
              <LinesTotal
                items={[
                  { label: 'Позиций:', value: String(lines.length) },
                  { label: 'Единиц:', value: formatQty(totalQty), strong: true },
                ]}
              />
            </div>
          )}
          </section>
        </div>
      </Modal>

      <Modal open={!!confirmDoc} onClose={() => !posting && setConfirmDoc(null)} title="Провести списание?"
        footer={
          <>
            <button onClick={() => setConfirmDoc(null)} disabled={posting} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold text-fg-muted transition-transform hover:bg-surface-muted hover:text-fg active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40">Отмена</button>
            <button onClick={confirmPost} disabled={posting} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-red-600 px-4 text-sm font-semibold text-white transition-transform hover:bg-red-700 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40">
              {posting ? <Loader2 className="animate-spin" size={14} /> : <CheckCircle2 size={14} />} Провести списание
            </button>
          </>
        }
      >
        {confirmDoc && (
          <div className="text-sm space-y-2">
            <p className="text-gray-600 dark:text-gray-300">Товары будут безвозвратно списаны со склада «{confirmDoc.warehouse_name}».</p>
            <div className="space-y-1">
              {confirmDoc.items.map((i) => (
                <div key={i.product} className="flex justify-between text-gray-500">
                  <span>{i.product_name}</span>
                  <span className="tabular-nums text-red-600">−{formatQty(i.quantity)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

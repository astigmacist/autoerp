import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, Loader2, CheckCircle2, ClipboardList } from 'lucide-react'
import { api, getApiError } from '@/api/client'
import { useInventories, useWarehouses } from '@/api/queries'
import { useToast } from '@/store/toast'
import { formatQty, formatDate, todayIso } from '@/lib/format'
import Modal from '@/components/Modal'
import AddProductBar from '@/components/AddProductBar'
import WarehouseTabs from '@/components/WarehouseTabs'
import type { InventoryDoc, ProductSearchResult, Warehouse } from '@/api/types'
import { Card, EmptyState, SkeletonList, SkeletonRows, fieldClass } from '@/components/ui'

interface DraftLine {
  productId: string
  productName: string
  qtySystem: number
  qtyFact: number
}

const STATUS_LABELS: Record<string, string> = { draft: 'Черновик', posted: 'Проведена' }
const STATUS_CLS: Record<string, string> = {
  draft: 'bg-gray-100 dark:bg-gray-800 text-fg-muted',
  posted: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300',
}

function systemQtyFor(p: ProductSearchResult, warehouse?: Warehouse) {
  if (!warehouse) return 0
  return warehouse.kind === 'main' ? p.main_qty : p.shop_qty
}

export default function InventoryDocs() {
  const { data: docs, isLoading } = useInventories()
  const { data: warehouses } = useWarehouses()
  const { push } = useToast()
  const qc = useQueryClient()

  const [createOpen, setCreateOpen] = useState(false)
  const [date, setDate] = useState(todayIso())
  const [warehouseId, setWarehouseId] = useState('')
  const [lines, setLines] = useState<DraftLine[]>([])
  const [saving, setSaving] = useState(false)

  const [confirmDoc, setConfirmDoc] = useState<InventoryDoc | null>(null)
  const [posting, setPosting] = useState(false)

  const selectedWarehouse = warehouses?.find((w) => w.id === warehouseId)

  function openCreate() {
    setDate(todayIso())
    setWarehouseId(warehouses?.[0]?.id ?? '')
    setLines([])
    setCreateOpen(true)
  }

  function addLine(p: ProductSearchResult) {
    if (lines.some((l) => l.productId === p.id)) return
    const sys = systemQtyFor(p, selectedWarehouse)
    setLines((prev) => [...prev, { productId: p.id, productName: p.name, qtySystem: sys, qtyFact: sys }])
  }

  function updateFact(id: string, qty: number) {
    setLines((prev) => prev.map((l) => (l.productId === id ? { ...l, qtyFact: qty } : l)))
  }

  function removeLine(id: string) {
    setLines((prev) => prev.filter((l) => l.productId !== id))
  }

  async function saveDraft() {
    if (!warehouseId || lines.length === 0) return
    setSaving(true)
    try {
      await api.post('/inventories/', {
        date,
        warehouse: warehouseId,
        items: lines.map((l) => ({ product: l.productId, qty_system: l.qtySystem, qty_fact: l.qtyFact })),
      })
      push('Инвентаризация сохранена как черновик', 'success')
      setCreateOpen(false)
      qc.invalidateQueries({ queryKey: ['inventories'] })
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
      await api.post(`/inventories/${confirmDoc.id}/post_document/`)
      push(`Инвентаризация ${confirmDoc.number} проведена`, 'success')
      setConfirmDoc(null)
      qc.invalidateQueries({ queryKey: ['inventories'] })
      qc.invalidateQueries({ queryKey: ['stock'] })
    } catch (err) {
      push(getApiError(err).detail, 'error')
    } finally {
      setPosting(false)
    }
  }

  const diffLines = confirmDoc?.items.filter((i) => Number(i.qty_fact) - Number(i.qty_system) !== 0) ?? []

  return (
    <div className="space-y-4">
      <WarehouseTabs />
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-semibold text-fg">Инвентаризация</h1>
        <button onClick={openCreate} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 text-sm font-semibold text-white transition-transform hover:bg-gray-800 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white">
          <Plus size={16} /> Новая инвентаризация
        </button>
      </div>

      {/* На телефоне — карточки: в таблицу из шести колонок экран не помещается. */}
      <div className="md:hidden space-y-2">
        {isLoading && <SkeletonList rows={3} />}
        {docs?.length === 0 && <Card padded={false}><EmptyState icon={<ClipboardList size={20} />} title="Инвентаризаций ещё не было" /></Card>}
        {docs?.map((d) => (
          <div key={d.id} className="rounded-2xl border border-line bg-surface p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-medium text-fg">{d.number}</div>
                <div className="text-xs text-gray-400">{formatDate(d.date)} · {d.warehouse_name} · позиций: {d.items.length}</div>
              </div>
              <span className={`text-xs rounded-full px-2 py-0.5 shrink-0 ${STATUS_CLS[d.status]}`}>{STATUS_LABELS[d.status]}</span>
            </div>
            {d.status === 'draft' && (
              <button
                onClick={() => setConfirmDoc(d)}
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
              <th className="text-left font-medium px-2 py-2.5">Склад</th>
              <th className="text-right font-medium px-2 py-2.5">Позиций</th>
              <th className="text-left font-medium px-2 py-2.5">Статус</th>
              <th className="text-right font-medium px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {isLoading && <SkeletonRows rows={4} cols={6} />}
            {docs?.length === 0 && <tr><td colSpan={6} className="px-4 py-4"><EmptyState icon={<ClipboardList size={20} />} title="Инвентаризаций ещё не было" /></td></tr>}
            {docs?.map((d) => (
              <tr key={d.id}>
                <td className="px-4 py-2.5 font-medium text-fg">{d.number}</td>
                <td className="px-2 py-2.5 text-gray-500">{formatDate(d.date)}</td>
                <td className="px-2 py-2.5 text-gray-500">{d.warehouse_name}</td>
                <td className="px-2 py-2.5 text-right tabular-nums">{d.items.length}</td>
                <td className="px-2 py-2.5"><span className={`text-xs rounded-full px-2 py-0.5 ${STATUS_CLS[d.status]}`}>{STATUS_LABELS[d.status]}</span></td>
                <td className="px-4 py-2.5 text-right">
                  {d.status === 'draft' && (
                    <button onClick={() => setConfirmDoc(d)} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-emerald-50 px-3 text-xs font-semibold text-emerald-700 transition-transform hover:bg-emerald-100 active:scale-[0.98] dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-900/50">Провести</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={createOpen} onClose={() => !saving && setCreateOpen(false)} title="Новая инвентаризация" width="max-w-2xl"
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
          <div className="grid grid-cols-2 gap-3">
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

          <div>
            <AddProductBar onSelect={addLine} label="Добавить товар для пересчёта" />
          </div>

          {lines.length > 0 && (
            <div className="rounded-xl border border-line overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-surface-muted text-fg-muted">
                  <tr>
                    <th className="text-left font-medium px-3 py-2">Товар</th>
                    <th className="text-right font-medium px-2 py-2 w-24">По системе</th>
                    <th className="text-right font-medium px-2 py-2 w-24">По факту</th>
                    <th className="text-right font-medium px-2 py-2 w-20">Разница</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {lines.map((l) => {
                    const diff = l.qtyFact - l.qtySystem
                    return (
                      <tr key={l.productId}>
                        <td className="px-3 py-2 text-gray-800 dark:text-gray-200">{l.productName}</td>
                        <td className="px-2 py-2 text-right tabular-nums text-gray-400">{formatQty(l.qtySystem)}</td>
                        <td className="px-2 py-2">
                          <input type="number" value={l.qtyFact} onChange={(e) => updateFact(l.productId, parseFloat(e.target.value) || 0)} className="w-full text-right bg-transparent outline-none tabular-nums" />
                        </td>
                        <td className={`px-2 py-2 text-right tabular-nums font-medium ${diff === 0 ? 'text-gray-400' : diff > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {diff > 0 ? `+${formatQty(diff)}` : formatQty(diff)}
                        </td>
                        <td className="px-2 py-2">
                          <button onClick={() => removeLine(l.productId)} className="text-gray-300 hover:text-red-500"><Trash2 size={14} /></button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Modal>

      <Modal open={!!confirmDoc} onClose={() => !posting && setConfirmDoc(null)} title="Провести инвентаризацию?"
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
              Остатки будут скорректированы по расхождениям ({diffLines.length} из {confirmDoc.items.length} позиций).
            </p>
            {diffLines.length === 0 ? (
              <p className="text-gray-400">Расхождений нет — остатки не изменятся.</p>
            ) : (
              <div className="space-y-1">
                {diffLines.map((i) => {
                  const diff = Number(i.qty_fact) - Number(i.qty_system)
                  return (
                    <div key={i.product} className="flex justify-between text-gray-500">
                      <span>{i.product_name}</span>
                      <span className={`tabular-nums font-medium ${diff > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {diff > 0 ? `+${formatQty(diff)}` : formatQty(diff)}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}

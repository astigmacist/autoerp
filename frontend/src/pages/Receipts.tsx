import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, Loader2, CheckCircle2, PackagePlus } from 'lucide-react'
import { api, getApiError } from '@/api/client'
import { useReceipts, useSuppliers, useWarehouses } from '@/api/queries'
import { useToast } from '@/store/toast'
import { useAuth } from '@/store/auth'
import { formatMoney, formatQty, formatDate, todayIso } from '@/lib/format'
import Modal from '@/components/Modal'
import AddProductBar from '@/components/AddProductBar'
import ProductFormModal from '@/components/ProductFormModal'
import WarehouseTabs from '@/components/WarehouseTabs'
import type { Product, ProductSearchResult, Receipt } from '@/api/types'
import { Card, EmptyState, SkeletonList, SkeletonRows, fieldClass } from '@/components/ui'

function productToSearchResult(p: Product): ProductSearchResult {
  return {
    id: p.id,
    name: p.name,
    sku: p.sku,
    oem_code: p.oem_code,
    barcode: p.barcode,
    unit: p.unit,
    sale_price: p.sale_price,
    min_stock: p.min_stock,
    shop_qty: 0,
    main_qty: 0,
  }
}

interface DraftLine {
  product: ProductSearchResult
  quantity: number
  purchasePrice: number
  salePrice: number | ''
}

const STATUS_LABELS: Record<string, string> = { draft: 'Черновик', posted: 'Проведён', cancelled: 'Отменён' }
const STATUS_CLS: Record<string, string> = {
  draft: 'bg-gray-100 dark:bg-gray-800 text-fg-muted',
  posted: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300',
  cancelled: 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300',
}

export default function Receipts() {
  const { data: receipts, isLoading } = useReceipts()
  const { data: warehouses } = useWarehouses()
  const { data: suppliers } = useSuppliers()
  const { push } = useToast()
  const qc = useQueryClient()
  const { permissions } = useAuth()

  const [createOpen, setCreateOpen] = useState(false)
  const [date, setDate] = useState(todayIso())
  const [warehouseId, setWarehouseId] = useState('')
  const [supplierId, setSupplierId] = useState('')
  const [comment, setComment] = useState('')
  const [lines, setLines] = useState<DraftLine[]>([])
  const [saving, setSaving] = useState(false)

  const [confirmDoc, setConfirmDoc] = useState<Receipt | null>(null)
  const [posting, setPosting] = useState(false)

  const [newProductName, setNewProductName] = useState('')
  const [newProductOpen, setNewProductOpen] = useState(false)

  const mainWarehouse = warehouses?.find((w) => w.kind === 'main')

  function openCreate() {
    setDate(todayIso())
    setWarehouseId(mainWarehouse?.id ?? warehouses?.[0]?.id ?? '')
    setSupplierId('')
    setComment('')
    setLines([])
    setCreateOpen(true)
  }

  function addLine(p: ProductSearchResult) {
    if (lines.some((l) => l.product.id === p.id)) return
    setLines((prev) => [...prev, { product: p, quantity: 1, purchasePrice: 0, salePrice: '' }])
  }

  function updateLine(id: string, patch: Partial<DraftLine>) {
    setLines((prev) => prev.map((l) => (l.product.id === id ? { ...l, ...patch } : l)))
  }

  function removeLine(id: string) {
    setLines((prev) => prev.filter((l) => l.product.id !== id))
  }

  const total = lines.reduce((s, l) => s + l.quantity * l.purchasePrice, 0)

  async function saveDraft() {
    if (!warehouseId || lines.length === 0) return
    setSaving(true)
    try {
      await api.post('/receipts/', {
        date,
        warehouse: warehouseId,
        supplier: supplierId || null,
        comment,
        items: lines.map((l) => ({
          product: l.product.id,
          quantity: l.quantity,
          purchase_price: l.purchasePrice,
          sale_price: l.salePrice === '' ? null : l.salePrice,
        })),
      })
      push('Приход сохранён как черновик', 'success')
      setCreateOpen(false)
      qc.invalidateQueries({ queryKey: ['receipts'] })
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
      await api.post(`/receipts/${confirmDoc.id}/post_document/`)
      push(`Приход ${confirmDoc.number} проведён`, 'success')
      setConfirmDoc(null)
      qc.invalidateQueries({ queryKey: ['receipts'] })
      qc.invalidateQueries({ queryKey: ['stock'] })
      qc.invalidateQueries({ queryKey: ['products'] })
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
        <h1 className="text-xl font-semibold text-fg">Приходы товара</h1>
        <button
          onClick={openCreate}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 text-sm font-semibold text-white transition-transform hover:bg-gray-800 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
        >
          <Plus size={16} /> Новый приход
        </button>
      </div>

      {/* На телефоне — карточки: в таблицу из шести колонок экран не помещается. */}
      <div className="md:hidden space-y-2">
        {isLoading && <SkeletonList rows={3} />}
        {receipts?.length === 0 && <Card padded={false}><EmptyState icon={<PackagePlus size={20} />} title="Приходов ещё нет" /></Card>}
        {receipts?.map((r) => (
          <div key={r.id} className="rounded-2xl border border-line bg-surface p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-medium text-fg">{r.number}</div>
                <div className="text-xs text-gray-400">{formatDate(r.date)} · {r.warehouse_name}{r.supplier_name && ` · ${r.supplier_name}`}</div>
              </div>
              <span className={`text-xs rounded-full px-2 py-0.5 shrink-0 ${STATUS_CLS[r.status]}`}>{STATUS_LABELS[r.status]}</span>
            </div>
            <div className="mt-2 text-sm font-semibold tabular-nums text-fg">{formatMoney(r.total_amount ?? 0)}</div>
            {r.status === 'draft' && (
              <button
                onClick={() => setConfirmDoc(r)}
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
              <th className="text-left font-medium px-2 py-2.5">Поставщик</th>
              <th className="text-right font-medium px-2 py-2.5">Сумма</th>
              <th className="text-left font-medium px-2 py-2.5">Статус</th>
              <th className="text-right font-medium px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {isLoading && <SkeletonRows rows={4} cols={7} />}
            {receipts?.length === 0 && <tr><td colSpan={7} className="px-4 py-4"><EmptyState icon={<PackagePlus size={20} />} title="Приходов ещё нет" /></td></tr>}
            {receipts?.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-2.5 font-medium text-fg">{r.number}</td>
                <td className="px-2 py-2.5 text-gray-500">{formatDate(r.date)}</td>
                <td className="px-2 py-2.5 text-gray-500">{r.warehouse_name}</td>
                <td className="px-2 py-2.5 text-gray-500">{r.supplier_name || '—'}</td>
                <td className="px-2 py-2.5 text-right font-medium tabular-nums">{formatMoney(r.total_amount ?? 0)}</td>
                <td className="px-2 py-2.5">
                  <span className={`text-xs rounded-full px-2 py-0.5 ${STATUS_CLS[r.status]}`}>{STATUS_LABELS[r.status]}</span>
                </td>
                <td className="px-4 py-2.5 text-right">
                  {r.status === 'draft' && (
                    <button
                      onClick={() => setConfirmDoc(r)}
                      className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-emerald-50 px-3 text-xs font-semibold text-emerald-700 transition-transform hover:bg-emerald-100 active:scale-[0.98] dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-900/50"
                    >
                      Провести
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={createOpen} onClose={() => !saving && setCreateOpen(false)} title="Новый приход" width="max-w-2xl"
        footer={
          <>
            <button onClick={() => setCreateOpen(false)} disabled={saving} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold text-fg-muted transition-transform hover:bg-surface-muted hover:text-fg active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40">Отмена</button>
            <button onClick={saveDraft} disabled={saving || lines.length === 0 || !warehouseId} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 text-sm font-semibold text-white transition-transform hover:bg-gray-800 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white">
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
              <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} className={`mt-1 ${fieldClass} select-field h-11 md:h-10`}>
                {warehouses?.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-fg-muted">Поставщик (опционально)</label>
            <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className={`mt-1 ${fieldClass} select-field h-11 md:h-10`}>
              <option value="">—</option>
              {suppliers?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          <AddProductBar
            onSelect={addLine}
            onCreateNew={
              permissions?.can_manage_catalog
                ? (name) => {
                    setNewProductName(name)
                    setNewProductOpen(true)
                  }
                : undefined
            }
          />

          {lines.length > 0 && (
            <div className="rounded-xl border border-line overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-surface-muted text-fg-muted">
                  <tr>
                    <th className="text-left font-medium px-3 py-2">Товар</th>
                    <th className="text-right font-medium px-2 py-2 w-20">Кол-во</th>
                    <th className="text-right font-medium px-2 py-2 w-28">Закупка</th>
                    <th className="text-right font-medium px-2 py-2 w-28">Новая цена</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {lines.map((l) => (
                    <tr key={l.product.id}>
                      <td className="px-3 py-2 text-gray-800 dark:text-gray-200">{l.product.name}</td>
                      <td className="px-2 py-2">
                        <input type="number" value={l.quantity} onChange={(e) => updateLine(l.product.id, { quantity: parseFloat(e.target.value) || 0 })} className="w-full text-right bg-transparent outline-none tabular-nums" />
                      </td>
                      <td className="px-2 py-2">
                        <input type="number" value={l.purchasePrice} onChange={(e) => updateLine(l.product.id, { purchasePrice: parseFloat(e.target.value) || 0 })} className="w-full text-right bg-transparent outline-none tabular-nums" />
                      </td>
                      <td className="px-2 py-2">
                        <input type="number" value={l.salePrice} placeholder="—" onChange={(e) => updateLine(l.product.id, { salePrice: e.target.value === '' ? '' : parseFloat(e.target.value) })} className="w-full text-right bg-transparent outline-none tabular-nums" />
                      </td>
                      <td className="px-2 py-2">
                        <button onClick={() => removeLine(l.product.id)} className="text-gray-300 hover:text-red-500"><Trash2 size={14} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex justify-end px-3 py-2 bg-surface-muted text-sm font-semibold">
                Итого: {formatMoney(total)}
              </div>
            </div>
          )}
        </div>
      </Modal>

      <Modal open={!!confirmDoc} onClose={() => !posting && setConfirmDoc(null)} title="Провести приход?"
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
              После проведения остатки на складе «{confirmDoc.warehouse_name}» увеличатся, документ будет заблокирован для редактирования.
            </p>
            <div className="space-y-1">
              {confirmDoc.items.map((i) => (
                <div key={i.product} className="flex justify-between text-gray-500">
                  <span>{i.product_name}</span>
                  <span className="tabular-nums">+{formatQty(i.quantity)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>

      <ProductFormModal
        open={newProductOpen}
        onClose={() => setNewProductOpen(false)}
        initialName={newProductName}
        onSaved={(p) => {
          addLine(productToSearchResult(p))
          setNewProductOpen(false)
        }}
      />
    </div>
  )
}

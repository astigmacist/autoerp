import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, Loader2, CheckCircle2 } from 'lucide-react'
import { api, getApiError } from '@/api/client'
import { useWarehouses, useWriteOffs } from '@/api/queries'
import { useToast } from '@/store/toast'
import { formatQty, formatDate, todayIso } from '@/lib/format'
import Modal from '@/components/Modal'
import ProductPicker from '@/components/ProductPicker'
import WarehouseTabs from '@/components/WarehouseTabs'
import type { ProductSearchResult, WriteOff } from '@/api/types'

interface DraftLine {
  productId: string
  productName: string
  quantity: number
}

const STATUS_LABELS: Record<string, string> = { draft: 'Черновик', posted: 'Проведено' }
const STATUS_CLS: Record<string, string> = { draft: 'bg-gray-100 text-gray-500', posted: 'bg-emerald-50 text-emerald-700' }

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
    setLines((prev) => [...prev, { productId: p.id, productName: p.name, quantity: 1 }])
  }

  function updateQty(id: string, qty: number) {
    setLines((prev) => prev.map((l) => (l.productId === id ? { ...l, quantity: qty } : l)))
  }

  function removeLine(id: string) {
    setLines((prev) => prev.filter((l) => l.productId !== id))
  }

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
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Списания</h1>
        <button onClick={openCreate} className="flex items-center gap-1.5 rounded-xl bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 px-3.5 py-2 text-sm font-medium">
          <Plus size={16} /> Новое списание
        </button>
      </div>

      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#151720] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400">
            <tr>
              <th className="text-left font-medium px-4 py-2.5">№</th>
              <th className="text-left font-medium px-2 py-2.5">Дата</th>
              <th className="text-left font-medium px-2 py-2.5">Склад</th>
              <th className="text-left font-medium px-2 py-2.5">Причина</th>
              <th className="text-left font-medium px-2 py-2.5">Статус</th>
              <th className="text-right font-medium px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {isLoading && <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Загрузка…</td></tr>}
            {docs?.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Списаний ещё не было</td></tr>}
            {docs?.map((d) => (
              <tr key={d.id}>
                <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-gray-100">{d.number}</td>
                <td className="px-2 py-2.5 text-gray-500">{formatDate(d.date)}</td>
                <td className="px-2 py-2.5 text-gray-500">{d.warehouse_name}</td>
                <td className="px-2 py-2.5 text-gray-500">{d.reason_text || '—'}</td>
                <td className="px-2 py-2.5"><span className={`text-xs rounded-full px-2 py-0.5 ${STATUS_CLS[d.status]}`}>{STATUS_LABELS[d.status]}</span></td>
                <td className="px-4 py-2.5 text-right">
                  {d.status === 'draft' && (
                    <button onClick={() => setConfirmDoc(d)} className="text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-lg px-2.5 py-1.5">Провести</button>
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
            <button onClick={() => setCreateOpen(false)} disabled={saving} className="px-4 py-2 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800">Отмена</button>
            <button onClick={saveDraft} disabled={saving || lines.length === 0} className="px-4 py-2 rounded-xl text-sm font-semibold bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 flex items-center gap-2 disabled:opacity-40">
              {saving && <Loader2 className="animate-spin" size={14} />} Сохранить черновик
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500">Дата</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full mt-1 rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent px-3 py-2 text-sm outline-none" />
            </div>
            <div>
              <label className="text-xs text-gray-500">Склад</label>
              <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} className="w-full mt-1 rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent px-3 py-2 text-sm outline-none">
                {warehouses?.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500">Причина</label>
            <input value={reasonText} onChange={(e) => setReasonText(e.target.value)} placeholder="Брак, порча, потеря…" className="w-full mt-1 rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent px-3 py-2 text-sm outline-none" />
          </div>

          <div>
            <label className="text-xs text-gray-500 mb-1 block">Добавить товар</label>
            <ProductPicker onSelect={addLine} />
          </div>

          {lines.length > 0 && (
            <div className="rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400">
                  <tr>
                    <th className="text-left font-medium px-3 py-2">Товар</th>
                    <th className="text-right font-medium px-2 py-2 w-24">Кол-во</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
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

      <Modal open={!!confirmDoc} onClose={() => !posting && setConfirmDoc(null)} title="Провести списание?"
        footer={
          <>
            <button onClick={() => setConfirmDoc(null)} disabled={posting} className="px-4 py-2 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800">Отмена</button>
            <button onClick={confirmPost} disabled={posting} className="px-4 py-2 rounded-xl text-sm font-semibold bg-red-600 text-white flex items-center gap-2 disabled:opacity-60">
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

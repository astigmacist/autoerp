import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Loader2, RotateCcw } from 'lucide-react'
import { api, getApiError } from '@/api/client'
import { useAuth } from '@/store/auth'
import { useToast } from '@/store/toast'
import { formatDateTime, formatMoney, formatQty } from '@/lib/format'
import Modal from '@/components/Modal'
import type { Payment, PaymentMethod, Sale } from '@/api/types'

const PAYMENT_LABELS: Record<PaymentMethod, string> = { cash: 'Наличные', kaspi_qr: 'Kaspi QR', card: 'Карта', transfer: 'Перевод' }
const STATUS_LABELS: Record<string, string> = {
  completed: 'Завершена', returned: 'Возвращена', partially_returned: 'Частично возвращена', cancelled: 'Отменена',
}

export default function SaleDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { permissions } = useAuth()
  const { push } = useToast()
  const qc = useQueryClient()

  const { data: sale, isLoading } = useQuery({
    queryKey: ['sale', id],
    queryFn: async () => (await api.get<Sale>(`/sales/${id}/`)).data,
    enabled: !!id,
  })

  const [returnQty, setReturnQty] = useState<Record<number, number>>({})
  const [reason, setReason] = useState('')
  const [refundMethod, setRefundMethod] = useState<PaymentMethod>('cash')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  if (isLoading || !sale) {
    return <div className="text-gray-400 text-sm">Загрузка…</div>
  }

  function remaining(quantity: string, returned: string) {
    return parseFloat(quantity) - parseFloat(returned)
  }

  const selectedLines = sale.items
    .map((i) => ({ item: i, qty: returnQty[i.id] || 0 }))
    .filter((l) => l.qty > 0)

  const returnTotal = selectedLines.reduce((s, l) => s + l.qty * parseFloat(l.item.final_price), 0)

  async function submitReturn() {
    if (!sale || selectedLines.length === 0) return
    setSubmitting(true)
    try {
      await api.post(`/sales/${sale.id}/create_return/`, {
        items: selectedLines.map((l) => ({ sale_item_id: l.item.id, quantity: l.qty })),
        reason,
        refund_method: refundMethod,
      })
      push('Возврат оформлен', 'success')
      setConfirmOpen(false)
      setReturnQty({})
      setReason('')
      qc.invalidateQueries({ queryKey: ['sale', id] })
      qc.invalidateQueries({ queryKey: ['sales'] })
      qc.invalidateQueries({ queryKey: ['stock'] })
    } catch (err) {
      push(getApiError(err).detail, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const canReturn = sale.status === 'completed' || sale.status === 'partially_returned'

  return (
    <div className="space-y-4 max-w-2xl">
      <button onClick={() => navigate('/sales')} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 dark:hover:text-gray-200">
        <ArrowLeft size={16} /> К журналу продаж
      </button>

      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#151720] p-5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{sale.number}</h1>
            <div className="text-sm text-gray-400">{formatDateTime(sale.created_at)} · {sale.seller_name}</div>
          </div>
          <span className={`text-xs rounded-full px-2.5 py-1 ${sale.status === 'completed' ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'}`}>
            {STATUS_LABELS[sale.status] ?? sale.status}
          </span>
        </div>

        <div className="mt-4 divide-y divide-gray-100 dark:divide-gray-800">
          {sale.items.map((i) => {
            const rem = remaining(String(i.quantity), String(i.returned_qty))
            return (
              <div key={i.id} className="py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{i.product_name}</div>
                  <div className="text-xs text-gray-400">
                    {i.sku} · {formatQty(i.quantity)} × {formatMoney(i.final_price)}
                    {parseFloat(i.returned_qty) > 0 && ` · возвращено ${formatQty(i.returned_qty)}`}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-sm font-semibold tabular-nums">{formatMoney(i.amount)}</div>
                  {canReturn && rem > 0 && (
                    <input
                      type="number"
                      min={0}
                      max={rem}
                      placeholder="0"
                      value={returnQty[i.id] || ''}
                      onChange={(e) => {
                        const v = Math.max(0, Math.min(rem, parseFloat(e.target.value) || 0))
                        setReturnQty((prev) => ({ ...prev, [i.id]: v }))
                      }}
                      className="w-16 text-right rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent px-2 py-1 text-sm tabular-nums outline-none"
                    />
                  )}
                </div>
              </div>
            )
          })}
        </div>

        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800 space-y-1.5 text-sm">
          <div className="flex justify-between text-gray-500">
            <span>Сумма по прайсу</span>
            <span className="tabular-nums">{formatMoney(sale.subtotal)}</span>
          </div>
          {parseFloat(sale.discount_total) > 0 && (
            <div className="flex justify-between text-amber-600">
              <span>Скидка</span>
              <span className="tabular-nums">−{formatMoney(sale.discount_total)}</span>
            </div>
          )}
          <div className="flex justify-between text-base font-semibold text-gray-900 dark:text-gray-100">
            <span>Итого</span>
            <span className="tabular-nums">{formatMoney(sale.total)}</span>
          </div>
          {permissions?.can_see_cost && sale.profit !== undefined && (
            <div className="flex justify-between text-gray-400">
              <span>Прибыль</span>
              <span className="tabular-nums">{formatMoney(sale.profit)}</span>
            </div>
          )}
          <div className="text-gray-400 pt-1">
            Оплата: {sale.payments.map((p: Payment) => `${PAYMENT_LABELS[p.method]} ${formatMoney(p.amount)}`).join(', ')}
          </div>
        </div>
      </div>

      {canReturn && selectedLines.length > 0 && (
        <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#151720] p-5 space-y-3">
          <div className="text-sm font-medium text-gray-700 dark:text-gray-300">Оформить возврат</div>
          <div>
            <label className="text-xs text-gray-500">Причина</label>
            <input value={reason} onChange={(e) => setReason(e.target.value)} className="w-full mt-1 rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent px-3 py-2 text-sm outline-none" placeholder="Брак, не подошло…" />
          </div>
          <div>
            <label className="text-xs text-gray-500">Способ возврата денег</label>
            <select value={refundMethod} onChange={(e) => setRefundMethod(e.target.value as PaymentMethod)} className="w-full mt-1 rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent px-3 py-2 text-sm outline-none">
              {Object.entries(PAYMENT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <button onClick={() => setConfirmOpen(true)} className="w-full flex items-center justify-center gap-2 rounded-xl bg-red-600 text-white py-2.5 text-sm font-semibold">
            <RotateCcw size={15} /> Вернуть на {formatMoney(returnTotal)}
          </button>
        </div>
      )}

      <Modal
        open={confirmOpen}
        onClose={() => !submitting && setConfirmOpen(false)}
        title="Подтвердите возврат"
        footer={
          <>
            <button onClick={() => setConfirmOpen(false)} disabled={submitting} className="px-4 py-2 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800">Отмена</button>
            <button onClick={submitReturn} disabled={submitting} className="px-4 py-2 rounded-xl text-sm font-semibold bg-red-600 text-white flex items-center gap-2 disabled:opacity-60">
              {submitting && <Loader2 className="animate-spin" size={14} />} Подтвердить возврат
            </button>
          </>
        }
      >
        <div className="space-y-2 text-sm">
          {selectedLines.map((l) => (
            <div key={l.item.id} className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-300">{l.item.product_name} ×{formatQty(l.qty)}</span>
              <span className="font-medium tabular-nums">{formatMoney(l.qty * parseFloat(l.item.final_price))}</span>
            </div>
          ))}
          <div className="flex justify-between text-base font-semibold text-gray-900 dark:text-gray-100 pt-2 border-t border-gray-100 dark:border-gray-800">
            <span>К возврату</span>
            <span className="tabular-nums">{formatMoney(returnTotal)}</span>
          </div>
          <div className="text-gray-500">Товар вернётся на склад «{sale.warehouse_name}», деньги — {PAYMENT_LABELS[refundMethod]}.</div>
        </div>
      </Modal>
    </div>
  )
}

import { useEffect, useMemo, useRef, useState } from 'react'
import { Search, Trash2, Plus, Minus, Loader2, AlertTriangle } from 'lucide-react'
import { api, getApiError } from '@/api/client'
import { useProductSearch, useWarehouses } from '@/api/queries'
import { useAuth } from '@/store/auth'
import { useToast } from '@/store/toast'
import { formatMoney, formatQty } from '@/lib/format'
import Modal from '@/components/Modal'
import ShiftBar from '@/components/ShiftBar'
import type { PaymentMethod, ProductSearchResult, Sale } from '@/api/types'

interface CartLine {
  product: ProductSearchResult
  quantity: number
  finalPrice: number
}

const PAYMENT_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: 'Наличные' },
  { value: 'kaspi_qr', label: 'Kaspi QR' },
  { value: 'card', label: 'Карта' },
]

function uuid() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`
}

export default function SalePage() {
  const { data: warehouses } = useWarehouses()
  const shop = useMemo(() => warehouses?.find((w) => w.is_sellable), [warehouses])
  const { permissions } = useAuth()
  const { push } = useToast()

  const [query, setQuery] = useState('')
  const { data: results, isFetching } = useProductSearch(query)
  const [cart, setCart] = useState<CartLine[]>([])
  const [payMethod, setPayMethod] = useState<PaymentMethod>('cash')
  const [splitMode, setSplitMode] = useState(false)
  const [splitAmounts, setSplitAmounts] = useState<Record<PaymentMethod, number>>({ cash: 0, kaspi_qr: 0, card: 0, transfer: 0 })
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [idempotencyKey, setIdempotencyKey] = useState(uuid())
  const [customerReceived, setCustomerReceived] = useState<string>('')
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    searchRef.current?.focus()
  }, [])

  function addToCart(product: ProductSearchResult) {
    setCart((prev) => {
      const existing = prev.find((l) => l.product.id === product.id)
      if (existing) {
        return prev.map((l) =>
          l.product.id === product.id ? { ...l, quantity: Math.min(l.quantity + 1, product.shop_qty) } : l
        )
      }
      if (product.shop_qty <= 0) {
        push(`«${product.name}» отсутствует на витрине`, 'error')
        return prev
      }
      return [...prev, { product, quantity: 1, finalPrice: parseFloat(product.sale_price) }]
    })
    setQuery('')
    searchRef.current?.focus()
  }

  function updateQty(id: string, qty: number) {
    setCart((prev) =>
      prev.map((l) => {
        if (l.product.id !== id) return l
        const clamped = Math.max(0.001, Math.min(qty, l.product.shop_qty))
        return { ...l, quantity: clamped }
      })
    )
  }

  function updatePrice(id: string, price: number) {
    setCart((prev) => prev.map((l) => (l.product.id === id ? { ...l, finalPrice: Math.max(0, price) } : l)))
  }

  function removeLine(id: string) {
    setCart((prev) => prev.filter((l) => l.product.id !== id))
  }

  const subtotal = cart.reduce((s, l) => s + parseFloat(l.product.sale_price) * l.quantity, 0)
  const total = cart.reduce((s, l) => s + l.finalPrice * l.quantity, 0)
  const discountTotal = subtotal - total
  const change = payMethod === 'cash' && customerReceived ? Math.max(0, parseFloat(customerReceived) - total) : null

  const limit = permissions?.discount_limit_percent
  const overLimitLines = cart.filter((l) => {
    const base = parseFloat(l.product.sale_price)
    if (!base || limit === null || limit === undefined) return false
    const pct = ((base - l.finalPrice) / base) * 100
    return pct > limit
  })
  const belowCostWarning = cart.some((l) => l.finalPrice <= 0)

  function resetSale() {
    setCart([])
    setCustomerReceived('')
    setSplitMode(false)
    setSplitAmounts({ cash: 0, kaspi_qr: 0, card: 0, transfer: 0 })
    setIdempotencyKey(uuid())
    searchRef.current?.focus()
  }

  async function submitSale() {
    if (!shop || cart.length === 0) return
    setSubmitting(true)
    try {
      const payments = splitMode
        ? Object.entries(splitAmounts)
            .filter(([, amount]) => amount > 0)
            .map(([method, amount]) => ({ method, amount }))
        : [{ method: payMethod, amount: total }]

      const { data } = await api.post<Sale>('/sales/create/', {
        idempotency_key: idempotencyKey,
        warehouse_id: shop.id,
        items: cart.map((l) => ({ product_id: l.product.id, quantity: l.quantity, final_price: l.finalPrice })),
        payments,
      })
      push(`Продажа №${data.number} проведена`, 'success')
      setConfirmOpen(false)
      resetSale()
    } catch (err) {
      push(getApiError(err).detail, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const splitSum = Object.values(splitAmounts).reduce((s, v) => s + (v || 0), 0)
  const canConfirm = cart.length > 0 && (!splitMode || Math.abs(splitSum - total) < 0.01)

  return (
    <div className="grid lg:grid-cols-[1fr_380px] gap-4">
      <div className="lg:col-span-2">
        <ShiftBar />
      </div>
      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск по названию, коду, OEM или штрихкоду…"
            className="w-full rounded-2xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#151720] pl-10 pr-4 py-3 text-sm outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-100"
          />
          {isFetching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-gray-400" size={16} />}
        </div>

        {query.trim().length >= 2 && (
          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#151720] divide-y divide-gray-100 dark:divide-gray-800 max-h-80 overflow-y-auto">
            {results?.length === 0 && <div className="p-4 text-sm text-gray-400">Ничего не найдено</div>}
            {results?.map((p) => (
              <button
                key={p.id}
                onClick={() => addToCart(p)}
                className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{p.name}</div>
                  <div className="text-xs text-gray-400">{p.sku} {p.oem_code && `· ${p.oem_code}`}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-semibold tabular-nums">{formatMoney(p.sale_price)}</div>
                  <div className={`text-xs ${p.shop_qty < p.min_stock ? 'text-red-600' : 'text-gray-400'}`}>
                    на витрине: {formatQty(p.shop_qty)}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#151720] overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400">
              <tr>
                <th className="text-left font-medium px-4 py-2.5">Товар</th>
                <th className="text-center font-medium px-2 py-2.5 w-32">Кол-во</th>
                <th className="text-right font-medium px-2 py-2.5 w-32">Цена</th>
                <th className="text-right font-medium px-4 py-2.5 w-28">Сумма</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {cart.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-gray-400 text-sm">
                    Корзина пуста. Найдите товар выше.
                  </td>
                </tr>
              )}
              {cart.map((l) => {
                const base = parseFloat(l.product.sale_price)
                const hasDiscount = l.finalPrice < base
                return (
                  <tr key={l.product.id}>
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-gray-900 dark:text-gray-100">{l.product.name}</div>
                      <div className="text-xs text-gray-400">{l.product.sku}</div>
                    </td>
                    <td className="px-2 py-2.5">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => updateQty(l.product.id, l.quantity - 1)} className="w-6 h-6 rounded-lg border border-gray-200 dark:border-gray-700 flex items-center justify-center">
                          <Minus size={12} />
                        </button>
                        <input
                          value={l.quantity}
                          onChange={(e) => updateQty(l.product.id, parseFloat(e.target.value) || 0)}
                          className="w-12 text-center bg-transparent outline-none tabular-nums"
                        />
                        <button onClick={() => updateQty(l.product.id, l.quantity + 1)} className="w-6 h-6 rounded-lg border border-gray-200 dark:border-gray-700 flex items-center justify-center">
                          <Plus size={12} />
                        </button>
                      </div>
                    </td>
                    <td className="px-2 py-2.5">
                      <input
                        value={l.finalPrice}
                        onChange={(e) => updatePrice(l.product.id, parseFloat(e.target.value) || 0)}
                        className={`w-full text-right bg-transparent outline-none tabular-nums font-medium rounded-lg px-1 ${
                          hasDiscount ? 'text-amber-600' : 'text-gray-900 dark:text-gray-100'
                        }`}
                      />
                      {hasDiscount && (
                        <div className="text-right text-[11px] text-amber-600">
                          −{formatMoney((base - l.finalPrice) * l.quantity)}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold tabular-nums">
                      {formatMoney(l.finalPrice * l.quantity)}
                    </td>
                    <td className="px-2 py-2.5">
                      <button onClick={() => removeLine(l.product.id)} className="text-gray-300 hover:text-red-500">
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Checkout panel */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#151720] p-4 h-fit sticky top-4 space-y-4">
        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between text-gray-500">
            <span>Сумма по прайсу</span>
            <span className="tabular-nums">{formatMoney(subtotal)}</span>
          </div>
          {discountTotal > 0 && (
            <div className="flex justify-between text-amber-600">
              <span>Скидка</span>
              <span className="tabular-nums">−{formatMoney(discountTotal)}</span>
            </div>
          )}
          <div className="flex justify-between text-lg font-semibold text-gray-900 dark:text-gray-100 pt-1 border-t border-gray-100 dark:border-gray-800">
            <span>Итого</span>
            <span className="tabular-nums">{formatMoney(total)}</span>
          </div>
        </div>

        {overLimitLines.length > 0 && (
          <div className="flex items-start gap-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-amber-700 dark:text-amber-300 text-xs px-3 py-2">
            <AlertTriangle size={14} className="shrink-0 mt-0.5" />
            Скидка выше лимита ({limit}%) — потребуется подтверждение владельца.
          </div>
        )}
        {belowCostWarning && (
          <div className="flex items-start gap-2 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-xs px-3 py-2">
            <AlertTriangle size={14} className="shrink-0 mt-0.5" />
            Цена одной из позиций равна нулю — проверьте перед подтверждением.
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Способ оплаты</span>
            <button onClick={() => setSplitMode((v) => !v)} className="text-xs text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 underline">
              {splitMode ? 'Один способ' : 'Разделить оплату'}
            </button>
          </div>

          {!splitMode ? (
            <div className="grid grid-cols-3 gap-2">
              {PAYMENT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setPayMethod(opt.value)}
                  className={`rounded-xl border px-2 py-2.5 text-sm font-medium transition-colors ${
                    payMethod === opt.value
                      ? 'border-gray-900 dark:border-gray-100 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900'
                      : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {PAYMENT_OPTIONS.map((opt) => (
                <div key={opt.value} className="flex items-center justify-between gap-2">
                  <span className="text-sm text-gray-600 dark:text-gray-300 w-24">{opt.label}</span>
                  <input
                    type="number"
                    value={splitAmounts[opt.value] || ''}
                    onChange={(e) =>
                      setSplitAmounts((prev) => ({ ...prev, [opt.value]: parseFloat(e.target.value) || 0 }))
                    }
                    className="flex-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent px-2 py-1.5 text-sm text-right tabular-nums outline-none"
                    placeholder="0"
                  />
                </div>
              ))}
              <div className={`text-xs text-right ${Math.abs(splitSum - total) < 0.01 ? 'text-emerald-600' : 'text-red-600'}`}>
                Введено: {formatMoney(splitSum)} из {formatMoney(total)}
              </div>
            </div>
          )}
        </div>

        {!splitMode && payMethod === 'cash' && (
          <div>
            <label className="text-xs text-gray-500">Получено наличными</label>
            <input
              type="number"
              value={customerReceived}
              onChange={(e) => setCustomerReceived(e.target.value)}
              className="w-full mt-1 rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent px-3 py-2 text-sm tabular-nums outline-none"
              placeholder={String(total)}
            />
            {change !== null && customerReceived && (
              <div className="text-xs text-emerald-600 mt-1">Сдача: {formatMoney(change)}</div>
            )}
          </div>
        )}

        <button
          disabled={!canConfirm}
          onClick={() => setConfirmOpen(true)}
          className="w-full rounded-xl bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 py-3 text-sm font-semibold disabled:opacity-40"
        >
          Оформить продажу
        </button>
      </div>

      <Modal
        open={confirmOpen}
        onClose={() => !submitting && setConfirmOpen(false)}
        title="Подтвердите продажу"
        footer={
          <>
            <button
              onClick={() => setConfirmOpen(false)}
              disabled={submitting}
              className="px-4 py-2 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              Отмена
            </button>
            <button
              onClick={submitSale}
              disabled={submitting}
              className="px-4 py-2 rounded-xl text-sm font-semibold bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 flex items-center gap-2 disabled:opacity-60"
            >
              {submitting && <Loader2 className="animate-spin" size={14} />}
              Подтвердить
            </button>
          </>
        }
      >
        <div className="space-y-2 text-sm">
          {cart.map((l) => (
            <div key={l.product.id} className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-300">
                {l.product.name} ×{formatQty(l.quantity)}
              </span>
              <span className="font-medium tabular-nums">{formatMoney(l.finalPrice * l.quantity)}</span>
            </div>
          ))}
          <div className="border-t border-gray-100 dark:border-gray-800 pt-2 space-y-1">
            <div className="flex justify-between text-gray-500">
              <span>Сумма по прайсу</span>
              <span className="tabular-nums">{formatMoney(subtotal)}</span>
            </div>
            {discountTotal > 0 && (
              <div className="flex justify-between text-amber-600">
                <span>Скидка</span>
                <span className="tabular-nums">−{formatMoney(discountTotal)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-semibold text-gray-900 dark:text-gray-100">
              <span>Итого к оплате</span>
              <span className="tabular-nums">{formatMoney(total)}</span>
            </div>
            <div className="text-gray-500 pt-1">
              Оплата: {splitMode ? 'смешанная' : PAYMENT_OPTIONS.find((o) => o.value === payMethod)?.label}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  )
}

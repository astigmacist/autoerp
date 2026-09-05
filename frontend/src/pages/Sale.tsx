import { useEffect, useMemo, useRef, useState } from 'react'
import { Search, Trash2, Plus, Minus, Loader2, AlertTriangle, RotateCcw, Tag } from 'lucide-react'
import { api, getApiError } from '@/api/client'
import { useProductSearch, useWarehouses } from '@/api/queries'
import { useAuth } from '@/store/auth'
import { useToast } from '@/store/toast'
import { formatMoney, formatQty } from '@/lib/format'
import Modal from '@/components/Modal'
import ShiftBar from '@/components/ShiftBar'
import type { PaymentMethod, ProductSearchResult, Sale } from '@/api/types'
import { fieldClass } from '@/components/ui'

interface CartLine {
  product: ProductSearchResult
  quantity: number
  /** Цена продажи за единицу — то, что продавец может снизить при торге. */
  finalPrice: number
}

const PAYMENT_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: 'Наличные' },
  { value: 'kaspi_qr', label: 'Kaspi QR' },
  { value: 'card', label: 'Карта' },
]

/** Быстрые скидки — самые ходовые значения при торге в зале. */
const QUICK_DISCOUNTS = [5, 10, 15]

function uuid() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`
}

function discountPercent(base: number, price: number): number {
  if (!base || price >= base) return 0
  return ((base - price) / base) * 100
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

  /** Скидка в процентах от прайсовой цены — считаем цену продажи за продавца. */
  function applyDiscount(id: string, percent: number) {
    setCart((prev) =>
      prev.map((l) => {
        if (l.product.id !== id) return l
        const base = parseFloat(l.product.sale_price)
        return { ...l, finalPrice: Math.max(0, Math.round(base * (1 - percent / 100))) }
      })
    )
  }

  function resetPrice(id: string) {
    setCart((prev) =>
      prev.map((l) => (l.product.id === id ? { ...l, finalPrice: parseFloat(l.product.sale_price) } : l))
    )
  }

  function removeLine(id: string) {
    setCart((prev) => prev.filter((l) => l.product.id !== id))
  }

  const subtotal = cart.reduce((s, l) => s + parseFloat(l.product.sale_price) * l.quantity, 0)
  const total = cart.reduce((s, l) => s + l.finalPrice * l.quantity, 0)
  const discountTotal = subtotal - total
  const discountPct = discountPercent(subtotal, total)
  const change = payMethod === 'cash' && customerReceived ? Math.max(0, parseFloat(customerReceived) - total) : null

  const limit = permissions?.discount_limit_percent
  const isOverLimit = (l: CartLine) => {
    const base = parseFloat(l.product.sale_price)
    if (!base || limit === null || limit === undefined) return false
    return discountPercent(base, l.finalPrice) > limit
  }
  const overLimitLines = cart.filter(isOverLimit)
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
    <div className="lg:grid lg:grid-cols-[1fr_380px] lg:gap-4 space-y-4 lg:space-y-0">
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
            className={`${fieldClass} h-12 rounded-2xl pl-10 text-base sm:text-sm`}
          />
          {isFetching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-gray-400" size={16} />}
        </div>

        {query.trim().length >= 2 && (
          <div className="rounded-2xl border border-line bg-surface divide-y divide-line max-h-80 overflow-y-auto">
            {results?.length === 0 && <div className="p-4 text-sm text-gray-400">Ничего не найдено</div>}
            {results?.map((p) => (
              <button
                key={p.id}
                onClick={() => addToCart(p)}
                className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium text-fg truncate">{p.name}</div>
                  <div className="text-xs text-gray-400">{p.sku} {p.oem_code && `· ${p.oem_code}`}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-semibold tabular-nums">{formatMoney(p.sale_price)}</div>
                  <div className={`text-xs ${p.shop_qty < p.min_stock ? 'text-red-600 dark:text-red-400' : 'text-gray-400'}`}>
                    на витрине: {formatQty(p.shop_qty)}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Корзина. Карточками, а не таблицей: на телефоне таблица с ценой,
            количеством и скидкой не помещается, а на компьютере карточка
            позволяет крупно показать и прайс, и цену продажи, и размер скидки. */}
        {cart.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line-strong px-4 py-12 text-center text-sm text-gray-400">
            Корзина пуста. Найдите товар в строке поиска выше.
          </div>
        ) : (
          <div className="space-y-2">
            {cart.map((l) => {
              const base = parseFloat(l.product.sale_price)
              const pct = discountPercent(base, l.finalPrice)
              const hasDiscount = pct > 0
              const overLimit = isOverLimit(l)
              return (
                <div
                  key={l.product.id}
                  className={`rounded-2xl border bg-surface p-3 sm:p-4 ${
                    overLimit
                      ? 'border-amber-300 dark:border-amber-800'
                      : 'border-line'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium text-fg">{l.product.name}</div>
                      <div className="text-xs text-gray-400">{l.product.sku}</div>
                    </div>
                    <button
                      onClick={() => removeLine(l.product.id)}
                      aria-label="Убрать из корзины"
                      className="shrink-0 flex h-9 w-9 items-center justify-center rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  {/* На телефоне два поля делят ширину пополам, на большом
                      экране растягивать их на пол-карточки незачем. */}
                  <div className="mt-3 grid grid-cols-2 sm:grid-cols-[11rem_13rem] gap-3">
                    <div>
                      <div className="text-xs text-fg-muted mb-1">Количество</div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => updateQty(l.product.id, l.quantity - 1)}
                          aria-label="Меньше"
                          className="h-10 w-10 shrink-0 rounded-xl border border-line-strong flex items-center justify-center text-gray-600 dark:text-gray-300"
                        >
                          <Minus size={14} />
                        </button>
                        <input
                          inputMode="decimal"
                          value={l.quantity}
                          onChange={(e) => updateQty(l.product.id, parseFloat(e.target.value) || 0)}
                          className="w-full min-w-0 h-10 text-center rounded-xl border border-line-strong bg-transparent outline-none tabular-nums text-fg"
                        />
                        <button
                          onClick={() => updateQty(l.product.id, l.quantity + 1)}
                          aria-label="Больше"
                          className="h-10 w-10 shrink-0 rounded-xl border border-line-strong flex items-center justify-center text-gray-600 dark:text-gray-300"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>

                    <div>
                      <div className="text-xs text-fg-muted mb-1">Цена продажи, ₸</div>
                      <input
                        inputMode="numeric"
                        value={l.finalPrice}
                        onChange={(e) => updatePrice(l.product.id, parseFloat(e.target.value) || 0)}
                        className={`w-full h-10 rounded-xl border bg-transparent px-3 text-right outline-none tabular-nums font-semibold ${
                          hasDiscount
                            ? 'border-amber-300 dark:border-amber-800 text-amber-600 dark:text-amber-400'
                            : 'border-line-strong text-fg'
                        }`}
                      />
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-xs">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="text-fg-muted">
                        Цена по прайсу <span className={`tabular-nums ${hasDiscount ? 'line-through' : ''}`}>{formatMoney(base)}</span>
                      </span>
                      {hasDiscount ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 font-medium text-amber-700 dark:text-amber-300">
                          <Tag size={11} />
                          Скидка −{formatMoney((base - l.finalPrice) * l.quantity)} ({pct.toFixed(pct < 10 ? 1 : 0)}%)
                        </span>
                      ) : (
                        <span className="text-gray-400">Без скидки</span>
                      )}
                    </div>
                    <div className="ml-auto font-semibold text-sm tabular-nums text-fg">
                      {formatMoney(l.finalPrice * l.quantity)}
                    </div>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {QUICK_DISCOUNTS.map((d) => (
                      <button
                        key={d}
                        onClick={() => applyDiscount(l.product.id, d)}
                        className="rounded-lg border border-line-strong px-2.5 py-1 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                      >
                        −{d}%
                      </button>
                    ))}
                    {hasDiscount && (
                      <button
                        onClick={() => resetPrice(l.product.id)}
                        className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                      >
                        <RotateCcw size={11} /> Вернуть прайс
                      </button>
                    )}
                    {overLimit && (
                      <span className="text-xs text-amber-700 dark:text-amber-300">
                        выше лимита {limit}%
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Панель оплаты: справа на компьютере, внизу страницы на телефоне */}
      <div className="rounded-2xl border border-line bg-surface p-4 h-fit lg:sticky lg:top-4 space-y-4">
        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between text-fg-muted">
            <span>Сумма по прайсу</span>
            <span className="tabular-nums">{formatMoney(subtotal)}</span>
          </div>
          {discountTotal > 0 && (
            <div className="flex justify-between text-amber-600 dark:text-amber-400">
              <span>Скидка {discountPct >= 0.5 && `(${discountPct.toFixed(discountPct < 10 ? 1 : 0)}%)`}</span>
              <span className="tabular-nums">−{formatMoney(discountTotal)}</span>
            </div>
          )}
          <div className="flex justify-between text-lg font-semibold text-fg pt-1 border-t border-line">
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
                  className={`rounded-xl border px-2 py-3 text-sm font-medium transition-colors ${
                    payMethod === opt.value
                      ? 'border-gray-900 dark:border-gray-100 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900'
                      : 'border-line-strong text-gray-600 dark:text-gray-300'
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
                    inputMode="numeric"
                    value={splitAmounts[opt.value] || ''}
                    onChange={(e) =>
                      setSplitAmounts((prev) => ({ ...prev, [opt.value]: parseFloat(e.target.value) || 0 }))
                    }
                    className={`flex-1 ${fieldClass} h-10 text-right tabular-nums`}
                    placeholder="0"
                  />
                </div>
              ))}
              <div className={`text-xs text-right ${Math.abs(splitSum - total) < 0.01 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                Введено: {formatMoney(splitSum)} из {formatMoney(total)}
              </div>
            </div>
          )}
        </div>

        {!splitMode && payMethod === 'cash' && (
          <div>
            <label className="text-xs text-fg-muted">Получено наличными</label>
            <input
              type="number"
              inputMode="numeric"
              value={customerReceived}
              onChange={(e) => setCustomerReceived(e.target.value)}
              className={`mt-1 ${fieldClass} h-11 text-right tabular-nums`}
              placeholder={String(total)}
            />
            {change !== null && customerReceived && (
              <div className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">Сдача: {formatMoney(change)}</div>
            )}
          </div>
        )}

        {/* На телефоне ту же кнопку показывает закреплённая внизу полоса итога,
            и две одинаковые кнопки подряд только путали. */}
        <button
          disabled={!canConfirm}
          onClick={() => setConfirmOpen(true)}
          className="hidden h-12 w-full items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 text-sm font-semibold text-white transition-transform hover:bg-gray-800 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 lg:inline-flex dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
        >
          Оформить продажу
        </button>
      </div>

      {/* Итог и кнопка всегда под рукой на телефоне: корзина длинная, а
          прокручивать вниз к панели оплаты ради каждой продажи неудобно. */}
      {cart.length > 0 && (
        <div className="lg:hidden fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 border-t border-line bg-surface/95 backdrop-blur px-4 py-2.5 shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">
          <div className="flex items-center gap-3">
            <div className="min-w-0">
              <div className="text-[11px] text-fg-muted">
                Итого{discountTotal > 0 && ` · скидка ${formatMoney(discountTotal)}`}
              </div>
              <div className="text-lg font-semibold tabular-nums text-fg leading-tight">
                {formatMoney(total)}
              </div>
            </div>
            <button
              disabled={!canConfirm}
              onClick={() => setConfirmOpen(true)}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 text-sm font-semibold text-white transition-transform hover:bg-gray-800 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white ml-auto h-12 shrink-0 px-5"
            >
              Оформить
            </button>
          </div>
        </div>
      )}

      {/* Пустое место под плавающей панелью итога, иначе она закрывает
          нижнюю часть корзины при прокрутке до конца. */}
      {cart.length > 0 && <div className="lg:hidden h-24" aria-hidden />}

      <Modal
        open={confirmOpen}
        onClose={() => !submitting && setConfirmOpen(false)}
        title="Подтвердите продажу"
        footer={
          <>
            <button
              onClick={() => setConfirmOpen(false)}
              disabled={submitting}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold text-fg-muted transition-transform hover:bg-surface-muted hover:text-fg active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40"
            >
              Отмена
            </button>
            <button
              onClick={submitSale}
              disabled={submitting}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 text-sm font-semibold text-white transition-transform hover:bg-gray-800 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
            >
              {submitting && <Loader2 className="animate-spin" size={14} />}
              Подтвердить
            </button>
          </>
        }
      >
        <div className="space-y-2 text-sm">
          {cart.map((l) => {
            const base = parseFloat(l.product.sale_price)
            const pct = discountPercent(base, l.finalPrice)
            return (
              <div key={l.product.id} className="flex justify-between gap-3">
                <span className="text-gray-600 dark:text-gray-300 min-w-0">
                  {l.product.name} ×{formatQty(l.quantity)}
                  {pct > 0 && (
                    <span className="block text-xs text-amber-600 dark:text-amber-400">
                      {formatMoney(base)} → {formatMoney(l.finalPrice)} (−{pct.toFixed(pct < 10 ? 1 : 0)}%)
                    </span>
                  )}
                </span>
                <span className="font-medium tabular-nums shrink-0">{formatMoney(l.finalPrice * l.quantity)}</span>
              </div>
            )
          })}
          <div className="border-t border-line pt-2 space-y-1">
            <div className="flex justify-between text-fg-muted">
              <span>Сумма по прайсу</span>
              <span className="tabular-nums">{formatMoney(subtotal)}</span>
            </div>
            {discountTotal > 0 && (
              <div className="flex justify-between text-amber-600 dark:text-amber-400">
                <span>Скидка</span>
                <span className="tabular-nums">−{formatMoney(discountTotal)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-semibold text-fg">
              <span>Итого к оплате</span>
              <span className="tabular-nums">{formatMoney(total)}</span>
            </div>
            <div className="text-fg-muted pt-1">
              Оплата: {splitMode ? 'смешанная' : PAYMENT_OPTIONS.find((o) => o.value === payMethod)?.label}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  )
}

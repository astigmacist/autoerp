import { useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import clsx from 'clsx'
import { Search, Trash2, Plus, Minus, Loader2, AlertTriangle, RotateCcw, Percent, X, ShoppingCart } from 'lucide-react'
import { api, getApiError } from '@/api/client'
import { useCurrentShift, useProductSearch, useWarehouses } from '@/api/queries'
import { useAuth } from '@/store/auth'
import { useToast } from '@/store/toast'
import { formatMoney, formatQty } from '@/lib/format'
import { useDebounced } from '@/lib/useDebounced'
import Modal from '@/components/Modal'
import ShiftBar from '@/components/ShiftBar'
import type { PaymentMethod, ProductSearchResult, Sale } from '@/api/types'
import { SkeletonList, fieldClass } from '@/components/ui'

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

/**
 * Есть ли физическая клавиатура. На телефоне автофокус в поиск выбрасывает
 * экранную клавиатуру на пол-экрана ещё до того, как продавец решил что-то
 * искать, — и первое, что он видит вместо товаров, это клавиши.
 */
function hasHardwareKeyboard(): boolean {
  try {
    return window.matchMedia('(pointer: fine)').matches
  } catch {
    return false
  }
}

/**
 * Сколько покупатель мог дать наличными: сама сумма (без сдачи), округления
 * вверх и ближайшая крупная купюра. Быстрее, чем набирать число руками.
 */
function cashSuggestions(total: number): number[] {
  if (total <= 0) return []
  const values = new Set<number>([Math.ceil(total)])
  for (const step of [500, 1000, 5000]) {
    const up = Math.ceil(total / step) * step
    if (up > total) values.add(up)
  }
  for (const bill of [1000, 2000, 5000, 10000, 20000]) {
    if (bill > total) {
      values.add(bill)
      break
    }
  }
  return [...values].sort((a, b) => a - b).slice(0, 4)
}

/**
 * Цена продажи в строке чека. Обычный `<input type=number>` показывал «12000»
 * рядом с «12 000 ₸» в остальном интерфейсе — на такое число смотришь дважды.
 * Пока поле не в фокусе, число с разрядами; при вводе — как набирают.
 */
function PriceInput({
  value, onChange, highlighted,
}: {
  value: number
  onChange: (value: number) => void
  highlighted: boolean
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const shown = draft ?? new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(value)
  return (
    <div className="relative min-w-0 flex-1">
      <input
        inputMode="numeric"
        value={shown}
        aria-label="Цена продажи"
        onFocus={() => setDraft(String(value))}
        onChange={(e) => {
          setDraft(e.target.value)
          onChange(parseFloat(e.target.value.replace(/\s/g, '')) || 0)
        }}
        onBlur={() => setDraft(null)}
        className={clsx(
          'h-9 w-full rounded-lg border bg-transparent pr-6 pl-2.5 text-right text-sm font-semibold tabular-nums outline-none',
          highlighted
            ? 'border-amber-300 text-amber-600 dark:border-amber-800 dark:text-amber-400'
            : 'border-line-strong text-fg',
        )}
      />
      <span className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-xs text-fg-muted">₸</span>
    </div>
  )
}

export default function SalePage() {
  const { data: warehouses } = useWarehouses()
  const { data: shift } = useCurrentShift()
  const shop = useMemo(() => warehouses?.find((w) => w.is_sellable), [warehouses])
  const { permissions } = useAuth()
  const { push } = useToast()
  const qc = useQueryClient()

  const [query, setQuery] = useState('')
  // Пауза перед запросом: сканер штрихкода «печатает» строку мгновенно, а
  // человек — по букве, и каждая буква не должна лететь на сервер.
  const { data: results, isFetching } = useProductSearch(useDebounced(query, 250))
  const [cart, setCart] = useState<CartLine[]>([])
  const [payMethod, setPayMethod] = useState<PaymentMethod>('cash')
  const [splitMode, setSplitMode] = useState(false)
  const [splitAmounts, setSplitAmounts] = useState<Record<PaymentMethod, number>>({ cash: 0, kaspi_qr: 0, card: 0, transfer: 0 })
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [idempotencyKey, setIdempotencyKey] = useState(uuid())
  const [customerReceived, setCustomerReceived] = useState<string>('')
  /** У какой позиции сейчас раскрыты быстрые скидки. */
  const [discountFor, setDiscountFor] = useState<string | null>(null)
  /** На телефоне каталог и чек не помещаются рядом — это две вкладки. */
  const [mobileTab, setMobileTab] = useState<'catalog' | 'cart'>('catalog')
  const searchRef = useRef<HTMLInputElement>(null)

  function focusSearch() {
    if (hasHardwareKeyboard()) searchRef.current?.focus()
  }

  useEffect(() => {
    focusSearch()
  }, [])

  const cartQty = (id: string) => cart.find((l) => l.product.id === id)?.quantity ?? 0

  function addToCart(product: ProductSearchResult) {
    setCart((prev) => {
      const existing = prev.find((l) => l.product.id === product.id)
      if (existing) {
        if (existing.quantity >= product.shop_qty) {
          push(`«${product.name}» — на витрине только ${formatQty(product.shop_qty)}`, 'error')
          return prev
        }
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
  const totalItems = cart.reduce((s, l) => s + l.quantity, 0)
  const change =
    !splitMode && payMethod === 'cash' && customerReceived
      ? Math.max(0, parseFloat(customerReceived) - total)
      : null

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
    setMobileTab('catalog')
    setQuery('')
    focusSearch()
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
      // Каталог кассы показывает остатки зала — после продажи они другие.
      qc.invalidateQueries({ queryKey: ['product-search'] })
      qc.invalidateQueries({ queryKey: ['stock'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      qc.invalidateQueries({ queryKey: ['sales'] })
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
  const searching = query.trim().length >= 2

  return (
    <div className="space-y-4">
      <ShiftBar />

      {/* На телефоне каталог и чек — две вкладки: иначе чек уезжает под
          длинный список товаров, и до итога надо прокручивать всю витрину. */}
      {cart.length > 0 && (
        <div className="lg:hidden grid grid-cols-2 gap-1 rounded-xl bg-surface-muted p-1">
          {(
            [
              ['catalog', 'Товары'],
              ['cart', `Чек · ${cart.length}`],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setMobileTab(key)}
              className={clsx(
                'h-9 rounded-lg text-sm font-medium transition-colors',
                mobileTab === key ? 'bg-surface text-fg shadow-card' : 'text-fg-muted',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      <div className="lg:grid lg:grid-cols-[1fr_380px] lg:gap-4 lg:items-start">
        {/* ── Каталог ───────────────────────────────────────────────── */}
        <div className={clsx('space-y-3', cart.length > 0 && mobileTab === 'cart' && 'hidden lg:block')}>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-fg-muted" size={18} />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Название, код, OEM или штрихкод"
              className={`${fieldClass} h-12 rounded-2xl pr-10 pl-10 text-base sm:text-sm`}
            />
            {query ? (
              <button
                onClick={() => {
                  setQuery('')
                  focusSearch()
                }}
                aria-label="Очистить поиск"
                className="absolute top-1/2 right-2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-fg-muted hover:bg-surface-muted hover:text-fg"
              >
                <X size={16} />
              </button>
            ) : (
              isFetching && <Loader2 className="absolute top-1/2 right-3.5 -translate-y-1/2 animate-spin text-fg-muted" size={16} />
            )}
          </div>

          <div className="flex items-baseline justify-between px-0.5">
            <span className="text-xs font-semibold tracking-wide text-fg-muted uppercase">
              {searching ? 'Найдено' : 'На витрине'}
            </span>
            {results && results.length > 0 && <span className="text-xs text-fg-muted">{results.length}</span>}
          </div>

          {!results ? (
            <SkeletonList rows={4} />
          ) : results.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-line-strong px-4 py-10 text-center text-sm text-fg-muted">
              {searching ? 'Ничего не найдено — проверьте код или название' : 'В зале пока нет товаров'}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
              {results.map((p) => {
                const inCart = cartQty(p.id)
                const soldOut = p.shop_qty <= 0
                return (
                  <button
                    key={p.id}
                    onClick={() => addToCart(p)}
                    disabled={soldOut}
                    className={clsx(
                      'flex w-full items-center justify-between gap-3 rounded-xl border bg-surface px-3 py-2.5 text-left transition-colors',
                      soldOut
                        ? 'cursor-not-allowed border-line opacity-50'
                        : inCart
                          ? 'border-gray-900 dark:border-gray-100'
                          : 'border-line hover:border-line-strong hover:bg-surface-muted active:scale-[0.99]',
                    )}
                  >
                    <div className="min-w-0">
                      <div className="line-clamp-2 text-sm leading-snug font-medium text-fg">{p.name}</div>
                      <div className="mt-0.5 truncate text-xs text-fg-muted">
                        {p.sku}
                        {p.oem_code && ` · ${p.oem_code}`}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2.5">
                      <div className="text-right">
                        <div className="text-sm font-semibold tabular-nums text-fg">{formatMoney(p.sale_price)}</div>
                        <div
                          className={clsx(
                            'text-xs tabular-nums',
                            soldOut
                              ? 'text-fg-muted'
                              : p.shop_qty < p.min_stock
                                ? 'text-red-600 dark:text-red-400'
                                : 'text-fg-muted',
                          )}
                        >
                          {soldOut ? 'нет в зале' : `${formatQty(p.shop_qty)} в зале`}
                        </div>
                      </div>
                      <span
                        className={clsx(
                          'flex h-8 w-8 items-center justify-center rounded-lg text-sm font-semibold tabular-nums',
                          inCart
                            ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900'
                            : 'bg-surface-muted text-fg-muted',
                        )}
                      >
                        {inCart || <Plus size={15} />}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Чек ───────────────────────────────────────────────────── */}
        <div
          className={clsx(
            'mt-4 space-y-3 lg:sticky lg:top-4 lg:mt-0',
            cart.length > 0 && mobileTab === 'catalog' && 'hidden lg:block',
            cart.length === 0 && 'hidden lg:block',
          )}
        >
          <div className="rounded-2xl border border-line bg-surface">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <span className="text-sm font-semibold text-fg">
                Чек{cart.length > 0 && <span className="ml-1.5 font-normal text-fg-muted">{formatQty(totalItems)} шт</span>}
              </span>
              {cart.length > 0 && (
                <button
                  onClick={resetSale}
                  className="rounded-lg px-2 py-1 text-xs font-medium text-fg-muted hover:bg-surface-muted hover:text-fg"
                >
                  Очистить
                </button>
              )}
            </div>

            {cart.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <span className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-surface-muted text-fg-muted">
                  <ShoppingCart size={18} />
                </span>
                <div className="text-sm text-fg-muted">Нажмите товар слева, чтобы добавить его в чек</div>
              </div>
            ) : (
              <div className="max-h-[45vh] divide-y divide-line overflow-y-auto lg:max-h-[42vh]">
                {cart.map((l) => {
                  const base = parseFloat(l.product.sale_price)
                  const pct = discountPercent(base, l.finalPrice)
                  const hasDiscount = pct > 0
                  const overLimit = isOverLimit(l)
                  const discountOpen = discountFor === l.product.id
                  return (
                    <div key={l.product.id} className={clsx('px-3 py-2.5', overLimit && 'bg-amber-50/60 dark:bg-amber-950/20')}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-sm leading-snug font-medium text-fg">{l.product.name}</div>
                          <div className="text-xs text-fg-muted">{l.product.sku}</div>
                        </div>
                        <div className="shrink-0 text-right text-sm font-semibold tabular-nums text-fg">
                          {formatMoney(l.finalPrice * l.quantity)}
                        </div>
                      </div>

                      <div className="mt-2 flex items-center gap-1.5">
                        <div className="flex items-center rounded-lg border border-line-strong">
                          <button
                            onClick={() => updateQty(l.product.id, l.quantity - 1)}
                            aria-label="Меньше"
                            className="flex h-9 w-9 items-center justify-center rounded-l-lg text-fg-muted hover:bg-surface-muted hover:text-fg"
                          >
                            <Minus size={14} />
                          </button>
                          <input
                            inputMode="decimal"
                            value={l.quantity}
                            onChange={(e) => updateQty(l.product.id, parseFloat(e.target.value) || 0)}
                            aria-label="Количество"
                            className="h-9 w-10 border-x border-line-strong bg-transparent text-center text-sm tabular-nums text-fg outline-none focus-visible:outline-none"
                          />
                          <button
                            onClick={() => updateQty(l.product.id, l.quantity + 1)}
                            aria-label="Больше"
                            className="flex h-9 w-9 items-center justify-center rounded-r-lg text-fg-muted hover:bg-surface-muted hover:text-fg"
                          >
                            <Plus size={14} />
                          </button>
                        </div>

                        <PriceInput
                          value={l.finalPrice}
                          onChange={(v) => updatePrice(l.product.id, v)}
                          highlighted={hasDiscount}
                        />

                        <button
                          onClick={() => setDiscountFor(discountOpen ? null : l.product.id)}
                          aria-label="Скидка"
                          title="Скидка"
                          className={clsx(
                            'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border',
                            discountOpen || hasDiscount
                              ? 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                              : 'border-line-strong text-fg-muted hover:bg-surface-muted hover:text-fg',
                          )}
                        >
                          <Percent size={14} />
                        </button>

                        <button
                          onClick={() => removeLine(l.product.id)}
                          aria-label="Убрать из чека"
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-fg-muted hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>

                      {hasDiscount && (
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                          <span className="text-fg-muted tabular-nums line-through">{formatMoney(base)}</span>
                          <span className="font-medium text-amber-600 dark:text-amber-400">
                            −{pct.toFixed(pct < 10 ? 1 : 0)}%
                            {overLimit && ` · выше лимита ${limit}%`}
                          </span>
                          <button
                            onClick={() => resetPrice(l.product.id)}
                            className="ml-auto inline-flex items-center gap-1 rounded-lg px-1.5 py-0.5 text-fg-muted hover:bg-surface-muted hover:text-fg"
                          >
                            <RotateCcw size={11} /> прайс
                          </button>
                        </div>
                      )}

                      {discountOpen && (
                        <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-line pt-2">
                          <span className="mr-1 text-xs text-fg-muted">Скидка:</span>
                          {QUICK_DISCOUNTS.map((d) => (
                            <button
                              key={d}
                              onClick={() => {
                                applyDiscount(l.product.id, d)
                                setDiscountFor(null)
                              }}
                              className="rounded-lg border border-line-strong px-2.5 py-1.5 text-xs font-semibold text-fg-muted hover:bg-surface-muted hover:text-fg"
                            >
                              −{d}%
                            </button>
                          ))}
                          <button
                            onClick={() => {
                              resetPrice(l.product.id)
                              setDiscountFor(null)
                            }}
                            className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-fg-muted hover:bg-surface-muted hover:text-fg"
                          >
                            без скидки
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Итог и оплата — отдельная карточка: это другой шаг, и на него
              смотрят, когда с товарами уже разобрались. */}
          <div className="space-y-3 rounded-2xl border border-line bg-surface p-4">
            <div className="text-sm">
              {discountTotal > 0 && (
                <div className="mb-2 space-y-1.5">
                  <div className="flex justify-between text-fg-muted">
                    <span>По прайсу</span>
                    <span className="tabular-nums">{formatMoney(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-amber-600 dark:text-amber-400">
                    <span>Скидка {discountPct >= 0.5 && `${discountPct.toFixed(discountPct < 10 ? 1 : 0)}%`}</span>
                    <span className="tabular-nums">−{formatMoney(discountTotal)}</span>
                  </div>
                </div>
              )}
              <div className="flex items-baseline justify-between">
                <span className="text-fg-muted">Итого</span>
                <span className="text-2xl font-semibold tracking-tight tabular-nums text-fg">{formatMoney(total)}</span>
              </div>
            </div>

            {overLimitLines.length > 0 && (
              <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                Скидка выше лимита ({limit}%) — потребуется подтверждение владельца.
              </div>
            )}
            {!shift && (
              <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                Смена не открыта — продажа пройдёт, но в сверку кассы не попадёт.
              </div>
            )}
            {belowCostWarning && (
              <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                Цена одной из позиций равна нулю — проверьте перед подтверждением.
              </div>
            )}

            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold tracking-wide text-fg-muted uppercase">Оплата</span>
                <button
                  onClick={() => setSplitMode((v) => !v)}
                  className="rounded-lg px-2 py-1 text-xs font-medium text-fg-muted hover:bg-surface-muted hover:text-fg"
                >
                  {splitMode ? 'Один способ' : 'Разделить'}
                </button>
              </div>

              {!splitMode ? (
                <div className="grid grid-cols-3 gap-1.5">
                  {PAYMENT_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setPayMethod(opt.value)}
                      className={clsx(
                        'h-11 rounded-xl border px-2 text-sm font-medium transition-colors',
                        payMethod === opt.value
                          ? 'border-gray-900 bg-gray-900 text-white dark:border-gray-100 dark:bg-gray-100 dark:text-gray-900'
                          : 'border-line-strong text-fg-muted hover:bg-surface-muted hover:text-fg',
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {PAYMENT_OPTIONS.map((opt) => (
                    <div key={opt.value} className="flex items-center gap-2">
                      <span className="w-24 shrink-0 text-sm text-fg-muted">{opt.label}</span>
                      <input
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
                  <div
                    className={clsx(
                      'text-right text-xs tabular-nums',
                      Math.abs(splitSum - total) < 0.01
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-red-600 dark:text-red-400',
                    )}
                  >
                    Введено {formatMoney(splitSum)} из {formatMoney(total)}
                  </div>
                </div>
              )}
            </div>

            <button
              disabled={!canConfirm}
              onClick={() => setConfirmOpen(true)}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 text-sm font-semibold text-white transition-transform hover:bg-gray-800 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
            >
              Оформить продажу
            </button>
          </div>
        </div>
      </div>

      {/* Пока продавец набирает товары, итог и кнопка держатся внизу экрана —
          иначе за каждой продажей пришлось бы переключаться на вкладку чека. */}
      {cart.length > 0 && mobileTab === 'catalog' && (
        <>
          <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 border-t border-line bg-surface/95 px-4 py-2.5 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] backdrop-blur lg:hidden">
            <div className="flex items-center gap-3">
              <button onClick={() => setMobileTab('cart')} className="min-w-0 text-left">
                <div className="text-[11px] text-fg-muted">
                  Чек · {cart.length}
                  {discountTotal > 0 && ` · скидка ${formatMoney(discountTotal)}`}
                </div>
                <div className="text-lg leading-tight font-semibold tabular-nums text-fg">{formatMoney(total)}</div>
              </button>
              <button
                disabled={!canConfirm}
                onClick={() => setConfirmOpen(true)}
                className="ml-auto inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-gray-900 px-5 text-sm font-semibold text-white transition-transform active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 dark:bg-gray-100 dark:text-gray-900"
              >
                Оформить
              </button>
            </div>
          </div>
          <div className="h-24 lg:hidden" aria-hidden />
        </>
      )}

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
                <span className="min-w-0 text-fg-muted">
                  {l.product.name} ×{formatQty(l.quantity)}
                  {pct > 0 && (
                    <span className="block text-xs text-amber-600 dark:text-amber-400">
                      {formatMoney(base)} → {formatMoney(l.finalPrice)} (−{pct.toFixed(pct < 10 ? 1 : 0)}%)
                    </span>
                  )}
                </span>
                <span className="shrink-0 font-medium tabular-nums text-fg">{formatMoney(l.finalPrice * l.quantity)}</span>
              </div>
            )
          })}
          <div className="space-y-1 border-t border-line pt-2">
            {discountTotal > 0 && (
              <>
                <div className="flex justify-between text-fg-muted">
                  <span>Сумма по прайсу</span>
                  <span className="tabular-nums">{formatMoney(subtotal)}</span>
                </div>
                <div className="flex justify-between text-amber-600 dark:text-amber-400">
                  <span>Скидка</span>
                  <span className="tabular-nums">−{formatMoney(discountTotal)}</span>
                </div>
              </>
            )}
            <div className="flex justify-between text-base font-semibold text-fg">
              <span>Итого к оплате</span>
              <span className="tabular-nums">{formatMoney(total)}</span>
            </div>
            <div className="pt-1 text-fg-muted">
              Оплата: {splitMode ? 'смешанная' : PAYMENT_OPTIONS.find((o) => o.value === payMethod)?.label}
            </div>
          </div>

          {/* Сдача нужна ровно здесь — в момент, когда покупатель протягивает
              деньги. В панели оплаты это поле только просило заполнить себя. */}
          {!splitMode && payMethod === 'cash' && (
            <div className="border-t border-line pt-3">
              <div className="mb-1.5 text-xs font-medium text-fg-muted">Покупатель дал — если нужна сдача</div>
              <div className="flex flex-wrap gap-1.5">
                {cashSuggestions(total).map((v) => (
                  <button
                    key={v}
                    onClick={() => setCustomerReceived(customerReceived === String(v) ? '' : String(v))}
                    className={clsx(
                      'h-9 rounded-lg border px-2.5 text-xs font-semibold tabular-nums transition-colors',
                      customerReceived === String(v)
                        ? 'border-gray-900 bg-gray-900 text-white dark:border-gray-100 dark:bg-gray-100 dark:text-gray-900'
                        : 'border-line-strong text-fg-muted hover:bg-surface-muted hover:text-fg',
                    )}
                  >
                    {formatMoney(v)}
                  </button>
                ))}
                <div className="relative min-w-24 flex-1">
                  <input
                    inputMode="numeric"
                    value={cashSuggestions(total).includes(Number(customerReceived)) ? '' : customerReceived}
                    onChange={(e) => setCustomerReceived(e.target.value)}
                    aria-label="Получено наличными"
                    placeholder="другая сумма"
                    className="h-9 w-full rounded-lg border border-line-strong bg-transparent pr-6 pl-2.5 text-right text-sm font-semibold tabular-nums text-fg outline-none placeholder:font-normal placeholder:text-gray-400 dark:placeholder:text-gray-500"
                  />
                  <span className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-xs text-fg-muted">₸</span>
                </div>
              </div>
              {change !== null && (
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-fg-muted">Сдача</span>
                  <span className="text-lg font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                    {formatMoney(change)}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}

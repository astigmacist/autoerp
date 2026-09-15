import { useQuery } from '@tanstack/react-query'
import type { UseQueryResult } from '@tanstack/react-query'
import { useState } from 'react'
import { Download, Loader2, PackageX, Tag } from 'lucide-react'
import { api, getApiError } from '@/api/client'
import { useAuth } from '@/store/auth'
import { useToast } from '@/store/toast'
import { formatMoney, formatQty, todayIso } from '@/lib/format'
import { triggerDownload } from '@/lib/download'
import { Card, EmptyState, SkeletonList, fieldClass } from '@/components/ui'
import clsx from 'clsx'

const PAYMENT_LABELS: Record<string, string> = { cash: 'Наличные', kaspi_qr: 'Kaspi QR', card: 'Карта', transfer: 'Перевод' }

interface DailyReport {
  date: string
  finance: {
    revenue: number
    revenue_by_payment: { method: string; amount: number }[]
    returns_amount: number
    net_revenue: number
    discount_total: number
    avg_discount_pct: number
    sales_count: number
    avg_check: number
    cost_total?: number
    profit?: number
    margin_pct?: number
  }
  items: { product__name: string; product__sku: string; qty: number; amount_base: number; amount_fact: number; discount: number; cost?: number; profit?: number }[]
  sellers: { seller__id: number; seller__first_name: string; seller__last_name: string; count: number; revenue: number; discount: number; profit?: number }[]
}

interface DiscountsReport {
  by_product: { product__name: string; product__sku: string; total_discount: number; qty: number }[]
  by_seller: { seller__first_name: string; seller__last_name: string; total_discount: number; sales_count: number }[]
}

interface DeadStockRow {
  product_id: string
  product_name: string
  sku: string
  quantity: number
  frozen_amount: number
}

type Tab = 'daily' | 'discounts' | 'dead'

const TABS: { key: Tab; label: string }[] = [
  { key: 'daily', label: 'За день' },
  { key: 'discounts', label: 'Скидки' },
  { key: 'dead', label: 'Залежалось' },
]

/** Первое число месяца — разумное начало периода для отчёта по скидкам. */
function monthStart(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

export default function Reports() {
  const [tab, setTab] = useState<Tab>('daily')
  const [from, setFrom] = useState(monthStart())
  const [to, setTo] = useState(todayIso())
  const [deadDays, setDeadDays] = useState(90)
  const [date, setDate] = useState(todayIso())
  const { permissions } = useAuth()
  const { push } = useToast()
  const [exporting, setExporting] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['daily-report', date],
    queryFn: async () => (await api.get<DailyReport>('/reports/daily/', { params: { date } })).data,
    enabled: tab === 'daily',
  })

  const discounts = useQuery({
    queryKey: ['discounts-report', from, to],
    queryFn: async () =>
      (await api.get<DiscountsReport>('/reports/discounts/', { params: { date_from: from, date_to: to } })).data,
    enabled: tab === 'discounts',
  })

  const dead = useQuery({
    queryKey: ['dead-stock', deadDays],
    queryFn: async () => (await api.get<DeadStockRow[]>('/reports/dead-stock/', { params: { days: deadDays } })).data,
    enabled: tab === 'dead',
  })

  async function exportExcel() {
    setExporting(true)
    try {
      const res = await api.get('/reports/daily/export/', { params: { date }, responseType: 'blob' })
      triggerDownload(res.data, `AutoZap_otchet_${date}.xlsx`)
    } catch (err) {
      push(getApiError(err).detail, 'error')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-fg">Отчёты</h1>

      {/* Три вопроса, которые задают отчётам: что было за день, сколько
          раздали скидками и что лежит мёртвым грузом. */}
      <div className="-mx-1 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="inline-flex gap-1 rounded-xl border border-line bg-surface p-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={clsx(
                'rounded-lg px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors',
                tab === t.key
                  ? 'bg-gray-900 text-white shadow-card dark:bg-gray-100 dark:text-gray-900'
                  : 'text-fg-muted hover:bg-surface-muted hover:text-fg',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'discounts' && <DiscountsTab query={discounts} from={from} to={to} setFrom={setFrom} setTo={setTo} />}
      {tab === 'dead' && <DeadStockTab query={dead} days={deadDays} setDays={setDeadDays} />}

      {tab === 'daily' && (
      <>
      <div className="flex flex-wrap items-center gap-2">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`${fieldClass} h-11 md:h-10 w-auto`} />
        <button
          onClick={exportExcel}
          disabled={exporting || isLoading}
          className="inline-flex h-11 md:h-10 items-center justify-center gap-1.5 rounded-xl border border-line-strong bg-surface px-3 text-sm font-semibold text-fg transition-transform hover:bg-surface-muted active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40"
        >
          {exporting ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />} Excel
        </button>
      </div>

      {isLoading || !data ? (
        <div className="text-gray-400 text-sm">Загрузка…</div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Выручка" value={formatMoney(data.finance.revenue)} />
            <Stat label="Чеков" value={String(data.finance.sales_count)} />
            <Stat label="Средний чек" value={formatMoney(data.finance.avg_check)} />
            <Stat label="Скидки" value={`${formatMoney(data.finance.discount_total)} (${data.finance.avg_discount_pct}%)`} />
            {permissions?.can_see_cost && data.finance.profit !== undefined && (
              <>
                <Stat label="Валовая прибыль" value={formatMoney(data.finance.profit)} />
                <Stat label="Рентабельность" value={`${data.finance.margin_pct}%`} />
              </>
            )}
            <Stat label="Возвраты" value={formatMoney(data.finance.returns_amount)} />
            <Stat label="Чистая выручка" value={formatMoney(data.finance.net_revenue)} />
          </div>

          <div className="rounded-2xl border border-line bg-surface p-4">
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">По способам оплаты</div>
            <div className="flex flex-wrap gap-4">
              {data.finance.revenue_by_payment.length === 0 && <span className="text-sm text-gray-400">Нет данных</span>}
              {data.finance.revenue_by_payment.map((p) => (
                <div key={p.method} className="text-sm">
                  <span className="text-gray-500">{PAYMENT_LABELS[p.method] ?? p.method}: </span>
                  <span className="font-semibold tabular-nums">{formatMoney(p.amount)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-line bg-surface">
            <div className="border-b border-line px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300">
              Проданные товары
            </div>

            {data.items.length === 0 && (
              <div className="px-4 py-6 text-center text-sm text-fg-muted">Продаж не было</div>
            )}

            {/* На телефоне таблица из пяти колонок уезжает вбок — там карточки. */}
            <div className="divide-y divide-line md:hidden">
              {data.items.map((i) => (
                <div key={i.product__sku} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm leading-snug text-fg">{i.product__name}</div>
                      <div className="text-xs text-fg-muted">{i.product__sku}</div>
                    </div>
                    <div className="shrink-0 text-right text-sm font-semibold tabular-nums text-fg">
                      {formatMoney(i.amount_fact)}
                    </div>
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-x-3 text-xs text-fg-muted">
                    <span className="tabular-nums">{formatQty(i.qty)} шт</span>
                    {i.discount > 0 && (
                      <>
                        <span className="tabular-nums line-through">{formatMoney(i.amount_base)}</span>
                        <span className="tabular-nums text-amber-600 dark:text-amber-400">
                          −{formatMoney(i.discount)}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead className="text-fg-muted">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">Товар</th>
                    <th className="px-2 py-2 text-right font-medium">Кол-во</th>
                    <th className="px-2 py-2 text-right font-medium">По прайсу</th>
                    <th className="px-2 py-2 text-right font-medium">Факт</th>
                    <th className="px-4 py-2 text-right font-medium">Скидка</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {data.items.map((i) => (
                    <tr key={i.product__sku}>
                      <td className="px-4 py-2">
                        <div className="text-fg">{i.product__name}</div>
                        <div className="text-xs text-fg-muted">{i.product__sku}</div>
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">{formatQty(i.qty)}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{formatMoney(i.amount_base)}</td>
                      <td className="px-2 py-2 text-right font-medium tabular-nums">{formatMoney(i.amount_fact)}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-amber-600 dark:text-amber-400">
                        {i.discount > 0 ? `−${formatMoney(i.discount)}` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {data.sellers.length > 1 && (
            <div className="rounded-2xl border border-line bg-surface p-4">
              <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">По продавцам</div>
              <div className="space-y-2">
                {data.sellers.map((s) => (
                  <div key={s.seller__id} className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-300">{s.seller__first_name} {s.seller__last_name} · {s.count} чеков</span>
                    <span className="font-medium tabular-nums">{formatMoney(s.revenue)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
      </>
      )}
    </div>
  )
}

/** Плитка показателя. Оформлена так же, как карточки на дашборде: одни и те же
    числа не должны выглядеть по-разному на разных экранах. */
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4 shadow-card">
      <div className="text-xs font-medium text-fg-muted">{label}</div>
      <div className="mt-2 text-2xl font-semibold tracking-tight tabular-nums text-fg">{value}</div>
    </div>
  )
}

/** Отчёт по скидкам: сколько магазин раздал за период и кто именно. */
function DiscountsTab({
  query, from, to, setFrom, setTo,
}: {
  query: UseQueryResult<DiscountsReport>
  from: string
  to: string
  setFrom: (v: string) => void
  setTo: (v: string) => void
}) {
  const data = query.data
  const total = (data?.by_product ?? []).reduce((s, r) => s + Number(r.total_discount), 0)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label className="text-xs font-medium text-fg-muted">С даты</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={`mt-1 ${fieldClass} h-11 md:h-10 w-auto`} />
        </div>
        <div>
          <label className="text-xs font-medium text-fg-muted">По дату</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={`mt-1 ${fieldClass} h-11 md:h-10 w-auto`} />
        </div>
      </div>

      {query.isLoading && <SkeletonList rows={4} />}

      {!query.isLoading && data && (
        <>
          <Stat label="Скидок за период" value={formatMoney(total)} />

          <Card padded={false}>
            <div className="border-b border-line px-4 py-3 text-sm font-medium text-fg">По товарам</div>
            {data.by_product.length === 0 ? (
              <EmptyState icon={<Tag size={20} />} title="Скидок за период не было" />
            ) : (
              <div className="divide-y divide-line">
                {data.by_product.map((r) => (
                  <div key={r.product__sku} className="flex items-start justify-between gap-3 px-4 py-2.5">
                    <div className="min-w-0">
                      <div className="text-sm leading-snug text-fg">{r.product__name}</div>
                      <div className="text-xs text-fg-muted">
                        {r.product__sku} · {formatQty(r.qty)} шт
                      </div>
                    </div>
                    <div className="shrink-0 text-sm font-semibold tabular-nums text-amber-600 dark:text-amber-400">
                      −{formatMoney(r.total_discount)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {data.by_seller.length > 0 && (
            <Card padded={false}>
              <div className="border-b border-line px-4 py-3 text-sm font-medium text-fg">По продавцам</div>
              <div className="divide-y divide-line">
                {data.by_seller.map((r, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <div className="min-w-0 text-sm text-fg">
                      {`${r.seller__first_name ?? ''} ${r.seller__last_name ?? ''}`.trim() || 'Без продавца'}
                      <span className="ml-2 text-xs text-fg-muted">{r.sales_count} продаж</span>
                    </div>
                    <div className="shrink-0 text-sm font-semibold tabular-nums text-amber-600 dark:text-amber-400">
                      −{formatMoney(r.total_discount)}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  )
}

/** Залежавшийся товар: лежит на складе и не продавался. Это замороженные деньги. */
function DeadStockTab({
  query, days, setDays,
}: {
  query: UseQueryResult<DeadStockRow[]>
  days: number
  setDays: (v: number) => void
}) {
  const rows = query.data ?? []
  const frozen = rows.reduce((s, r) => s + Number(r.frozen_amount), 0)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-sm text-fg-muted">Не продавалось:</span>
        {[30, 60, 90, 180].map((d) => (
          <button
            key={d}
            onClick={() => setDays(d)}
            className={clsx(
              'h-9 rounded-lg px-3 text-sm font-medium transition-colors',
              days === d
                ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900'
                : 'border border-line-strong text-fg-muted hover:bg-surface-muted hover:text-fg',
            )}
          >
            {d} дней
          </button>
        ))}
      </div>

      {query.isLoading && <SkeletonList rows={4} />}

      {!query.isLoading && (
        <>
          <Stat label="Заморожено в таком товаре" value={formatMoney(frozen)} />

          <Card padded={false}>
            {rows.length === 0 ? (
              <EmptyState
                icon={<PackageX size={20} />}
                title="Всё продаётся"
                hint={`За последние ${days} дней продавался каждый товар, который лежит на складе.`}
              />
            ) : (
              <div className="divide-y divide-line">
                {rows.map((r) => (
                  <div key={`${r.product_id}-${r.sku}`} className="flex items-start justify-between gap-3 px-4 py-2.5">
                    <div className="min-w-0">
                      <div className="text-sm leading-snug text-fg">{r.product_name}</div>
                      <div className="text-xs text-fg-muted">
                        {r.sku} · {formatQty(r.quantity)} шт на складе
                      </div>
                    </div>
                    <div className="shrink-0 text-sm font-semibold tabular-nums text-fg">
                      {formatMoney(r.frozen_amount)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  )
}

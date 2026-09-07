import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts'
import {
  TrendingUp, TrendingDown, AlertTriangle, Wallet, ShoppingCart, Receipt,
  PiggyBank, Tag, PackageX, ChevronRight, BarChart3, CreditCard,
} from 'lucide-react'
import clsx from 'clsx'
import { useDashboard } from '@/api/queries'
import { useAuth } from '@/store/auth'
import { formatDate, formatDateTime, formatMoney } from '@/lib/format'
import { Card, CardTitle, EmptyState, Skeleton } from '@/components/ui'

const PERIODS: { key: 'today' | '7d' | '30d'; label: string }[] = [
  { key: 'today', label: 'Сегодня' },
  { key: '7d', label: '7 дней' },
  { key: '30d', label: '30 дней' },
]

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Наличные',
  kaspi_qr: 'Kaspi QR',
  card: 'Карта',
  transfer: 'Перевод',
}

/**
 * Цвет закреплён за способом оплаты, а не за его местом в данных. Раньше цвет
 * брался по индексу: в день, когда платили только картой, карта была синей, а
 * назавтра синими становились наличные — легенду приходилось перечитывать.
 * Сами оттенки живут в index.css и меняются вместе с темой.
 */
const PAYMENT_COLORS: Record<string, string> = {
  cash: 'var(--chart-1)',
  kaspi_qr: 'var(--chart-2)',
  card: 'var(--chart-3)',
  transfer: 'var(--chart-4)',
}
const paymentColor = (method: string) => PAYMENT_COLORS[method] ?? 'var(--chart-1)'

/** Подпись оси: 45 000 вместо 45000 — как во всех остальных числах. */
const axisNumber = (v: number) => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(v)

/** Подпись дня: 04.09 вместо 2026-09-04 — на оси год всё равно один. */
function axisDay(value: string): string {
  const [, month, day] = value.split('-')
  return month && day ? `${day}.${month}` : value
}

/** Подсказка графика: дата и сумма. Стандартная выводит «Выручка : 16 200 ₸» —
 *  с пробелом перед двоеточием и с названием ряда, которое и так в заголовке. */
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const point = payload[0]
  return (
    <div
      className="rounded-xl border px-3 py-2 shadow-pop"
      style={{
        background: 'var(--chart-tooltip-bg)',
        borderColor: 'var(--chart-tooltip-border)',
        color: 'var(--chart-tooltip-fg)',
      }}
    >
      <div className="text-xs opacity-70">{label ? formatDate(String(label)) : point.name}</div>
      <div className="mt-0.5 text-sm font-semibold tabular-nums">{formatMoney(point.value)}</div>
    </div>
  )
}

function TrendChip({ value }: { value: number }) {
  const up = value >= 0
  return (
    <span
      className={clsx(
        'mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
        up
          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
          : 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300',
      )}
    >
      {up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
      {Math.abs(value)}% к вчера
    </span>
  )
}

function StatCard({
  icon, label, value, change, tone, to,
}: {
  icon: ReactNode
  label: string
  value: string
  change?: number | null
  tone?: 'danger'
  to?: string
}) {
  const inner = (
    <div
      className={clsx(
        'h-full rounded-2xl border bg-surface p-4 shadow-card transition-all',
        to && 'hover:-translate-y-0.5 hover:shadow-raised',
        tone === 'danger' ? 'border-red-200 dark:border-red-900/60' : 'border-line',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-medium text-fg-muted">{label}</span>
        <span
          className={clsx(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl',
            tone === 'danger'
              ? 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400'
              : 'bg-surface-muted text-fg-muted',
          )}
        >
          {icon}
        </span>
      </div>
      <div
        className={clsx(
          'mt-2 text-2xl font-semibold tracking-tight tabular-nums',
          tone === 'danger' ? 'text-red-600 dark:text-red-400' : 'text-fg',
        )}
      >
        {value}
      </div>
      {change !== undefined && change !== null && <TrendChip value={change} />}
      {to && (
        <span className="mt-2 inline-flex items-center gap-0.5 text-xs font-medium text-brand-600 dark:text-brand-400">
          Посмотреть <ChevronRight size={13} />
        </span>
      )}
    </div>
  )
  return to ? <Link to={to} className="block h-full">{inner}</Link> : inner
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-line bg-surface p-4">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="mt-3 h-7 w-24" />
            <Skeleton className="mt-3 h-4 w-20" />
          </div>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-line bg-surface p-4 lg:col-span-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="mt-4 h-[240px] w-full" />
        </div>
        <div className="rounded-2xl border border-line bg-surface p-4">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="mx-auto mt-4 h-[160px] w-[160px] rounded-full" />
        </div>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [period, setPeriod] = useState<'today' | '7d' | '30d'>('today')
  const { data, isLoading } = useDashboard(period)
  const { permissions } = useAuth()

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* На телефоне это же название уже показано в верхней полосе. */}
        <div className="hidden md:block">
          <h1 className="text-xl font-semibold tracking-tight text-fg">Дашборд</h1>
          <p className="mt-0.5 text-sm text-fg-muted">Как идут дела в магазине</p>
        </div>
        <div className="flex w-full gap-1 rounded-xl border border-line bg-surface p-1 md:w-auto">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={clsx(
                'flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors md:flex-none',
                period === p.key
                  ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900'
                  : 'text-fg-muted hover:bg-surface-muted',
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading || !data ? (
        <DashboardSkeleton />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            <StatCard icon={<Wallet size={16} />} label="Выручка" value={formatMoney(data.revenue)} change={data.revenue_change_pct} />
            <StatCard icon={<ShoppingCart size={16} />} label="Продаж" value={String(data.sales_count)} change={data.sales_count_change_pct} />
            <StatCard icon={<Receipt size={16} />} label="Средний чек" value={formatMoney(data.avg_check)} />
            {permissions?.can_see_cost && data.profit !== undefined && (
              <StatCard icon={<PiggyBank size={16} />} label="Прибыль" value={formatMoney(data.profit)} change={data.profit_change_pct} />
            )}
            <StatCard icon={<Tag size={16} />} label="Скидки" value={formatMoney(data.discount_total)} />
            <StatCard
              icon={<PackageX size={16} />}
              label="Дефицит"
              value={String(data.deficit_count)}
              tone={data.deficit_count > 0 ? 'danger' : undefined}
              to="/stock?low_stock=true"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="min-w-0 lg:col-span-2">
              <CardTitle>Выручка по дням</CardTitle>
              {data.period_revenue_by_day.length === 0 ? (
                <EmptyState
                  icon={<BarChart3 size={20} />}
                  title="Пока нечего показать"
                  hint="График появится, как только пройдёт первая продажа за выбранный период."
                />
              ) : data.period_revenue_by_day.length < 2 ? (
                /* Одна точка — это не график, а число, и оно уже есть в плитке
                   «Выручка». Вместо одинокой точки посреди пустого поля —
                   переход к периоду, на котором видно динамику. */
                <EmptyState
                  icon={<BarChart3 size={20} />}
                  title={period === 'today' ? 'За один день динамики не видно' : 'Продажи были только в один день'}
                  hint={
                    period === 'today'
                      ? 'Выручка за сегодня — в плитке наверху. Динамика появляется на периоде от недели.'
                      : 'Как только продажи пройдут в разные дни, здесь появится график.'
                  }
                  action={
                    period === 'today' ? (
                      <button
                        onClick={() => setPeriod('7d')}
                        className="inline-flex h-10 items-center justify-center rounded-xl border border-line-strong px-4 text-sm font-semibold text-fg transition-transform hover:bg-surface-muted active:scale-[0.98]"
                      >
                        Показать 7 дней
                      </button>
                    ) : undefined
                  }
                />
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={data.period_revenue_by_day}>
                    <defs>
                      <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.28} />
                        <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="day"
                      tickFormatter={axisDay}
                      tick={{ fontSize: 12, fill: 'var(--chart-axis)' }}
                      axisLine={false}
                      tickLine={false}
                      minTickGap={24}
                    />
                    <YAxis
                      tick={{ fontSize: 12, fill: 'var(--chart-axis)' }}
                      tickFormatter={axisNumber}
                      axisLine={false}
                      tickLine={false}
                      width={64}
                    />
                    <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'var(--chart-axis)' }} />
                    <Area type="monotone" dataKey="revenue" stroke="var(--chart-1)" fill="url(#rev)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </Card>

            <Card className="min-w-0">
              <CardTitle>Способы оплаты</CardTitle>
              {data.payments_breakdown.length === 0 ? (
                <EmptyState icon={<CreditCard size={20} />} title="Оплат пока не было" />
              ) : (
                <>
                  {/* Кольцо из одного сегмента ничего не сравнивает — при одном
                      способе оплаты остаётся только строка со суммой. */}
                  {data.payments_breakdown.length > 1 && (
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie
                        data={data.payments_breakdown}
                        dataKey="amount"
                        nameKey="method"
                        innerRadius={45}
                        outerRadius={70}
                        paddingAngle={2}
                        stroke="none"
                      >
                        {data.payments_breakdown.map((p) => (
                          <Cell key={p.method} fill={paymentColor(p.method)} />
                        ))}
                      </Pie>
                      <Tooltip content={<ChartTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  )}
                  <div className="mt-3 space-y-2">
                    {data.payments_breakdown.map((p) => (
                      <div key={p.method} className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2 text-fg-muted">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ background: paymentColor(p.method) }}
                          />
                          {PAYMENT_LABELS[p.method] ?? p.method}
                        </span>
                        <span className="font-medium tabular-nums text-fg">{formatMoney(p.amount)}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card className="min-w-0">
              <CardTitle action={<Link to="/products" className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-400">Все товары</Link>}>
                Топ товаров
              </CardTitle>
              {data.top_products.length === 0 ? (
                <EmptyState icon={<Tag size={20} />} title="Продаж за период не было" />
              ) : (
                <div className="space-y-1">
                  {data.top_products.map((p, i) => (
                    <div
                      key={p.product__sku}
                      className="flex items-center justify-between gap-3 rounded-xl px-2 py-2 text-sm hover:bg-surface-muted"
                    >
                      {/* min-w-0 + flex обязательны: без них обёртка растягивается по
                          длине названия, truncate не срабатывает и на телефоне
                          появляется горизонтальная прокрутка всей страницы. */}
                      <span className="flex min-w-0 flex-1 items-center gap-2.5">
                        {/* Место в топе — взгляд сразу цепляется за порядок */}
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-xs font-semibold text-fg-muted">
                          {i + 1}
                        </span>
                        <span className="block min-w-0 flex-1">
                          <span className="line-clamp-2 block text-fg">{p.product__name}</span>
                          <span className="block truncate text-xs text-fg-muted">{p.product__sku} · {p.qty} шт</span>
                        </span>
                      </span>
                      <span className="shrink-0 font-medium tabular-nums text-fg">{formatMoney(p.revenue)}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card className="min-w-0">
              <CardTitle action={<Link to="/sales" className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-400">Все продажи</Link>}>
                Последние продажи
              </CardTitle>
              {data.recent_sales.length === 0 ? (
                <EmptyState icon={<Receipt size={20} />} title="Продаж пока нет" hint="Оформите первую продажу на экране «Продажа»." />
              ) : (
                <div className="space-y-1">
                  {data.recent_sales.map((s) => (
                    <Link
                      key={s.id}
                      to={`/sales/${s.id}`}
                      className="flex items-center justify-between gap-3 rounded-xl px-2 py-2 text-sm hover:bg-surface-muted"
                    >
                      <span className="block min-w-0 flex-1">
                        <span className="block truncate text-fg">{s.number}</span>
                        <span className="block truncate text-xs text-fg-muted">
                          {formatDateTime(s.created_at)} · {s.seller__first_name} {s.seller__last_name}
                        </span>
                      </span>
                      <span className="shrink-0 font-medium tabular-nums text-fg">{formatMoney(s.total)}</span>
                    </Link>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {data.deficit_count > 0 && (
            <Link
              to="/stock?low_stock=true"
              className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3.5 text-sm font-medium text-red-700 transition-colors hover:bg-red-100 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300 dark:hover:bg-red-900/50"
            >
              <AlertTriangle size={18} className="shrink-0" />
              <span className="min-w-0">
                {data.deficit_count} товаров с дефицитом на витрине
                <span className="block text-xs font-normal opacity-80">Нажмите, чтобы посмотреть и пополнить</span>
              </span>
              <ChevronRight size={16} className="ml-auto shrink-0" />
            </Link>
          )}
        </>
      )}
    </div>
  )
}

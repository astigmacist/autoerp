import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts'
import { TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react'
import { useDashboard } from '@/api/queries'
import { useAuth } from '@/store/auth'
import { formatMoney, formatDateTime } from '@/lib/format'

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

const PAYMENT_COLORS = ['#111827', '#6366f1', '#22c55e', '#f59e0b']

function StatCard({
  label, value, change, accent,
}: { label: string; value: string; change?: number | null; accent?: 'red' }) {
  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#151720] p-4">
      <div className="text-sm text-gray-500 dark:text-gray-400">{label}</div>
      <div className={`text-2xl font-semibold mt-1 tabular-nums ${accent === 'red' ? 'text-red-600' : 'text-gray-900 dark:text-gray-100'}`}>
        {value}
      </div>
      {change !== undefined && change !== null && (
        <div className={`flex items-center gap-1 text-xs mt-1 ${change >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
          {change >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
          {Math.abs(change)}% к вчера
        </div>
      )}
    </div>
  )
}

export default function Dashboard() {
  const [period, setPeriod] = useState<'today' | '7d' | '30d'>('today')
  const { data, isLoading } = useDashboard(period)
  const { permissions } = useAuth()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Дашборд</h1>
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
                period === p.key ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-gray-100' : 'text-gray-500'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading || !data ? (
        <div className="text-gray-400 text-sm">Загрузка…</div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <StatCard label="Выручка" value={formatMoney(data.revenue)} change={data.revenue_change_pct} />
            <StatCard label="Продаж" value={String(data.sales_count)} change={data.sales_count_change_pct} />
            <StatCard label="Средний чек" value={formatMoney(data.avg_check)} />
            {permissions?.can_see_cost && data.profit !== undefined && (
              <StatCard label="Прибыль" value={formatMoney(data.profit)} change={data.profit_change_pct} />
            )}
            <StatCard label="Скидки" value={formatMoney(data.discount_total)} />
            <Link to="/stock?low_stock=true">
              <StatCard label="Дефицит позиций" value={String(data.deficit_count)} accent={data.deficit_count > 0 ? 'red' : undefined} />
            </Link>
          </div>

          <div className="grid lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#151720] p-4">
              <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Выручка по дням</div>
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={data.period_revenue_by_day}>
                  <defs>
                    <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#111827" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#111827" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="day" tick={{ fontSize: 12, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={40} />
                  <Tooltip formatter={(v: any) => formatMoney(v)} />
                  <Area type="monotone" dataKey="revenue" stroke="#111827" fill="url(#rev)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#151720] p-4">
              <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Способы оплаты</div>
              {data.payments_breakdown.length === 0 ? (
                <div className="text-sm text-gray-400 h-[200px] flex items-center justify-center">Нет данных</div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie data={data.payments_breakdown} dataKey="amount" nameKey="method" innerRadius={45} outerRadius={70}>
                        {data.payments_breakdown.map((_, i) => (
                          <Cell key={i} fill={PAYMENT_COLORS[i % PAYMENT_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: any) => formatMoney(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-1.5 mt-2">
                    {data.payments_breakdown.map((p, i) => (
                      <div key={p.method} className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ background: PAYMENT_COLORS[i % PAYMENT_COLORS.length] }} />
                          {PAYMENT_LABELS[p.method] ?? p.method}
                        </span>
                        <span className="font-medium tabular-nums">{formatMoney(p.amount)}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#151720] p-4">
              <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Топ товаров</div>
              <div className="space-y-2">
                {data.top_products.length === 0 && <div className="text-sm text-gray-400">Нет продаж за период</div>}
                {data.top_products.map((p) => (
                  <div key={p.product__sku} className="flex items-center justify-between text-sm">
                    <div className="min-w-0">
                      <div className="truncate text-gray-800 dark:text-gray-200">{p.product__name}</div>
                      <div className="text-xs text-gray-400">{p.product__sku} · {p.qty} шт</div>
                    </div>
                    <div className="font-medium tabular-nums shrink-0 ml-3">{formatMoney(p.revenue)}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#151720] p-4">
              <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Последние продажи</div>
              <div className="space-y-2">
                {data.recent_sales.length === 0 && <div className="text-sm text-gray-400">Пока нет продаж</div>}
                {data.recent_sales.map((s) => (
                  <div key={s.id} className="flex items-center justify-between text-sm">
                    <div>
                      <div className="text-gray-800 dark:text-gray-200">{s.number}</div>
                      <div className="text-xs text-gray-400">
                        {formatDateTime(s.created_at)} · {s.seller__first_name} {s.seller__last_name}
                      </div>
                    </div>
                    <div className="font-medium tabular-nums">{formatMoney(s.total)}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {data.deficit_count > 0 && (
            <Link
              to="/stock?low_stock=true"
              className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm font-medium hover:bg-red-100 transition-colors"
            >
              <AlertTriangle size={18} />
              {data.deficit_count} товаров с дефицитом на витрине — нажмите, чтобы посмотреть
            </Link>
          )}
        </>
      )}
    </div>
  )
}

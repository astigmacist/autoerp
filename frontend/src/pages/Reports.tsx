import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { api, getApiError } from '@/api/client'
import { useAuth } from '@/store/auth'
import { useToast } from '@/store/toast'
import { formatMoney, formatQty, todayIso } from '@/lib/format'
import { triggerDownload } from '@/lib/download'
import { fieldClass } from '@/components/ui'

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

export default function Reports() {
  const [date, setDate] = useState(todayIso())
  const { permissions } = useAuth()
  const { push } = useToast()
  const [exporting, setExporting] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['daily-report', date],
    queryFn: async () => (await api.get<DailyReport>('/reports/daily/', { params: { date } })).data,
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
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-semibold text-fg">Дневной отчёт</h1>
        <div className="flex items-center gap-2">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`${fieldClass} h-11 md:h-10 w-auto`} />
          <button
            onClick={exportExcel}
            disabled={exporting || isLoading}
            className="inline-flex h-11 md:h-10 items-center justify-center gap-1.5 rounded-xl border border-line-strong bg-surface px-3 text-sm font-semibold text-fg transition-transform hover:bg-surface-muted active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40"
          >
            {exporting ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />} Excel
          </button>
        </div>
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

          <div className="rounded-2xl border border-line bg-surface overflow-x-auto">
            <div className="px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 border-b border-line">
              Проданные товары
            </div>
            <table className="w-full text-sm min-w-[600px]">
              <thead className="text-fg-muted">
                <tr>
                  <th className="text-left font-medium px-4 py-2">Товар</th>
                  <th className="text-right font-medium px-2 py-2">Кол-во</th>
                  <th className="text-right font-medium px-2 py-2">По прайсу</th>
                  <th className="text-right font-medium px-2 py-2">Факт</th>
                  <th className="text-right font-medium px-4 py-2">Скидка</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.items.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">Продаж не было</td></tr>}
                {data.items.map((i) => (
                  <tr key={i.product__sku}>
                    <td className="px-4 py-2">
                      <div className="text-fg">{i.product__name}</div>
                      <div className="text-xs text-gray-400">{i.product__sku}</div>
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">{formatQty(i.qty)}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{formatMoney(i.amount_base)}</td>
                    <td className="px-2 py-2 text-right tabular-nums font-medium">{formatMoney(i.amount_fact)}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-amber-600">
                      {i.discount > 0 ? `−${formatMoney(i.discount)}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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

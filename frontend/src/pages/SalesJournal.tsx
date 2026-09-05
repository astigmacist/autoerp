import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ReceiptText } from 'lucide-react'
import { api } from '@/api/client'
import type { Paginated, Sale } from '@/api/types'
import { formatDateTime, formatMoney } from '@/lib/format'
import { Card, EmptyState, SkeletonList, SkeletonRows, fieldClass } from '@/components/ui'

const STATUS_LABELS: Record<string, string> = {
  completed: 'Завершена',
  returned: 'Возвращена',
  partially_returned: 'Частично возвращена',
  cancelled: 'Отменена',
}

export default function SalesJournal() {
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const navigate = useNavigate()

  const { data, isLoading } = useQuery({
    queryKey: ['sales', dateFrom, dateTo],
    queryFn: async () =>
      (
        await api.get<Paginated<Sale>>('/sales/', {
          params: { date_from: dateFrom || undefined, date_to: dateTo || undefined, page_size: 100 },
        })
      ).data,
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        {/* На телефоне это же название уже показано в верхней полосе. */}
        <h1 className="hidden md:block text-xl font-semibold text-fg">Продажи</h1>
        <div className="flex items-center gap-2">
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={`${fieldClass} h-11 md:h-10 w-auto`} />
          <span className="text-gray-400 text-sm">—</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={`${fieldClass} h-11 md:h-10 w-auto`} />
        </div>
      </div>

      <div className="md:hidden space-y-2">
        {isLoading && <SkeletonList rows={3} />}
        {data?.results.length === 0 && <Card padded={false}><EmptyState icon={<ReceiptText size={20} />} title="Продаж не найдено" /></Card>}
        {data?.results.map((s) => (
          <button
            key={s.id}
            onClick={() => navigate(`/sales/${s.id}`)}
            className="w-full text-left rounded-2xl border border-line bg-surface p-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-medium text-fg">{s.number}</div>
                <div className="text-xs text-gray-400">{formatDateTime(s.created_at)} · {s.seller_name}</div>
              </div>
              <div className="text-right shrink-0">
                <div className="font-semibold tabular-nums text-fg">{formatMoney(s.total)}</div>
                {parseFloat(s.discount_total) > 0 && (
                  <div className="text-xs text-amber-600 dark:text-amber-400 tabular-nums">−{formatMoney(s.discount_total)}</div>
                )}
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              <span className={`text-xs rounded-full px-2 py-0.5 ${
                s.status === 'completed' ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300' : 'bg-gray-100 dark:bg-gray-800 text-fg-muted'
              }`}>
                {STATUS_LABELS[s.status] ?? s.status}
              </span>
              {s.needs_approval && (
                <span className="text-xs rounded-full px-2 py-0.5 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300">сверхскидка</span>
              )}
            </div>
          </button>
        ))}
      </div>

      <div className="hidden md:block rounded-2xl border border-line bg-surface overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface-muted text-fg-muted">
            <tr>
              <th className="text-left font-medium px-4 py-2.5">№</th>
              <th className="text-left font-medium px-2 py-2.5">Дата</th>
              <th className="text-left font-medium px-2 py-2.5">Продавец</th>
              <th className="text-right font-medium px-2 py-2.5">Скидка</th>
              <th className="text-right font-medium px-4 py-2.5">Сумма</th>
              <th className="text-left font-medium px-4 py-2.5">Статус</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {isLoading && <SkeletonRows rows={4} cols={6} />}
            {data?.results.length === 0 && <tr><td colSpan={6} className="px-4 py-4"><EmptyState icon={<ReceiptText size={20} />} title="Продаж не найдено" /></td></tr>}
            {data?.results.map((s) => (
              <tr key={s.id} onClick={() => navigate(`/sales/${s.id}`)} className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <td className="px-4 py-2.5 font-medium text-fg">{s.number}</td>
                <td className="px-2 py-2.5 text-gray-500">{formatDateTime(s.created_at)}</td>
                <td className="px-2 py-2.5 text-gray-500">{s.seller_name}</td>
                <td className="px-2 py-2.5 text-right text-amber-600 tabular-nums">
                  {parseFloat(s.discount_total) > 0 ? `−${formatMoney(s.discount_total)}` : '—'}
                </td>
                <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{formatMoney(s.total)}</td>
                <td className="px-4 py-2.5">
                  <span className={`text-xs rounded-full px-2 py-0.5 ${
                    s.status === 'completed' ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300' : 'bg-gray-100 dark:bg-gray-800 text-fg-muted'
                  }`}>
                    {STATUS_LABELS[s.status] ?? s.status}
                  </span>
                  {s.needs_approval && (
                    <span className="ml-1 text-xs rounded-full px-2 py-0.5 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300">сверхскидка</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

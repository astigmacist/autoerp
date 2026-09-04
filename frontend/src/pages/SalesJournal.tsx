import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '@/api/client'
import type { Paginated, Sale } from '@/api/types'
import { formatDateTime, formatMoney } from '@/lib/format'

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
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Продажи</h1>
        <div className="flex items-center gap-2">
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#151720] px-3 py-2 text-sm outline-none" />
          <span className="text-gray-400 text-sm">—</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#151720] px-3 py-2 text-sm outline-none" />
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#151720] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400">
            <tr>
              <th className="text-left font-medium px-4 py-2.5">№</th>
              <th className="text-left font-medium px-2 py-2.5">Дата</th>
              <th className="text-left font-medium px-2 py-2.5">Продавец</th>
              <th className="text-right font-medium px-2 py-2.5">Скидка</th>
              <th className="text-right font-medium px-4 py-2.5">Сумма</th>
              <th className="text-left font-medium px-4 py-2.5">Статус</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {isLoading && <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Загрузка…</td></tr>}
            {data?.results.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Продаж не найдено</td></tr>}
            {data?.results.map((s) => (
              <tr key={s.id} onClick={() => navigate(`/sales/${s.id}`)} className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-gray-100">{s.number}</td>
                <td className="px-2 py-2.5 text-gray-500">{formatDateTime(s.created_at)}</td>
                <td className="px-2 py-2.5 text-gray-500">{s.seller_name}</td>
                <td className="px-2 py-2.5 text-right text-amber-600 tabular-nums">
                  {parseFloat(s.discount_total) > 0 ? `−${formatMoney(s.discount_total)}` : '—'}
                </td>
                <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{formatMoney(s.total)}</td>
                <td className="px-4 py-2.5">
                  <span className={`text-xs rounded-full px-2 py-0.5 ${
                    s.status === 'completed' ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
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

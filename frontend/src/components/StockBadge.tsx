import type { StockStatus } from '@/api/types'
import { formatQty } from '@/lib/format'

const config: Record<StockStatus, { label: string; cls: string }> = {
  out: { label: 'Нет в наличии', cls: 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700' },
  low: { label: 'Дефицит', cls: 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-900' },
  warning: { label: 'Заканчивается', cls: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900' },
  ok: { label: 'В наличии', cls: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900' },
}

export default function StockBadge({ status, quantity }: { status: StockStatus; quantity: number | string }) {
  const c = config[status]
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${c.cls}`}>
      <span className="tabular-nums">{formatQty(quantity)}</span>
      <span className="opacity-70">·</span>
      <span>{c.label}</span>
    </span>
  )
}

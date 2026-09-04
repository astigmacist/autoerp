import type { StockStatus } from '@/api/types'
import { formatQty } from '@/lib/format'

const config: Record<StockStatus, { label: string; cls: string }> = {
  out: { label: 'Нет в наличии', cls: 'bg-gray-100 text-gray-500 border-gray-200' },
  low: { label: 'Дефицит', cls: 'bg-red-50 text-red-700 border-red-200' },
  warning: { label: 'Заканчивается', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  ok: { label: 'В наличии', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
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

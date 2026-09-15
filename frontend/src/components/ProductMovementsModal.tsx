import { useQuery } from '@tanstack/react-query'
import { History } from 'lucide-react'
import { api } from '@/api/client'
import { formatDateTime, formatQty } from '@/lib/format'
import Modal from '@/components/Modal'
import { EmptyState, SkeletonList } from '@/components/ui'

export interface Movement {
  created_at: string
  warehouse: string
  qty_delta: string
  balance_after: string
  reason: string
  user: string | null
  note: string
}

/**
 * История движений товара.
 *
 * Самый частый вопрос в магазине к любой учётной программе — «куда делись пять
 * штук». Данные для ответа были (каждое изменение остатка пишется в
 * StockMovement), но посмотреть их можно было только через админку Django.
 * Теперь это кнопка в строке товара и в остатках.
 */
export default function ProductMovementsModal({
  productId, productName, onClose,
}: {
  productId: string | null
  productName: string
  onClose: () => void
}) {
  const { data, isLoading } = useQuery({
    queryKey: ['movements', productId],
    queryFn: async () => (await api.get<Movement[]>(`/products/${productId}/movements/`)).data,
    enabled: !!productId,
  })

  return (
    <Modal
      open={!!productId}
      onClose={onClose}
      title="Движения товара"
      width="max-w-2xl"
      footer={
        <button
          onClick={onClose}
          className="inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-semibold text-fg-muted transition-transform hover:bg-surface-muted hover:text-fg active:scale-[0.98]"
        >
          Закрыть
        </button>
      }
    >
      <div className="space-y-3">
        <div className="text-sm font-medium text-fg">{productName}</div>

        {isLoading && <SkeletonList rows={4} />}

        {!isLoading && data?.length === 0 && (
          <EmptyState
            icon={<History size={20} />}
            title="Движений пока не было"
            hint="Здесь появятся приходы, продажи, перемещения, списания и пересчёты — по одной строке на каждое изменение остатка."
          />
        )}

        {!isLoading && data && data.length > 0 && (
          <div className="divide-y divide-line overflow-hidden rounded-xl border border-line">
            {data.map((m, i) => {
              const delta = parseFloat(m.qty_delta)
              return (
                <div key={i} className="flex items-start justify-between gap-3 bg-surface px-3 py-2.5">
                  <div className="min-w-0">
                    <div className="text-sm text-fg">{m.reason}</div>
                    <div className="text-xs text-fg-muted">
                      {formatDateTime(m.created_at)} · {m.warehouse}
                      {m.user && ` · ${m.user}`}
                    </div>
                    {m.note && <div className="mt-0.5 text-xs text-fg-muted italic">{m.note}</div>}
                  </div>
                  <div className="shrink-0 text-right">
                    <div
                      className={`text-sm font-semibold tabular-nums ${
                        delta > 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : delta < 0
                            ? 'text-red-600 dark:text-red-400'
                            : 'text-fg-muted'
                      }`}
                    >
                      {delta > 0 ? '+' : ''}
                      {formatQty(m.qty_delta)}
                    </div>
                    <div className="text-xs text-fg-muted tabular-nums">стало {formatQty(m.balance_after)}</div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </Modal>
  )
}

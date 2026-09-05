import clsx from 'clsx'

/**
 * Заглушка на время загрузки. Пустой экран со словом «Загрузка…» выглядит
 * так, будто ничего не происходит; серые полосы сразу показывают форму
 * будущего содержимого, и переход к данным не «прыгает».
 */
export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx('animate-pulse rounded-lg bg-gray-200/70 dark:bg-gray-700/40', className)} />
}

/** Несколько строк-заглушек в виде карточек списка. */
export function SkeletonList({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-line bg-surface p-4">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="mt-2 h-3 w-1/3" />
        </div>
      ))}
    </div>
  )
}

/** Заглушка строк внутри таблицы. */
export function SkeletonRows({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r}>
          {Array.from({ length: cols }).map((_, c) => (
            <td key={c} className="px-4 py-3">
              <Skeleton className={clsx('h-4', c === 0 ? 'w-40' : 'w-16')} />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

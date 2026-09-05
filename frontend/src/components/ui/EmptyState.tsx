import type { ReactNode } from 'react'
import clsx from 'clsx'

/**
 * Пустое состояние. Пятнадцать экранов сообщали о пустоте одинаковой серой
 * строкой посреди белого поля — это читается как сбой, а не как «здесь пока
 * ничего нет». Значок, короткое пояснение и, где уместно, кнопка объясняют,
 * что происходит и что делать дальше.
 */
export default function EmptyState({
  icon, title, hint, action, className,
}: {
  icon?: ReactNode
  title: string
  hint?: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={clsx('flex flex-col items-center justify-center px-6 py-14 text-center', className)}>
      {icon && (
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-muted text-gray-400 dark:text-gray-500">
          {icon}
        </div>
      )}
      <div className="text-sm font-medium text-fg">{title}</div>
      {hint && <div className="mt-1 max-w-sm text-xs text-fg-muted">{hint}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

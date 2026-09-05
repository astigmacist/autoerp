import type { ReactNode } from 'react'
import clsx from 'clsx'

/** Карточка — основная поверхность интерфейса. */
export function Card({
  children, className, padded = true,
}: { children: ReactNode; className?: string; padded?: boolean }) {
  return (
    <div
      className={clsx(
        'rounded-2xl border border-line bg-surface shadow-card',
        padded && 'p-4',
        className,
      )}
    >
      {children}
    </div>
  )
}

/** Заголовок раздела внутри карточки. */
export function CardTitle({
  children, action, className,
}: { children: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={clsx('mb-3 flex items-center justify-between gap-3', className)}>
      <h2 className="text-sm font-semibold text-fg">{children}</h2>
      {action}
    </div>
  )
}

import clsx from 'clsx'

/**
 * Знак марки. Раньше в интерфейсе не было ничего, кроме слова «AutoZap»
 * обычным текстом, — от этого продукт выглядел как черновик. Гайка с ключом
 * читается на любом размере и не требует растровой картинки.
 */
export function LogoMark({ size = 36, className }: { size?: number; className?: string }) {
  return (
    <span
      className={clsx(
        'inline-flex shrink-0 items-center justify-center rounded-[28%] text-white',
        'bg-gradient-to-br from-gray-800 to-gray-950 shadow-raised',
        'dark:from-brand-500 dark:to-brand-700',
        className,
      )}
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 24 24" fill="none" width={size * 0.58} height={size * 0.58} aria-hidden>
        <path
          d="M15.4 8.6a3.6 3.6 0 0 1-4.5 4.5l-4.2 4.2a1.6 1.6 0 0 1-2.3-2.3l4.2-4.2a3.6 3.6 0 0 1 4.5-4.5L11.3 8.1a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l1.1-1.1Z"
          fill="currentColor"
        />
        <circle cx="17.2" cy="15.8" r="3.4" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    </span>
  )
}

/** Знак вместе с названием — для боковой панели и экрана входа. */
export function Logo({ size = 32, subtitle = 'ERP' }: { size?: number; subtitle?: string }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark size={size} />
      <span className="flex flex-col leading-none">
        <span className="text-[15px] font-semibold tracking-tight text-fg">AutoZap</span>
        {subtitle && (
          <span className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.16em] text-fg-muted">
            {subtitle}
          </span>
        )}
      </span>
    </span>
  )
}

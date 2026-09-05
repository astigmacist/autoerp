import type { ReactNode } from 'react'
import { Check } from 'lucide-react'
import clsx from 'clsx'

/**
 * Переключатель-фильтр («показывать архивные», «только дефицит»).
 * Раньше это был системный флажок, который в ряду с полем поиска и кнопкой
 * выглядел чужеродно — и по размеру, и по стилю. Теперь это такая же
 * кнопка-пилюля, только с состоянием.
 */
export default function Toggle({
  checked, onChange, children, className,
}: {
  checked: boolean
  onChange: (value: boolean) => void
  children: ReactNode
  className?: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={clsx(
        'inline-flex h-11 shrink-0 items-center gap-2 rounded-xl border px-3 text-sm font-medium transition-colors md:h-10',
        checked
          ? 'border-brand-300 bg-brand-50 text-brand-700 dark:border-brand-700 dark:bg-brand-900/30 dark:text-brand-300'
          : 'border-line-strong bg-surface text-fg-muted hover:bg-surface-muted hover:text-fg',
        className,
      )}
    >
      <span
        className={clsx(
          'flex h-4 w-4 shrink-0 items-center justify-center rounded border',
          checked ? 'border-brand-500 bg-brand-500 text-white' : 'border-line-strong',
        )}
      >
        {checked && <Check size={11} strokeWidth={3} />}
      </span>
      {children}
    </button>
  )
}

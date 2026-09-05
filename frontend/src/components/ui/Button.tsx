import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import clsx from 'clsx'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success-soft' | 'danger-soft'
type Size = 'sm' | 'md' | 'lg'

/**
 * Кнопки раньше собирались вручную на каждом экране — двадцать пять разных
 * строк классов, которые понемногу расходились в отступах и состояниях.
 * Здесь они собраны в один набор: одинаковые высоты, одинаковая реакция
 * на наведение и нажатие, одинаковое поведение при загрузке.
 */
const VARIANTS: Record<Variant, string> = {
  // Почти чёрная — главное действие на экране. В тёмной теме инвертируется.
  primary:
    'bg-gray-900 text-white hover:bg-gray-800 active:bg-gray-950 ' +
    'dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white dark:active:bg-gray-200',
  secondary:
    'bg-surface text-gray-700 dark:text-gray-200 border border-line-strong ' +
    'hover:bg-surface-muted hover:border-gray-300 dark:hover:border-gray-600',
  ghost:
    'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800',
  danger: 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800',
  'success-soft':
    'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 ' +
    'dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-900/50',
  'danger-soft':
    'bg-red-50 text-red-700 hover:bg-red-100 ' +
    'dark:bg-red-950/40 dark:text-red-300 dark:hover:bg-red-900/50',
}

const SIZES: Record<Size, string> = {
  sm: 'h-9 px-3 text-xs gap-1.5 rounded-lg',
  md: 'h-10 px-4 text-sm gap-2 rounded-xl',
  lg: 'h-12 px-5 text-sm gap-2 rounded-xl',
}

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  icon?: ReactNode
  block?: boolean
}

const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = 'primary', size = 'md', loading, icon, block, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={clsx(
        'inline-flex items-center justify-center font-semibold whitespace-nowrap',
        'disabled:opacity-40 disabled:pointer-events-none',
        // едва заметное нажатие — интерфейс отзывается на касание
        'active:scale-[0.98] transition-transform',
        VARIANTS[variant],
        SIZES[size],
        block && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 size={15} className="animate-spin" /> : icon}
      {children}
    </button>
  )
})

export default Button

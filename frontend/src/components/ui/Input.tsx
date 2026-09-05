import type { ReactNode } from 'react'
import clsx from 'clsx'

/**
 * Общий вид поля ввода. Главное, чего здесь не хватало раньше: явный цвет
 * текста и заметная реакция на фокус — из 44 полей кольцо фокуса было лишь
 * у четырёх, поэтому формы казались неживыми. Класс, а не компонент: поля
 * в формах разной высоты и с разными добавками (иконка поиска, выравнивание
 * чисел вправо), и оборачивать каждое в компонент оказалось только мешать.
 */
export const fieldClass =
  'w-full rounded-xl border border-line-strong bg-surface text-fg ' +
  'placeholder:text-gray-400 dark:placeholder:text-gray-500 ' +
  'px-3 text-sm outline-none ' +
  'hover:border-gray-300 dark:hover:border-gray-600 ' +
  'focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15 ' +
  'disabled:opacity-50 disabled:cursor-not-allowed'

/** Подпись над полем — одинаковая во всех формах. */
export function Field({
  label, hint, children, className,
}: { label?: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={clsx('block', className)}>
      {label && <span className="mb-1.5 block text-xs font-medium text-fg-muted">{label}</span>}
      {children}
      {hint && <span className="mt-1 block text-xs text-fg-muted">{hint}</span>}
    </label>
  )
}

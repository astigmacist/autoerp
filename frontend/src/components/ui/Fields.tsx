import { Minus, Plus, Trash2 } from 'lucide-react'
import type { ReactNode } from 'react'
import clsx from 'clsx'

const UNIT_LABELS: Record<string, string> = { pcs: 'шт', set: 'компл', l: 'л', kg: 'кг' }

export function unitLabel(unit?: string): string {
  return UNIT_LABELS[unit ?? 'pcs'] ?? 'шт'
}

/**
 * Количество. Раньше это было `<input>` без рамки и фона внутри таблицы —
 * выглядело как обычный текст, и о том, что штуки вообще можно указать,
 * догадаться было невозможно. Здесь это очевидный элемент управления:
 * рамка, кнопки «плюс/минус» и единица измерения рядом с числом.
 */
export function QtyField({
  value, onChange, unit, label = 'Количество', max, autoFocus, hint, tone,
}: {
  value: number
  onChange: (value: number) => void
  unit?: string
  label?: string
  max?: number
  autoFocus?: boolean
  hint?: ReactNode
  tone?: 'warning'
}) {
  const clamp = (v: number) => {
    const min = 0
    const bounded = Math.max(min, v)
    return max !== undefined ? Math.min(bounded, max) : bounded
  }
  return (
    <div>
      <div className="mb-1.5 text-xs font-medium text-fg-muted">{label}</div>
      <div
        className={clsx(
          'flex items-center rounded-xl border bg-surface transition-colors',
          'focus-within:border-brand-500 focus-within:ring-4 focus-within:ring-brand-500/15',
          tone === 'warning' ? 'border-amber-300 dark:border-amber-800' : 'border-line-strong',
        )}
      >
        <button
          type="button"
          onClick={() => onChange(clamp(value - 1))}
          aria-label="Меньше"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-l-xl text-fg-muted hover:bg-surface-muted hover:text-fg md:h-10 md:w-10"
        >
          <Minus size={14} />
        </button>
        <input
          inputMode="decimal"
          autoFocus={autoFocus}
          value={value}
          onChange={(e) => onChange(clamp(parseFloat(e.target.value) || 0))}
          aria-label={label}
          className="h-11 min-w-0 flex-1 border-x border-line-strong bg-transparent text-center text-sm font-semibold tabular-nums text-fg outline-none focus-visible:outline-none md:h-10"
        />
        <button
          type="button"
          onClick={() => onChange(clamp(value + 1))}
          aria-label="Больше"
          className="flex h-11 w-11 shrink-0 items-center justify-center text-fg-muted hover:bg-surface-muted hover:text-fg md:h-10 md:w-10"
        >
          <Plus size={14} />
        </button>
        <span className="w-11 shrink-0 pr-1 text-center text-xs text-fg-muted">{unitLabel(unit)}</span>
      </div>
      {hint && (
        <div className={clsx('mt-1 text-xs', tone === 'warning' ? 'text-amber-600 dark:text-amber-400' : 'text-fg-muted')}>
          {hint}
        </div>
      )}
    </div>
  )
}

/** Денежное поле со знаком валюты и подсказкой. */
export function MoneyField({
  value, onChange, label, placeholder, hint, tone,
}: {
  value: number | ''
  onChange: (value: number | '') => void
  label: string
  placeholder?: string
  hint?: ReactNode
  tone?: 'warning'
}) {
  return (
    <div>
      <div className="mb-1.5 text-xs font-medium text-fg-muted">{label}</div>
      <div className="relative">
        <input
          inputMode="numeric"
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
          aria-label={label}
          className={clsx(
            'h-11 w-full rounded-xl border bg-surface pr-7 pl-3 text-right text-sm font-semibold tabular-nums outline-none md:h-10',
            'placeholder:font-normal placeholder:text-gray-400 dark:placeholder:text-gray-500',
            'focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15',
            tone === 'warning'
              ? 'border-amber-300 dark:border-amber-800'
              : 'border-line-strong hover:border-gray-300 dark:hover:border-gray-600',
          )}
        />
        <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-xs text-fg-muted">₸</span>
      </div>
      {hint && <div className="mt-1 text-xs text-fg-muted">{hint}</div>}
    </div>
  )
}

/**
 * Карточка позиции документа. Таблица с пятью колонками не помещалась в
 * модальное окно на телефоне: названия ломались на четыре строки, а поля
 * сжимались до нечитаемого. Одна позиция — одна карточка.
 */
export function LineCard({
  title, subtitle, onRemove, children, footer,
}: {
  title: string
  subtitle?: string
  onRemove: () => void
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <div className="rounded-xl border border-line bg-surface p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-medium leading-snug text-fg">{title}</div>
          {subtitle && <div className="text-xs text-fg-muted">{subtitle}</div>}
        </div>
        <button
          type="button"
          onClick={onRemove}
          aria-label="Убрать позицию"
          className="-mt-1 -mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-fg-muted hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
        >
          <Trash2 size={15} />
        </button>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>
      {footer && <div className="mt-3 border-t border-line pt-2 text-sm">{footer}</div>}
    </div>
  )
}

/** Итоговая строка под списком позиций. */
export function LinesTotal({ items }: { items: { label: string; value: string; strong?: boolean }[] }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 rounded-xl bg-surface-muted px-3 py-2.5">
      {items.map((i) => (
        <span key={i.label} className={clsx('text-sm', i.strong ? 'font-semibold text-fg' : 'text-fg-muted')}>
          {i.label}{' '}
          <span className="tabular-nums">{i.value}</span>
        </span>
      ))}
    </div>
  )
}

import { useEffect, useState } from 'react'
import { Delete, X } from 'lucide-react'
import clsx from 'clsx'
import { useNumPad } from '@/store/numpad'

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9']

function formatForDisplay(raw: string): string {
  if (!raw) return '0'
  const [whole, fraction] = raw.split('.')
  const grouped = new Intl.NumberFormat('ru-RU').format(Number(whole || '0'))
  return fraction === undefined ? grouped : `${grouped},${fraction}`
}

/**
 * Цифровой блок — вместо клавиатуры телефона.
 *
 * На телефоне любое числовое поле вызывает системную клавиатуру: она занимает
 * половину экрана, прячет и сумму, и товар, и кнопку «Оформить», а цифры на
 * ней мелкие и вперемешку с буквами. Продавцу у прилавка нужен калькулятор:
 * крупные клавиши, число всегда на виду, ввод в два касания.
 *
 * Панель одна на всё приложение — её открывает любое поле через `useNumPad`.
 */
export default function NumPad() {
  const { request, close } = useNumPad()
  const [raw, setRaw] = useState('')
  /** Первая нажатая цифра заменяет старое значение, как в калькуляторе. */
  const [fresh, setFresh] = useState(true)

  useEffect(() => {
    if (!request) return
    setRaw(request.value ? String(request.value) : '')
    setFresh(true)
  }, [request])

  // Физическая клавиатура тоже должна работать: панель может открыться на
  // планшете с чехлом-клавиатурой, да и проверять так удобнее.
  useEffect(() => {
    if (!request) return
    function onKey(event: KeyboardEvent) {
      if (event.key >= '0' && event.key <= '9') press(event.key)
      else if (event.key === 'Backspace') backspace()
      else if (event.key === '.' || event.key === ',') press('.')
      else if (event.key === 'Enter') submit()
      else if (event.key === 'Escape') close()
      else return
      event.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (!request) return null

  const { title, suffix, hint, allowDecimal, min, max, quickAdd, onSubmit } = request
  const current = Number(raw || '0')

  function press(key: string) {
    if (key === '.' && !allowDecimal) return
    setRaw((prev) => {
      const base = fresh ? '' : prev
      if (key === '.') {
        if (base.includes('.')) return base
        return (base || '0') + '.'
      }
      if (base === '0') return key
      const next = base + key
      // Три знака после запятой — предел точности остатков в базе.
      const [, fraction] = next.split('.')
      if (fraction && fraction.length > 3) return base
      return next
    })
    setFresh(false)
  }

  function backspace() {
    setRaw((prev) => (fresh ? '' : prev.slice(0, -1)))
    setFresh(false)
  }

  function clear() {
    setRaw('')
    setFresh(false)
  }

  function add(amount: number) {
    setRaw(String(Number(raw || '0') + amount))
    setFresh(false)
  }

  function submit() {
    let value = Number(raw || '0')
    if (min !== undefined) value = Math.max(min, value)
    if (max !== undefined) value = Math.min(max, value)
    onSubmit(value)
    close()
  }

  const outOfRange = (min !== undefined && current < min) || (max !== undefined && current > max)

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center">
      <div className="absolute inset-0 bg-gray-950/50 backdrop-blur-[2px] animate-[fadeIn_.15s_ease-out]" onClick={close} />

      <div className="relative w-full max-w-md rounded-t-2xl border border-line bg-surface-2 shadow-pop animate-[slideUp_.18s_ease-out] sm:mb-4 sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3 px-5 pt-4">
          <div className="min-w-0">
            <div className="text-sm font-medium text-fg-muted">{title}</div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-3xl leading-none font-semibold tabular-nums text-fg">
                {formatForDisplay(raw)}
              </span>
              {suffix && <span className="text-base text-fg-muted">{suffix}</span>}
            </div>
            {hint && <div className="mt-1 text-xs text-fg-muted">{hint}</div>}
            {max !== undefined && current > max && (
              <div className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                Больше {new Intl.NumberFormat('ru-RU').format(max)} нельзя
              </div>
            )}
          </div>
          <button
            onClick={close}
            aria-label="Закрыть"
            className="-mt-1 -mr-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-fg-muted hover:bg-surface-muted hover:text-fg"
          >
            <X size={18} />
          </button>
        </div>

        {(quickAdd?.length ?? 0) > 0 && (
          <div className="flex flex-wrap gap-1.5 px-5 pt-3">
            {quickAdd!.map((amount) => (
              <button
                key={amount}
                onClick={() => add(amount)}
                className="h-9 rounded-lg border border-line-strong px-3 text-sm font-semibold tabular-nums text-fg-muted transition-transform hover:bg-surface-muted hover:text-fg active:scale-[0.97]"
              >
                +{new Intl.NumberFormat('ru-RU').format(amount)}
              </button>
            ))}
            <button
              onClick={clear}
              className="ml-auto h-9 rounded-lg px-3 text-sm font-semibold text-fg-muted transition-transform hover:bg-surface-muted hover:text-fg active:scale-[0.97]"
            >
              Очистить
            </button>
          </div>
        )}

        <div className="grid grid-cols-3 gap-1.5 p-3">
          {KEYS.map((key) => (
            <Key key={key} onClick={() => press(key)}>
              {key}
            </Key>
          ))}
          <Key onClick={() => press('.')} disabled={!allowDecimal} muted>
            ,
          </Key>
          <Key onClick={() => press('0')}>0</Key>
          <Key onClick={backspace} muted aria-label="Стереть">
            <Delete size={20} />
          </Key>
        </div>

        <div className="flex gap-2 border-t border-line bg-surface-muted px-3 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <button
            onClick={close}
            className="h-12 flex-1 rounded-xl text-sm font-semibold text-fg-muted transition-transform hover:bg-surface hover:text-fg active:scale-[0.98]"
          >
            Отмена
          </button>
          <button
            onClick={submit}
            disabled={outOfRange && max === undefined}
            className="h-12 flex-[2] rounded-xl bg-gray-900 text-sm font-semibold text-white transition-transform hover:bg-gray-800 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
          >
            Готово
          </button>
        </div>
      </div>
    </div>
  )
}

function Key({
  children, onClick, disabled, muted, ...rest
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  muted?: boolean
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        'flex h-14 items-center justify-center rounded-xl text-xl font-semibold tabular-nums transition-transform active:scale-[0.96]',
        muted
          ? 'bg-surface-muted text-fg-muted hover:text-fg'
          : 'border border-line bg-surface text-fg shadow-card hover:bg-surface-muted',
        disabled && 'pointer-events-none opacity-30',
      )}
      {...rest}
    >
      {children}
    </button>
  )
}

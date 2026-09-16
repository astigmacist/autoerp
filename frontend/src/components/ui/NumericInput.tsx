import { useState } from 'react'
import clsx from 'clsx'
import { hasFinePointer } from '@/lib/device'
import { useNumPad } from '@/store/numpad'

/**
 * Числовое поле, которое на телефоне открывает свой цифровой блок, а на
 * компьютере остаётся обычным полем ввода.
 *
 * Выглядит в обоих случаях одинаково: на телефоне это кнопка с теми же
 * рамкой, высотой и выравниванием, что и поле, — продавец не должен гадать,
 * где можно печатать, а где нет.
 */
export default function NumericInput({
  value,
  onChange,
  label,
  className,
  suffix,
  hint,
  allowDecimal,
  min,
  max,
  quickAdd,
  placeholder,
  format,
}: {
  value: number | ''
  onChange: (value: number | '') => void
  /** Заголовок цифрового блока и подпись для читалки экрана. */
  label: string
  className?: string
  suffix?: string
  hint?: string
  allowDecimal?: boolean
  min?: number
  max?: number
  quickAdd?: number[]
  placeholder?: string
  /** Как показывать число, когда поле не редактируют. */
  format?: (value: number) => string
}) {
  const openNumPad = useNumPad((s) => s.open)
  const [fine] = useState(hasFinePointer)
  const [draft, setDraft] = useState<string | null>(null)

  const shown =
    value === '' ? '' : (format ?? ((v: number) => new Intl.NumberFormat('ru-RU').format(v)))(value)

  if (fine) {
    return (
      <input
        inputMode="numeric"
        aria-label={label}
        placeholder={placeholder}
        value={draft ?? shown}
        onFocus={() => setDraft(value === '' ? '' : String(value))}
        onChange={(e) => {
          setDraft(e.target.value)
          const parsed = e.target.value.replace(/\s/g, '').replace(',', '.')
          onChange(parsed === '' ? '' : parseFloat(parsed) || 0)
        }}
        onBlur={() => setDraft(null)}
        className={className}
      />
    )
  }

  return (
    <button
      type="button"
      aria-label={label}
      onClick={() =>
        openNumPad({
          title: label,
          value: value === '' ? 0 : value,
          suffix,
          hint,
          allowDecimal,
          min,
          max,
          quickAdd,
          onSubmit: onChange,
        })
      }
      className={clsx(
        className,
        // Кнопка по умолчанию центрирует текст, поле ввода — нет. Выравниваем
        // так же, как выровнено бы поле, иначе число прыгает при переходе
        // между телефоном и компьютером.
        !/\btext-(left|center|right)\b/.test(className ?? '') && 'text-left',
      )}
    >
      {shown || <span className="font-normal text-gray-400 dark:text-gray-500">{placeholder ?? '0'}</span>}
    </button>
  )
}

import { create } from 'zustand'

export interface NumPadRequest {
  /** Что вводим — заголовок панели: «Закупочная цена», «Сколько пришло». */
  title: string
  /** Текущее значение, с которого начинаем. */
  value: number
  /** Что дописать справа от числа: ₸, шт, %. */
  suffix?: string
  /** Короткое пояснение под числом. */
  hint?: string
  /** Дробные значения (килограммы, литры). Для денег и штук — нет. */
  allowDecimal?: boolean
  min?: number
  max?: number
  /** Кнопки «+1000», «+5000» — для денежных полей. */
  quickAdd?: number[]
  onSubmit: (value: number) => void
}

interface NumPadState {
  request: NumPadRequest | null
  open: (request: NumPadRequest) => void
  close: () => void
}

/**
 * Одна панель на всё приложение: её открывает любое числовое поле, а живёт
 * она рядом с уведомлениями, поверх всего остального.
 */
export const useNumPad = create<NumPadState>((set) => ({
  request: null,
  open: (request) => set({ request }),
  close: () => set({ request: null }),
}))

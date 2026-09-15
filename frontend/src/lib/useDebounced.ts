import { useEffect, useState } from 'react'

/**
 * Значение, которое догоняет исходное через паузу.
 *
 * Поиск товара уходил на сервер на каждое нажатие клавиши: «колодки» — это
 * семь запросов, из которых нужен последний. На хостинге, где каждый запрос
 * поднимает функцию заново, это и лишние деньги, и заметные рывки в списке.
 */
export function useDebounced<T>(value: T, delay = 300): T {
  const [settled, setSettled] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return settled
}

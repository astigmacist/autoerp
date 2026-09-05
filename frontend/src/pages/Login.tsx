import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/store/auth'
import { applyTheme, useTheme } from '@/store/theme'
import { getApiError } from '@/api/client'
import { Loader2, Wrench } from 'lucide-react'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const { login, isLoading } = useAuth()
  const theme = useTheme((s) => s.theme)
  const navigate = useNavigate()

  // Экран входа всегда светлый — это «витрина» продукта, её вид не должен
  // зависеть от того, какую тему выбрал предыдущий пользователь. Выбранная
  // тема возвращается сразу после ухода с этого экрана.
  useEffect(() => {
    applyTheme('light')
    return () => applyTheme(theme)
  }, [theme])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    try {
      await login(username, password)
      navigate('/')
    } catch (err) {
      setError(getApiError(err).detail || 'Неверный логин или пароль')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f6f7f9] dark:bg-[#0f1115] px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-gray-900 dark:bg-gray-100 flex items-center justify-center mb-3">
            <Wrench className="text-white dark:text-gray-900" size={22} />
          </div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">AutoZap ERP</h1>
          <p className="text-sm text-gray-400 mt-1">Учёт склада и продаж</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white dark:bg-[#151720] border border-gray-200 dark:border-gray-800 rounded-2xl p-6 space-y-4 shadow-sm">
          {error && (
            <div className="rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-sm px-3 py-2">{error}</div>
          )}
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Логин</label>
            <input
              autoFocus
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-100"
              placeholder="owner"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Пароль</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-100"
              placeholder="••••••••"
            />
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-60"
          >
            {isLoading && <Loader2 className="animate-spin" size={16} />}
            Войти
          </button>
        </form>

        <p className="text-center text-xs text-gray-400 mt-4">
          Демо: owner / owner12345 · stock / stock12345 · seller / seller12345
        </p>
      </div>
    </div>
  )
}

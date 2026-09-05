import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { useAuth } from '@/store/auth'
import { applyTheme, useTheme } from '@/store/theme'
import { getApiError } from '@/api/client'
import { LogoMark } from '@/components/Logo'
import { Button, Field, fieldClass } from '@/components/ui'

/** Демо-доступы. На показе клиенту их набирают руками каждый раз — проще нажать. */
const DEMO_USERS = [
  { login: 'owner', pass: 'owner12345', role: 'Владелец' },
  { login: 'stock', pass: 'stock12345', role: 'Склад' },
  { login: 'seller', pass: 'seller12345', role: 'Продавец' },
]

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
    <div className="relative min-h-screen overflow-hidden bg-canvas px-4 py-10">
      {/* Мягкое свечение на фоне: экран перестаёт быть пустым белым листом,
          но ничего не отвлекает от формы. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(60rem 30rem at 50% -12%, rgba(99,102,241,.14), transparent 60%),' +
            'radial-gradient(40rem 24rem at 90% 110%, rgba(99,102,241,.08), transparent 60%)',
        }}
      />

      <div className="relative mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-sm flex-col justify-center">
        <div className="mb-7 flex flex-col items-center text-center">
          <LogoMark size={56} className="mb-4" />
          <h1 className="text-2xl font-semibold tracking-tight text-fg">AutoZap ERP</h1>
          <p className="mt-1.5 text-sm text-fg-muted">Учёт склада и продаж автозапчастей</p>
        </div>

        <form onSubmit={handleSubmit} className="rounded-2xl border border-line bg-surface p-6 shadow-raised">
          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <Field label="Логин">
              <input
                autoFocus
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className={`${fieldClass} h-12`}
                placeholder="owner"
              />
            </Field>
            <Field label="Пароль">
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`${fieldClass} h-12`}
                placeholder="••••••••"
              />
            </Field>
          </div>

          <Button type="submit" size="lg" block loading={isLoading} className="mt-5">
            Войти
            {!isLoading && <ArrowRight size={16} />}
          </Button>
        </form>

        <div className="mt-6">
          <div className="mb-2 text-center text-xs font-medium uppercase tracking-wider text-fg-muted">
            Демо-доступы
          </div>
          <div className="grid grid-cols-3 gap-2">
            {DEMO_USERS.map((u) => (
              <button
                key={u.login}
                type="button"
                onClick={() => {
                  setUsername(u.login)
                  setPassword(u.pass)
                  setError('')
                }}
                className="rounded-xl border border-line bg-surface px-2 py-2.5 text-center hover:border-brand-300 hover:bg-brand-50/60"
              >
                <div className="text-xs font-semibold text-fg">{u.login}</div>
                <div className="mt-0.5 text-[11px] text-fg-muted">{u.role}</div>
              </button>
            ))}
          </div>
          <p className="mt-2.5 text-center text-xs text-fg-muted">
            Нажмите, чтобы подставить логин и пароль
          </p>
        </div>
      </div>
    </div>
  )
}

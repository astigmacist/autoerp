import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, ShoppingCart, Package, Warehouse, Receipt,
  BarChart3, LogOut, MoreHorizontal, X, Sun, Moon, type LucideIcon,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useAuth } from '@/store/auth'
import { useTheme } from '@/store/theme'

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  roles: string[]
  /** Совпадать только с точным адресом (для «/» иначе подсвечивалось бы всегда). */
  end?: boolean
}

const NAV: NavItem[] = [
  { to: '/', label: 'Дашборд', icon: LayoutDashboard, roles: ['owner', 'stock', 'seller'], end: true },
  { to: '/sale', label: 'Продажа', icon: ShoppingCart, roles: ['owner', 'seller'] },
  { to: '/products', label: 'Товары', icon: Package, roles: ['owner', 'stock', 'seller'] },
  { to: '/stock', label: 'Склад', icon: Warehouse, roles: ['owner', 'stock'] },
  { to: '/sales', label: 'Продажи', icon: Receipt, roles: ['owner', 'stock', 'seller'] },
  { to: '/reports', label: 'Отчёты', icon: BarChart3, roles: ['owner', 'stock'] },
]

/** Сколько пунктов помещается в нижнюю панель до кнопки «Ещё». */
const BOTTOM_BAR_SLOTS = 4

const ROLE_LABELS: Record<string, string> = {
  owner: 'Владелец',
  stock: 'Менеджер склада',
  seller: 'Продавец',
}

function ThemeToggle({ withLabel = false }: { withLabel?: boolean }) {
  const { theme, toggle } = useTheme()
  const isDark = theme === 'dark'
  const label = isDark ? 'Светлая тема' : 'Тёмная тема'
  return (
    <button
      onClick={toggle}
      aria-label={label}
      title={label}
      className={
        withLabel
          ? 'flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
          : 'flex h-10 w-10 items-center justify-center rounded-xl text-gray-500 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
      }
    >
      {isDark ? <Sun size={18} /> : <Moon size={18} />}
      {withLabel && label}
    </button>
  )
}

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [moreOpen, setMoreOpen] = useState(false)

  // Меню «Ещё» закрывается при переходе — иначе оно остаётся поверх новой страницы.
  useEffect(() => {
    setMoreOpen(false)
  }, [location.pathname])

  function handleLogout() {
    logout()
    navigate('/login')
  }

  const items = NAV.filter((i) => !user || i.roles.includes(user.role))
  const primary = items.slice(0, BOTTOM_BAR_SLOTS)
  const secondary = items.slice(BOTTOM_BAR_SLOTS)

  const current = items.find((i) => (i.end ? location.pathname === i.to : location.pathname.startsWith(i.to)))

  return (
    <div className="min-h-screen flex bg-[#f6f7f9] dark:bg-[#0f1115]">
      {/* Боковая панель — только на большом экране */}
      <aside className="hidden md:flex w-60 flex-col border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-[#151720] shrink-0">
        <div className="h-16 flex items-center px-5 font-semibold text-lg text-gray-900 dark:text-gray-100">
          AutoZap <span className="text-gray-400 font-normal ml-1 text-sm">ERP</span>
        </div>
        <nav className="flex-1 px-3 space-y-1">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`
              }
            >
              <item.icon size={18} />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-gray-100 dark:border-gray-800">
          <div className="px-3 py-2 text-sm">
            <div className="font-medium text-gray-900 dark:text-gray-100">{user?.full_name}</div>
            <div className="text-gray-400 text-xs">{ROLE_LABELS[user?.role ?? ''] ?? ''}</div>
          </div>
          <ThemeToggle withLabel />
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <LogOut size={18} /> Выйти
          </button>
        </div>
      </aside>

      {/* Верхняя полоса — только на телефоне */}
      <header className="md:hidden fixed top-0 inset-x-0 z-40 h-14 bg-white dark:bg-[#151720] border-b border-gray-200 dark:border-gray-800 flex items-center justify-between pl-4 pr-2">
        <div className="font-semibold text-gray-900 dark:text-gray-100">{current?.label ?? 'AutoZap'}</div>
        <ThemeToggle />
      </header>

      <main className="flex-1 min-w-0 pt-14 pb-20 md:pt-0 md:pb-0">
        <div className="p-4 md:p-6 max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>

      {/* Нижняя панель — основной способ навигации на телефоне: до неё легко
          дотянуться большим пальцем, в отличие от бокового меню за «гамбургером». */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white dark:bg-[#151720] border-t border-gray-200 dark:border-gray-800 pb-[env(safe-area-inset-bottom)]">
        <div className="flex">
          {primary.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors ${
                  isActive ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span className={`flex h-7 w-12 items-center justify-center rounded-lg ${
                    isActive ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900' : ''
                  }`}>
                    <item.icon size={18} />
                  </span>
                  {item.label}
                </>
              )}
            </NavLink>
          ))}
          <button
            onClick={() => setMoreOpen(true)}
            className="flex-1 flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium text-gray-400 dark:text-gray-500"
          >
            <span className="flex h-7 w-12 items-center justify-center rounded-lg">
              <MoreHorizontal size={18} />
            </span>
            Ещё
          </button>
        </div>
      </nav>

      {/* Шторка «Ещё»: остальные разделы и настройки */}
      {moreOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMoreOpen(false)} />
          <div className="absolute bottom-0 inset-x-0 rounded-t-2xl bg-white dark:bg-[#151720] p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between px-2 py-2 mb-1">
              <div>
                <div className="font-semibold text-gray-900 dark:text-gray-100">{user?.full_name}</div>
                <div className="text-xs text-gray-400">{ROLE_LABELS[user?.role ?? ''] ?? ''}</div>
              </div>
              <button
                onClick={() => setMoreOpen(false)}
                aria-label="Закрыть"
                className="flex h-10 w-10 items-center justify-center rounded-xl text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <X size={20} />
              </button>
            </div>

            {secondary.length > 0 && (
              <nav className="space-y-1 mb-2">
                {secondary.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      `flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium ${
                        isActive
                          ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900'
                          : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                      }`
                    }
                  >
                    <item.icon size={18} />
                    {item.label}
                  </NavLink>
                ))}
              </nav>
            )}

            <div className="border-t border-gray-100 dark:border-gray-800 pt-2 space-y-1">
              <ThemeToggle withLabel />
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <LogOut size={18} /> Выйти
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

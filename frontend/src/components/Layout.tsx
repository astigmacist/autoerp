import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, ShoppingCart, Package, Warehouse, Receipt,
  BarChart3, LogOut, Menu, X,
} from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '@/store/auth'

const NAV = [
  { to: '/', label: 'Дашборд', icon: LayoutDashboard, roles: ['owner', 'stock', 'seller'] },
  { to: '/sale', label: 'Продажа', icon: ShoppingCart, roles: ['owner', 'seller'] },
  { to: '/products', label: 'Товары', icon: Package, roles: ['owner', 'stock', 'seller'] },
  { to: '/stock', label: 'Склад', icon: Warehouse, roles: ['owner', 'stock'] },
  { to: '/sales', label: 'Продажи', icon: Receipt, roles: ['owner', 'stock', 'seller'] },
  { to: '/reports', label: 'Отчёты', icon: BarChart3, roles: ['owner', 'stock'] },
]

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)

  function handleLogout() {
    logout()
    navigate('/login')
  }

  const items = NAV.filter((i) => !user || i.roles.includes(user.role))

  return (
    <div className="min-h-screen flex bg-[#f6f7f9] dark:bg-[#0f1115]">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-60 flex-col border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-[#151720] shrink-0">
        <div className="h-16 flex items-center px-5 font-semibold text-lg text-gray-900 dark:text-gray-100">
          AutoZap <span className="text-gray-400 font-normal ml-1 text-sm">ERP</span>
        </div>
        <nav className="flex-1 px-3 space-y-1">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
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
            <div className="text-gray-400 text-xs">
              {user?.role === 'owner' ? 'Владелец' : user?.role === 'stock' ? 'Менеджер склада' : 'Продавец'}
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <LogOut size={16} /> Выйти
          </button>
        </div>
      </aside>

      {/* Mobile top bar + drawer */}
      <div className="md:hidden fixed top-0 inset-x-0 z-40 h-14 bg-white dark:bg-[#151720] border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-4">
        <button onClick={() => setMobileOpen(true)} className="text-gray-700 dark:text-gray-200">
          <Menu size={22} />
        </button>
        <div className="font-semibold text-gray-900 dark:text-gray-100">AutoZap</div>
        <div className="w-6" />
      </div>
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <div className="relative w-64 bg-white dark:bg-[#151720] h-full p-3 flex flex-col">
            <div className="flex items-center justify-between px-2 py-2 mb-2">
              <span className="font-semibold text-gray-900 dark:text-gray-100">AutoZap</span>
              <button onClick={() => setMobileOpen(false)}>
                <X size={20} />
              </button>
            </div>
            <nav className="flex-1 space-y-1">
              {items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium ${
                      isActive ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900' : 'text-gray-600 dark:text-gray-300'
                    }`
                  }
                >
                  <item.icon size={18} />
                  {item.label}
                </NavLink>
              ))}
            </nav>
            <button onClick={handleLogout} className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-gray-500">
              <LogOut size={16} /> Выйти
            </button>
          </div>
        </div>
      )}

      <main className="flex-1 min-w-0 pt-14 md:pt-0">
        <div className="p-4 md:p-6 max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  )
}

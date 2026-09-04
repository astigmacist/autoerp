import { NavLink } from 'react-router-dom'

const TABS = [
  { to: '/stock', label: 'Остатки' },
  { to: '/stock/receipts', label: 'Приходы' },
  { to: '/stock/transfers', label: 'Перемещения' },
  { to: '/stock/inventories', label: 'Инвентаризация' },
  { to: '/stock/writeoffs', label: 'Списания' },
]

export default function WarehouseTabs() {
  return (
    <div className="flex gap-1 overflow-x-auto -mx-1 px-1">
      {TABS.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          end
          className={({ isActive }) =>
            `whitespace-nowrap rounded-xl px-3 py-1.5 text-sm font-medium transition-colors ${
              isActive
                ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900'
                : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`
          }
        >
          {t.label}
        </NavLink>
      ))}
    </div>
  )
}

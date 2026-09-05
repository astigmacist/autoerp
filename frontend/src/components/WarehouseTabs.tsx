import { NavLink } from 'react-router-dom'

const TABS = [
  { to: '/stock', label: 'Остатки' },
  { to: '/stock/receipts', label: 'Приходы' },
  { to: '/stock/transfers', label: 'Перемещения' },
  { to: '/stock/inventories', label: 'Инвентаризация' },
  { to: '/stock/writeoffs', label: 'Списания' },
]

/**
 * Разделы склада. Оформлены как единый переключатель в рамке — так же, как
 * переключатель периода на дашборде: одинаковые элементы должны выглядеть
 * одинаково, иначе интерфейс кажется собранным из разных мест.
 */
export default function WarehouseTabs() {
  return (
    <div className="-mx-1 overflow-x-auto px-1 pb-0.5">
      <div className="inline-flex gap-1 rounded-xl border border-line bg-surface p-1">
        {TABS.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end
            className={({ isActive }) =>
              `whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-gray-900 text-white shadow-card dark:bg-gray-100 dark:text-gray-900'
                  : 'text-fg-muted hover:bg-surface-muted hover:text-fg'
              }`
            }
          >
            {t.label}
          </NavLink>
        ))}
      </div>
    </div>
  )
}

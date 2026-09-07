import { useEffect, useRef, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'

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
 *
 * На телефоне пять вкладок в строку не помещаются. Раньше это было просто
 * обрезано у правого края: со «Списаний» не было видно ни своей вкладки, ни
 * того, что список вообще можно листать. Теперь открытая вкладка сама
 * подъезжает в поле зрения, а у края, за которым что-то есть, лежит тень.
 */
export default function WarehouseTabs() {
  const scroller = useRef<HTMLDivElement>(null)
  const { pathname } = useLocation()
  const [edges, setEdges] = useState({ left: false, right: false })

  function syncEdges() {
    const el = scroller.current
    if (!el) return
    setEdges({
      left: el.scrollLeft > 4,
      right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4,
    })
  }

  useEffect(() => {
    const active = scroller.current?.querySelector('[aria-current="page"]')
    active?.scrollIntoView({ inline: 'center', block: 'nearest' })
    syncEdges()
  }, [pathname])

  return (
    <div className="relative">
      <div
        ref={scroller}
        onScroll={syncEdges}
        className="-mx-1 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
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

      {edges.left && (
        <div className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-canvas to-transparent" aria-hidden />
      )}
      {edges.right && (
        <div className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-canvas to-transparent" aria-hidden />
      )}
    </div>
  )
}

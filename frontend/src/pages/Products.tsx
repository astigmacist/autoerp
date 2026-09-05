import { useState } from 'react'
import { Pencil, Plus, Archive, ArchiveRestore } from 'lucide-react'
import { useProducts } from '@/api/queries'
import { useAuth } from '@/store/auth'
import { formatMoney, formatQty } from '@/lib/format'
import { api, getApiError } from '@/api/client'
import { useToast } from '@/store/toast'
import { useQueryClient } from '@tanstack/react-query'
import ProductFormModal from '@/components/ProductFormModal'
import type { Product } from '@/api/types'

export default function Products() {
  const [search, setSearch] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const { data, isLoading } = useProducts({ search: search || undefined })
  const { permissions } = useAuth()
  const { push } = useToast()
  const qc = useQueryClient()

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)

  const canManage = !!permissions?.can_manage_catalog

  function openCreate() {
    setEditing(null)
    setModalOpen(true)
  }

  function openEdit(p: Product) {
    setEditing(p)
    setModalOpen(true)
  }

  async function toggleActive(p: Product) {
    try {
      await api.patch(`/products/${p.id}/`, { is_active: !p.is_active })
      qc.invalidateQueries({ queryKey: ['products'] })
      push(p.is_active ? 'Товар архивирован' : 'Товар восстановлен', 'success')
    } catch (err) {
      push(getApiError(err).detail, 'error')
    }
  }

  const rows = (data?.results ?? []).filter((p) => showInactive || p.is_active)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        {/* На телефоне это же название уже показано в верхней полосе. */}
        <h1 className="hidden md:block text-xl font-semibold text-gray-900 dark:text-gray-100">Товары</h1>
        <div className="flex w-full md:w-auto items-center gap-2 flex-wrap">
          <input
            placeholder="Поиск по названию, коду, OEM…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-40 md:flex-none md:w-72 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#151720] px-3 py-2.5 md:py-2 text-sm outline-none"
          />
          {canManage && (
            <button
              onClick={openCreate}
              className="flex shrink-0 items-center gap-1.5 px-3.5 py-2.5 md:py-2 rounded-xl text-sm font-semibold bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900"
            >
              <Plus size={15} /> Новый товар
            </button>
          )}
          <label className="flex w-full md:w-auto items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
            <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
            показывать архивные
          </label>
        </div>
      </div>

      {/* На телефоне таблица из восьми колонок нечитаема — там карточки. */}
      <div className="md:hidden space-y-2">
        {isLoading && <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#151720] px-4 py-8 text-center text-sm text-gray-400">Загрузка…</div>}
        {!isLoading && rows.length === 0 && <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#151720] px-4 py-8 text-center text-sm text-gray-400">Ничего не найдено</div>}
        {rows.map((p) => {
          const main = p.stocks.find((s) => s.warehouse_code === 'MAIN')
          const shop = p.stocks.find((s) => s.warehouse_code === 'SHOP')
          const shopLow = shop && parseFloat(shop.quantity) < p.min_stock
          return (
            <div
              key={p.id}
              className={`rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#151720] p-3 ${!p.is_active ? 'opacity-60' : ''}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium text-gray-900 dark:text-gray-100">{p.name}</div>
                  <div className="text-xs text-gray-400">
                    {p.sku}
                    {p.oem_code && ` · ${p.oem_code}`}
                    {p.brand_name && ` · ${p.brand_name}`}
                    {!p.is_active && ' · в архиве'}
                  </div>
                </div>
                {canManage && (
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      onClick={() => openEdit(p)}
                      aria-label="Редактировать"
                      className="flex h-9 w-9 items-center justify-center rounded-xl text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => toggleActive(p)}
                      aria-label={p.is_active ? 'В архив' : 'Восстановить'}
                      className="flex h-9 w-9 items-center justify-center rounded-xl text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                    >
                      {p.is_active ? <Archive size={15} /> : <ArchiveRestore size={15} />}
                    </button>
                  </div>
                )}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                <span>
                  Цена <span className="font-semibold tabular-nums text-gray-900 dark:text-gray-100">{formatMoney(p.sale_price)}</span>
                </span>
                {permissions?.can_see_cost && (
                  <span>Себестоимость <span className="tabular-nums">{p.avg_cost ? formatMoney(p.avg_cost) : '—'}</span></span>
                )}
                <span>Основной <span className="tabular-nums">{main ? formatQty(main.quantity) : 0}</span></span>
                <span className={shopLow ? 'text-red-600 dark:text-red-400 font-semibold' : ''}>
                  Магазин <span className="tabular-nums">{shop ? formatQty(shop.quantity) : 0}</span>
                </span>
              </div>
            </div>
          )
        })}
      </div>

      <div className="hidden md:block rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#151720] overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400">
            <tr>
              <th className="text-left font-medium px-4 py-2.5">Товар</th>
              <th className="text-left font-medium px-2 py-2.5">OEM</th>
              <th className="text-left font-medium px-2 py-2.5">Бренд</th>
              <th className="text-right font-medium px-2 py-2.5">Цена</th>
              {permissions?.can_see_cost && <th className="text-right font-medium px-2 py-2.5">Себестоимость</th>}
              <th className="text-right font-medium px-4 py-2.5">Основной</th>
              <th className="text-right font-medium px-4 py-2.5">Магазин</th>
              {canManage && <th className="text-right font-medium px-4 py-2.5"></th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {isLoading && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">Загрузка…</td></tr>
            )}
            {!isLoading && rows.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">Ничего не найдено</td></tr>
            )}
            {rows.map((p) => {
              const main = p.stocks.find((s) => s.warehouse_code === 'MAIN')
              const shop = p.stocks.find((s) => s.warehouse_code === 'SHOP')
              return (
                <tr key={p.id} className={!p.is_active ? 'opacity-50' : ''}>
                  <td className="px-4 py-2.5">
                    <div className="font-medium text-gray-900 dark:text-gray-100">{p.name}</div>
                    <div className="text-xs text-gray-400">{p.sku}{!p.is_active && ' · в архиве'}</div>
                  </td>
                  <td className="px-2 py-2.5 text-gray-500">{p.oem_code || '—'}</td>
                  <td className="px-2 py-2.5 text-gray-500">{p.brand_name || '—'}</td>
                  <td className="px-2 py-2.5 text-right font-medium tabular-nums">{formatMoney(p.sale_price)}</td>
                  {permissions?.can_see_cost && (
                    <td className="px-2 py-2.5 text-right text-gray-500 tabular-nums">{p.avg_cost ? formatMoney(p.avg_cost) : '—'}</td>
                  )}
                  <td className="px-4 py-2.5 text-right tabular-nums">{main ? formatQty(main.quantity) : 0}</td>
                  <td className={`px-4 py-2.5 text-right tabular-nums ${shop && parseFloat(shop.quantity) < p.min_stock ? 'text-red-600 font-semibold' : ''}`}>
                    {shop ? formatQty(shop.quantity) : 0}
                  </td>
                  {canManage && (
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(p)}
                          title="Редактировать"
                          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => toggleActive(p)}
                          title={p.is_active ? 'В архив' : 'Восстановить'}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
                        >
                          {p.is_active ? <Archive size={14} /> : <ArchiveRestore size={14} />}
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {canManage && (
        <ProductFormModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          product={editing}
        />
      )}
    </div>
  )
}

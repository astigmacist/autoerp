import { useState } from 'react'
import { Pencil, Plus, Archive, ArchiveRestore, Package } from 'lucide-react'
import { useProducts } from '@/api/queries'
import { useAuth } from '@/store/auth'
import { formatMoney, formatQty } from '@/lib/format'
import { api, getApiError } from '@/api/client'
import { useToast } from '@/store/toast'
import { useQueryClient } from '@tanstack/react-query'
import ProductFormModal from '@/components/ProductFormModal'
import type { Product } from '@/api/types'
import { Card, EmptyState, SkeletonList, SkeletonRows, Toggle, fieldClass } from '@/components/ui'

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
        <h1 className="hidden md:block text-xl font-semibold text-fg">Товары</h1>
        <div className="flex w-full md:w-auto items-center gap-2 flex-wrap">
          <input
            placeholder="Поиск по названию, коду, OEM…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`flex-1 min-w-40 md:flex-none md:w-72 ${fieldClass} h-11 md:h-10`}
          />
          {canManage && (
            <button
              onClick={openCreate}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 text-sm font-semibold text-white transition-transform hover:bg-gray-800 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white shrink-0"
            >
              <Plus size={15} /> Новый товар
            </button>
          )}
          <Toggle checked={showInactive} onChange={setShowInactive}>
            Архивные
          </Toggle>
        </div>
      </div>

      {/* На телефоне таблица из восьми колонок нечитаема — там карточки. */}
      <div className="md:hidden space-y-2">
        {isLoading && <SkeletonList rows={3} />}
        {!isLoading && rows.length === 0 && <Card padded={false}><EmptyState icon={<Package size={20} />} title="Ничего не найдено" /></Card>}
        {rows.map((p) => {
          const main = p.stocks.find((s) => s.warehouse_code === 'MAIN')
          const shop = p.stocks.find((s) => s.warehouse_code === 'SHOP')
          const shopLow = shop && parseFloat(shop.quantity) < p.min_stock
          return (
            <div
              key={p.id}
              className={`rounded-2xl border border-line bg-surface p-3 ${!p.is_active ? 'opacity-60' : ''}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium text-fg">{p.name}</div>
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
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-fg-muted">
                <span>
                  Цена <span className="font-semibold tabular-nums text-fg">{formatMoney(p.sale_price)}</span>
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

      <div className="hidden md:block rounded-2xl border border-line bg-surface overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead className="bg-surface-muted text-fg-muted">
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
          <tbody className="divide-y divide-line">
            {isLoading && (
              <SkeletonRows rows={4} cols={8} />
            )}
            {!isLoading && rows.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-4"><EmptyState icon={<Package size={20} />} title="Ничего не найдено" /></td></tr>
            )}
            {rows.map((p) => {
              const main = p.stocks.find((s) => s.warehouse_code === 'MAIN')
              const shop = p.stocks.find((s) => s.warehouse_code === 'SHOP')
              return (
                <tr key={p.id} className={!p.is_active ? 'opacity-50' : ''}>
                  <td className="px-4 py-2.5">
                    <div className="font-medium text-fg">{p.name}</div>
                    <div className="text-xs text-gray-400">{p.sku}{!p.is_active && ' · в архиве'}</div>
                  </td>
                  <td className="whitespace-nowrap px-2 py-2.5 text-fg-muted">{p.oem_code || '—'}</td>
                  <td className="whitespace-nowrap px-2 py-2.5 text-fg-muted">{p.brand_name || '—'}</td>
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
                      <div className="row-actions flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(p)}
                          title="Редактировать"
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-fg-muted hover:bg-surface-muted hover:text-fg"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => toggleActive(p)}
                          title={p.is_active ? 'В архив' : 'Восстановить'}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-fg-muted hover:bg-surface-muted hover:text-fg"
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

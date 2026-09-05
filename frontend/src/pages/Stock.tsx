import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Download, Loader2, Boxes } from 'lucide-react'
import { api, getApiError } from '@/api/client'
import { useStock, useWarehouses } from '@/api/queries'
import { useToast } from '@/store/toast'
import StockBadge from '@/components/StockBadge'
import WarehouseTabs from '@/components/WarehouseTabs'
import { formatDateTime, todayIso } from '@/lib/format'
import { triggerDownload } from '@/lib/download'
import { Card, EmptyState, SkeletonList, SkeletonRows, Toggle, fieldClass } from '@/components/ui'

export default function Stock() {
  const [params] = useSearchParams()
  const { data: warehouses } = useWarehouses()
  const [warehouseId, setWarehouseId] = useState<string>('')
  const [onlyLow, setOnlyLow] = useState(params.get('low_stock') === 'true')
  const [search, setSearch] = useState('')
  const { push } = useToast()
  const [exporting, setExporting] = useState(false)

  const { data, isLoading } = useStock({ warehouse: warehouseId || undefined })

  async function exportExcel() {
    setExporting(true)
    try {
      const res = await api.get('/reports/stock/export/', {
        params: { warehouse: warehouseId || undefined },
        responseType: 'blob',
      })
      triggerDownload(res.data, `AutoZap_ostatki_${todayIso()}.xlsx`)
    } catch (err) {
      push(getApiError(err).detail, 'error')
    } finally {
      setExporting(false)
    }
  }

  const rows = useMemo(() => {
    let list = data?.results ?? []
    if (onlyLow) list = list.filter((r) => r.status === 'low' || r.status === 'out')
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((r) => r.product_name.toLowerCase().includes(q) || r.sku.toLowerCase().includes(q))
    }
    return list
  }, [data, onlyLow, search])

  return (
    <div className="space-y-4">
      <WarehouseTabs />
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-semibold text-fg">Остатки</h1>
        <div className="flex w-full md:w-auto items-center gap-2 flex-wrap">
          <input
            placeholder="Поиск…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`flex-1 min-w-32 sm:flex-none ${fieldClass} h-11 md:h-10`}
          />
          <select
            value={warehouseId}
            onChange={(e) => setWarehouseId(e.target.value)}
            className={`${fieldClass} h-11 md:h-10 w-auto`}
          >
            <option value="">Все склады</option>
            {warehouses?.map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
          <Toggle checked={onlyLow} onChange={setOnlyLow}>
            Только дефицит
          </Toggle>
          <button
            onClick={exportExcel}
            disabled={exporting}
            className="inline-flex h-11 md:h-10 items-center justify-center gap-1.5 rounded-xl border border-line-strong bg-surface px-3 text-sm font-semibold text-fg transition-transform hover:bg-surface-muted active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40"
          >
            {exporting ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />} Excel
          </button>
        </div>
      </div>

      <div className="md:hidden space-y-2">
        {isLoading && <SkeletonList rows={3} />}
        {!isLoading && rows.length === 0 && <Card padded={false}><EmptyState icon={<Boxes size={20} />} title="Ничего не найдено" /></Card>}
        {rows.map((r) => (
          <div key={r.id} className="rounded-2xl border border-line bg-surface p-3">
            <div className="font-medium text-fg">{r.product_name}</div>
            <div className="text-xs text-gray-400">{r.sku} · {r.warehouse_name}</div>
            <div className="mt-2 flex items-center justify-between gap-2">
              <StockBadge status={r.status} quantity={r.quantity} />
              <span className="text-xs text-gray-400">{formatDateTime(r.updated_at)}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="hidden md:block rounded-2xl border border-line bg-surface overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface-muted text-fg-muted">
            <tr>
              <th className="text-left font-medium px-4 py-2.5">Товар</th>
              <th className="text-left font-medium px-2 py-2.5">Склад</th>
              <th className="text-right font-medium px-4 py-2.5">Остаток</th>
              <th className="text-right font-medium px-4 py-2.5">Обновлено</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {isLoading && (
              <SkeletonRows rows={4} cols={4} />
            )}
            {!isLoading && rows.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-4"><EmptyState icon={<Boxes size={20} />} title="Ничего не найдено" /></td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-2.5">
                  <div className="font-medium text-fg">{r.product_name}</div>
                  <div className="text-xs text-gray-400">{r.sku}</div>
                </td>
                <td className="px-2 py-2.5 text-gray-500">{r.warehouse_name}</td>
                <td className="px-4 py-2.5 text-right"><StockBadge status={r.status} quantity={r.quantity} /></td>
                <td className="px-4 py-2.5 text-right text-gray-400 text-xs">{formatDateTime(r.updated_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

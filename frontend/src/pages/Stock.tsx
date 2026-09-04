import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Download, Loader2 } from 'lucide-react'
import { api, getApiError } from '@/api/client'
import { useStock, useWarehouses } from '@/api/queries'
import { useToast } from '@/store/toast'
import StockBadge from '@/components/StockBadge'
import WarehouseTabs from '@/components/WarehouseTabs'
import { formatDateTime, todayIso } from '@/lib/format'
import { triggerDownload } from '@/lib/download'

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
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Остатки</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <input
            placeholder="Поиск…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#151720] px-3 py-2 text-sm outline-none"
          />
          <select
            value={warehouseId}
            onChange={(e) => setWarehouseId(e.target.value)}
            className="rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#151720] px-3 py-2 text-sm outline-none"
          >
            <option value="">Все склады</option>
            {warehouses?.map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 px-2">
            <input type="checkbox" checked={onlyLow} onChange={(e) => setOnlyLow(e.target.checked)} />
            Только дефицит
          </label>
          <button
            onClick={exportExcel}
            disabled={exporting}
            className="flex items-center gap-1.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#151720] px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40"
          >
            {exporting ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />} Excel
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#151720] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400">
            <tr>
              <th className="text-left font-medium px-4 py-2.5">Товар</th>
              <th className="text-left font-medium px-2 py-2.5">Склад</th>
              <th className="text-right font-medium px-4 py-2.5">Остаток</th>
              <th className="text-right font-medium px-4 py-2.5">Обновлено</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {isLoading && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">Загрузка…</td></tr>
            )}
            {!isLoading && rows.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">Ничего не найдено</td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-2.5">
                  <div className="font-medium text-gray-900 dark:text-gray-100">{r.product_name}</div>
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

import { useState } from 'react'
import { Search, Loader2, PackagePlus } from 'lucide-react'
import { useProductSearch } from '@/api/queries'
import { formatMoney, formatQty } from '@/lib/format'
import type { ProductSearchResult } from '@/api/types'
import { fieldClass } from '@/components/ui'

interface Props {
  onSelect: (p: ProductSearchResult) => void
  placeholder?: string
  /** When provided, shows a "product not found — create new" option once a search yields no results. */
  onCreateNew?: (name: string) => void
}

export default function ProductPicker({ onSelect, placeholder, onCreateNew }: Props) {
  const [query, setQuery] = useState('')
  const { data: results, isFetching } = useProductSearch(query)

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder ?? 'Найти товар по названию, коду, OEM…'}
          className={`${fieldClass} h-11 md:h-10 pl-9`}
        />
        {isFetching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-gray-400" size={14} />}
      </div>
      {query.trim().length >= 2 && (
        <div className="absolute z-20 mt-1 w-full rounded-xl border border-line bg-surface shadow-lg divide-y divide-line max-h-64 overflow-y-auto">
          {!isFetching && results?.length === 0 && (
            <div className="p-3">
              <div className="text-sm text-gray-400 mb-2">Ничего не найдено</div>
              {onCreateNew && (
                <button
                  type="button"
                  onClick={() => {
                    onCreateNew(query.trim())
                    setQuery('')
                  }}
                  className="w-full flex items-center gap-2 text-left px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm font-medium text-gray-700 dark:text-gray-200"
                >
                  <PackagePlus size={15} className="text-gray-400 shrink-0" />
                  Создать новый товар «{query.trim()}»
                </button>
              )}
            </div>
          )}
          {results?.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                onSelect(p)
                setQuery('')
              }}
              className="w-full text-left px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center justify-between gap-2"
            >
              <div className="min-w-0">
                <div className="text-sm font-medium text-fg truncate">{p.name}</div>
                <div className="text-xs text-gray-400">{p.sku}</div>
              </div>
              <div className="text-right shrink-0 text-xs text-gray-400">
                <div>{formatMoney(p.sale_price)}</div>
                <div>осн: {formatQty(p.main_qty)} · маг: {formatQty(p.shop_qty)}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

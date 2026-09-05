import { PackageSearch, PackagePlus } from 'lucide-react'
import ProductPicker from '@/components/ProductPicker'
import type { ProductSearchResult } from '@/api/types'

interface Props {
  onSelect: (product: ProductSearchResult) => void
  /**
   * Заведение нового товара. Не передан — кнопка не показывается
   * (например, у продавца нет прав на управление каталогом).
   */
  onCreateNew?: (name: string) => void
  placeholder?: string
  label?: string
}

/**
 * Добавление товара в документ с явным выбором: взять из базы или завести новый.
 *
 * Раньше здесь было просто поле поиска, а «создать новый товар» появлялось только
 * после того, как поиск ничего не нашёл, — про эту возможность нельзя было
 * догадаться. Теперь оба пути видны сразу, а поиск остаётся сразу готовым к вводу,
 * потому что «из базы» — самый частый случай.
 */
export default function AddProductBar({ onSelect, onCreateNew, placeholder, label = 'Добавить товар' }: Props) {
  return (
    <div>
      <div className="text-xs text-gray-500 dark:text-gray-400 mb-1.5">{label}</div>

      <div className="flex flex-wrap items-center gap-2 mb-2">
        <span className="inline-flex items-center gap-1.5 rounded-xl bg-gray-900 dark:bg-gray-100 px-3 py-2 text-sm font-medium text-white dark:text-gray-900">
          <PackageSearch size={15} /> Из базы
        </span>
        {onCreateNew && (
          <>
            <span className="text-xs text-gray-400">или</span>
            <button
              type="button"
              onClick={() => onCreateNew('')}
              className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              <PackagePlus size={15} /> Новый товар
            </button>
          </>
        )}
      </div>

      <ProductPicker
        onSelect={onSelect}
        onCreateNew={onCreateNew}
        placeholder={placeholder ?? 'Начните вводить название, код или OEM…'}
      />

      <div className="mt-1.5 text-xs text-gray-400">
        {onCreateNew
          ? 'Из базы — товар уже заведён, добавляется сразу. Новый товар — форма со всеми полями.'
          : 'Товар выбирается из базы. Новые товары заводятся в разделе «Товары».'}
      </div>
    </div>
  )
}

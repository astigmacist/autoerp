import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Loader2, Plus } from 'lucide-react'
import { api, getApiError } from '@/api/client'
import { useBrands, useCategories } from '@/api/queries'
import { useToast } from '@/store/toast'
import Modal from '@/components/Modal'
import type { Product } from '@/api/types'

interface Props {
  open: boolean
  onClose: () => void
  product?: Product | null
  /** Pre-fills the name field, e.g. when invoked from a receipt line search that found nothing. */
  initialName?: string
  onSaved?: (product: Product) => void
}

const UNIT_OPTIONS = [
  { value: 'pcs', label: 'шт' },
  { value: 'set', label: 'компл' },
  { value: 'l', label: 'л' },
  { value: 'kg', label: 'кг' },
]

function emptyForm(initialName?: string) {
  return {
    name: initialName ?? '',
    sku: '',
    oem_code: '',
    barcode: '',
    brand: '' as string | number,
    category: '' as string | number,
    unit: 'pcs',
    purchase_price: '',
    sale_price: '',
    min_price: '',
    min_stock: '5',
    applicability: '',
    location: '',
    note: '',
    is_active: true,
  }
}

export default function ProductFormModal({ open, onClose, product, initialName, onSaved }: Props) {
  const { data: brands } = useBrands()
  const { data: categories } = useCategories()
  const { push } = useToast()
  const qc = useQueryClient()

  const [form, setForm] = useState(emptyForm(initialName))
  const [saving, setSaving] = useState(false)

  const [addingBrand, setAddingBrand] = useState(false)
  const [newBrandName, setNewBrandName] = useState('')
  const [addingCategory, setAddingCategory] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')

  useEffect(() => {
    if (!open) return
    if (product) {
      setForm({
        name: product.name,
        sku: product.sku,
        oem_code: product.oem_code || '',
        barcode: product.barcode || '',
        brand: product.brand ?? '',
        category: product.category ?? '',
        unit: product.unit,
        purchase_price: product.purchase_price ?? '',
        sale_price: product.sale_price,
        min_price: product.min_price ?? '',
        min_stock: String(product.min_stock),
        applicability: product.applicability,
        location: product.location,
        note: product.note,
        is_active: product.is_active,
      })
    } else {
      setForm(emptyForm(initialName))
    }
    setAddingBrand(false)
    setAddingCategory(false)
  }, [open, product, initialName])

  function set<K extends keyof ReturnType<typeof emptyForm>>(key: K, value: ReturnType<typeof emptyForm>[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function createBrand() {
    if (!newBrandName.trim()) return
    try {
      const { data } = await api.post('/brands/', { name: newBrandName.trim() })
      qc.invalidateQueries({ queryKey: ['brands'] })
      set('brand', data.id)
      setAddingBrand(false)
      setNewBrandName('')
    } catch (err) {
      push(getApiError(err).detail, 'error')
    }
  }

  async function createCategory() {
    if (!newCategoryName.trim()) return
    try {
      const { data } = await api.post('/categories/', { name: newCategoryName.trim() })
      qc.invalidateQueries({ queryKey: ['categories'] })
      set('category', data.id)
      setAddingCategory(false)
      setNewCategoryName('')
    } catch (err) {
      push(getApiError(err).detail, 'error')
    }
  }

  const isEdit = !!product
  const canSave = form.name.trim().length > 0 && (isEdit || form.sku.trim().length > 0 || true)

  async function handleSubmit() {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        oem_code: form.oem_code.trim(),
        barcode: form.barcode.trim() || null,
        brand: form.brand || null,
        category: form.category || null,
        unit: form.unit,
        sale_price: form.sale_price || 0,
        min_price: form.min_price === '' ? null : form.min_price,
        min_stock: form.min_stock || 5,
        applicability: form.applicability,
        location: form.location,
        note: form.note,
      }
      if (!isEdit) {
        payload.sku = form.sku.trim() || undefined
        payload.purchase_price = form.purchase_price || 0
      } else {
        payload.is_active = form.is_active
        if (form.purchase_price !== '') payload.purchase_price = form.purchase_price
      }

      let saved: Product
      if (isEdit) {
        const { data } = await api.patch<Product>(`/products/${product!.id}/`, payload)
        saved = data
        push('Товар обновлён', 'success')
      } else {
        const { data } = await api.post<Product>('/products/', payload)
        saved = data
        push('Товар создан', 'success')
      }
      qc.invalidateQueries({ queryKey: ['products'] })
      qc.invalidateQueries({ queryKey: ['stock'] })
      onSaved?.(saved)
      onClose()
    } catch (err) {
      push(getApiError(err).detail, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => !saving && onClose()}
      title={isEdit ? 'Редактировать товар' : 'Новый товар'}
      width="max-w-2xl"
      footer={
        <>
          <button onClick={onClose} disabled={saving} className="px-4 py-2 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800">
            Отмена
          </button>
          <button onClick={handleSubmit} disabled={saving || !canSave} className="px-4 py-2 rounded-xl text-sm font-semibold bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 flex items-center gap-2 disabled:opacity-40">
            {saving && <Loader2 className="animate-spin" size={14} />} {isEdit ? 'Сохранить' : 'Создать товар'}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <label className="text-xs text-gray-500">Название *</label>
          <input value={form.name} onChange={(e) => set('name', e.target.value)} className="w-full mt-1 rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent px-3 py-2 text-sm outline-none" placeholder="Фильтр масляный Toyota Camry 2.5" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500">Код (SKU) {isEdit && '— нельзя изменить'}</label>
            <input
              value={form.sku}
              disabled={isEdit}
              onChange={(e) => set('sku', e.target.value)}
              placeholder="автоматически, если пусто"
              className="w-full mt-1 rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent px-3 py-2 text-sm outline-none disabled:opacity-50"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500">OEM-код</label>
            <input value={form.oem_code} onChange={(e) => set('oem_code', e.target.value)} className="w-full mt-1 rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent px-3 py-2 text-sm outline-none" placeholder="90915-YZZD4" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500 flex items-center justify-between">
              Бренд
              <button type="button" onClick={() => setAddingBrand((v) => !v)} className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 flex items-center gap-0.5">
                <Plus size={12} /> новый
              </button>
            </label>
            {addingBrand ? (
              <div className="flex gap-1 mt-1">
                <input value={newBrandName} onChange={(e) => setNewBrandName(e.target.value)} placeholder="Название бренда" className="flex-1 rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent px-3 py-2 text-sm outline-none" />
                <button type="button" onClick={createBrand} className="px-3 rounded-xl bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-sm">OK</button>
              </div>
            ) : (
              <select value={form.brand} onChange={(e) => set('brand', e.target.value)} className="w-full mt-1 rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent px-3 py-2 text-sm outline-none">
                <option value="">—</option>
                {brands?.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            )}
          </div>
          <div>
            <label className="text-xs text-gray-500 flex items-center justify-between">
              Категория
              <button type="button" onClick={() => setAddingCategory((v) => !v)} className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 flex items-center gap-0.5">
                <Plus size={12} /> новая
              </button>
            </label>
            {addingCategory ? (
              <div className="flex gap-1 mt-1">
                <input value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} placeholder="Название категории" className="flex-1 rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent px-3 py-2 text-sm outline-none" />
                <button type="button" onClick={createCategory} className="px-3 rounded-xl bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-sm">OK</button>
              </div>
            ) : (
              <select value={form.category} onChange={(e) => set('category', e.target.value)} className="w-full mt-1 rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent px-3 py-2 text-sm outline-none">
                <option value="">—</option>
                {categories?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            )}
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3">
          <div>
            <label className="text-xs text-gray-500">Ед. изм.</label>
            <select value={form.unit} onChange={(e) => set('unit', e.target.value)} className="w-full mt-1 rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent px-3 py-2 text-sm outline-none">
              {UNIT_OPTIONS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500">Розничная цена</label>
            <input type="number" value={form.sale_price} onChange={(e) => set('sale_price', e.target.value)} className="w-full mt-1 rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent px-3 py-2 text-sm outline-none tabular-nums" />
          </div>
          <div>
            <label className="text-xs text-gray-500">Мин. цена продажи</label>
            <input type="number" value={form.min_price} onChange={(e) => set('min_price', e.target.value)} placeholder="= себестоимость" className="w-full mt-1 rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent px-3 py-2 text-sm outline-none tabular-nums" />
          </div>
          <div>
            <label className="text-xs text-gray-500">Порог дефицита</label>
            <input type="number" value={form.min_stock} onChange={(e) => set('min_stock', e.target.value)} className="w-full mt-1 rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent px-3 py-2 text-sm outline-none tabular-nums" />
          </div>
        </div>

        {!isEdit && (
          <div>
            <label className="text-xs text-gray-500">Ориентировочная закупочная цена (опционально — точная цена задаётся приходом)</label>
            <input type="number" value={form.purchase_price} onChange={(e) => set('purchase_price', e.target.value)} className="w-full mt-1 rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent px-3 py-2 text-sm outline-none tabular-nums" />
          </div>
        )}

        <div>
          <label className="text-xs text-gray-500">Применимость к авто</label>
          <input value={form.applicability} onChange={(e) => set('applicability', e.target.value)} placeholder="Toyota Camry 40/50, Lexus ES 2006–2012" className="w-full mt-1 rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent px-3 py-2 text-sm outline-none" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500">Место на складе</label>
            <input value={form.location} onChange={(e) => set('location', e.target.value)} placeholder="Стеллаж B, полка 3" className="w-full mt-1 rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent px-3 py-2 text-sm outline-none" />
          </div>
          <div>
            <label className="text-xs text-gray-500">Штрихкод</label>
            <input value={form.barcode} onChange={(e) => set('barcode', e.target.value)} className="w-full mt-1 rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent px-3 py-2 text-sm outline-none" />
          </div>
        </div>

        <div>
          <label className="text-xs text-gray-500">Комментарий</label>
          <input value={form.note} onChange={(e) => set('note', e.target.value)} className="w-full mt-1 rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent px-3 py-2 text-sm outline-none" />
        </div>

        {isEdit && (
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
            <input type="checkbox" checked={form.is_active} onChange={(e) => set('is_active', e.target.checked)} />
            Активен (показывать в поиске и продаже)
          </label>
        )}
      </div>
    </Modal>
  )
}

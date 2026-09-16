import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Loader2, Plus } from 'lucide-react'
import { api, getApiError } from '@/api/client'
import { useBrands, useCategories } from '@/api/queries'
import { useToast } from '@/store/toast'
import Modal from '@/components/Modal'
import type { Product } from '@/api/types'
import { MoneyField, NumericInput, fieldClass } from '@/components/ui'

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
  const canSave = form.name.trim().length > 0

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
          <button onClick={onClose} disabled={saving} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold text-fg-muted transition-transform hover:bg-surface-muted hover:text-fg active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40">
            Отмена
          </button>
          <button onClick={handleSubmit} disabled={saving || !canSave} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 text-sm font-semibold text-white transition-transform hover:bg-gray-800 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white">
            {saving && <Loader2 className="animate-spin" size={14} />} {isEdit ? 'Сохранить' : 'Создать товар'}
          </button>
        </>
      }
    >
      <div className="space-y-5">
        <section className="space-y-3">
          <h4 className="text-xs font-semibold tracking-wide text-fg-muted uppercase">Что за товар</h4>
          <div>
            <label className="text-xs font-medium text-fg-muted">Название *</label>
            <input value={form.name} onChange={(e) => set('name', e.target.value)} className={`mt-1 ${fieldClass} h-11 md:h-10`} placeholder="Фильтр масляный Toyota Camry 2.5" />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-fg-muted">Код (SKU)</label>
              <input
                value={form.sku}
                disabled={isEdit}
                onChange={(e) => set('sku', e.target.value)}
                placeholder="создастся автоматически"
                className={`mt-1 ${fieldClass} h-11 md:h-10 disabled:opacity-50`}
              />
              {isEdit && <div className="mt-1 text-xs text-fg-muted">Код менять нельзя — по нему товар уже в документах</div>}
            </div>
            <div>
              <label className="text-xs font-medium text-fg-muted">OEM-код</label>
              <input value={form.oem_code} onChange={(e) => set('oem_code', e.target.value)} className={`mt-1 ${fieldClass} h-11 md:h-10`} placeholder="90915-YZZD4" />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-fg-muted flex items-center justify-between">
                Бренд
                <button type="button" onClick={() => setAddingBrand((v) => !v)} className="flex items-center gap-0.5 text-fg-muted hover:text-fg">
                  <Plus size={12} /> новый
                </button>
              </label>
              {addingBrand ? (
                <div className="flex gap-1 mt-1">
                  <input value={newBrandName} onChange={(e) => setNewBrandName(e.target.value)} placeholder="Название бренда" className={`flex-1 ${fieldClass} h-11 md:h-10`} />
                  <button type="button" onClick={createBrand} className="inline-flex h-11 md:h-10 shrink-0 items-center justify-center rounded-xl bg-gray-900 px-4 text-sm font-semibold text-white transition-transform hover:bg-gray-800 active:scale-[0.98] dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white">OK</button>
                </div>
              ) : (
                <select value={form.brand} onChange={(e) => set('brand', e.target.value)} className={`mt-1 ${fieldClass} select-field h-11 md:h-10`}>
                  <option value="">— не указан —</option>
                  {brands?.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              )}
            </div>
            <div>
              <label className="text-xs font-medium text-fg-muted flex items-center justify-between">
                Категория
                <button type="button" onClick={() => setAddingCategory((v) => !v)} className="flex items-center gap-0.5 text-fg-muted hover:text-fg">
                  <Plus size={12} /> новая
                </button>
              </label>
              {addingCategory ? (
                <div className="flex gap-1 mt-1">
                  <input value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} placeholder="Название категории" className={`flex-1 ${fieldClass} h-11 md:h-10`} />
                  <button type="button" onClick={createCategory} className="inline-flex h-11 md:h-10 shrink-0 items-center justify-center rounded-xl bg-gray-900 px-4 text-sm font-semibold text-white transition-transform hover:bg-gray-800 active:scale-[0.98] dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white">OK</button>
                </div>
              ) : (
                <select value={form.category} onChange={(e) => set('category', e.target.value)} className={`mt-1 ${fieldClass} select-field h-11 md:h-10`}>
                  <option value="">— не указана —</option>
                  {categories?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              )}
            </div>
          </div>

          <div className="sm:w-1/2 sm:pr-1.5">
            <label className="text-xs font-medium text-fg-muted">Единица измерения</label>
            <select value={form.unit} onChange={(e) => set('unit', e.target.value)} className={`mt-1 ${fieldClass} select-field h-11 md:h-10`}>
              {UNIT_OPTIONS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
            </select>
          </div>
        </section>

        <section className="space-y-3">
          <h4 className="text-xs font-semibold tracking-wide text-fg-muted uppercase">Цены</h4>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <MoneyField
              label="Цена продажи"
              value={form.sale_price === '' ? '' : Number(form.sale_price)}
              onChange={(v) => set('sale_price', v === '' ? '' : String(v))}
              placeholder="0"
              tone={form.sale_price === '' || Number(form.sale_price) <= 0 ? 'warning' : undefined}
              hint={
                form.sale_price === '' || Number(form.sale_price) <= 0
                  ? 'По этой цене товар пробивается на кассе'
                  : undefined
              }
            />
            <MoneyField
              label="Минимальная цена продажи"
              value={form.min_price === '' ? '' : Number(form.min_price)}
              onChange={(v) => set('min_price', v === '' ? '' : String(v))}
              placeholder="= себестоимость"
              hint="Ниже неё скидку на кассе придётся согласовывать"
            />
          </div>
          {!isEdit && (
            <div className="sm:w-1/2 sm:pr-1.5">
              <MoneyField
                label="Закупочная цена"
                value={form.purchase_price === '' ? '' : Number(form.purchase_price)}
                onChange={(v) => set('purchase_price', v === '' ? '' : String(v))}
                placeholder="0"
                hint="Ориентировочно — точная себестоимость посчитается при приходе"
              />
            </div>
          )}
        </section>

        <section className="space-y-3">
          <h4 className="text-xs font-semibold tracking-wide text-fg-muted uppercase">Склад и поиск</h4>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-fg-muted">Порог дефицита</label>
              <NumericInput
                value={form.min_stock === '' ? '' : Number(form.min_stock)}
                onChange={(v) => set('min_stock', v === '' ? '' : String(v))}
                label="Порог дефицита"
                suffix="шт"
                min={0}
                className={`mt-1 ${fieldClass} h-11 md:h-10 tabular-nums`}
              />
              <div className="mt-1 text-xs text-fg-muted">Меньше этого остатка — товар подсветится как дефицит</div>
            </div>
            <div>
              <label className="text-xs font-medium text-fg-muted">Место на складе</label>
              <input value={form.location} onChange={(e) => set('location', e.target.value)} placeholder="Стеллаж B, полка 3" className={`mt-1 ${fieldClass} h-11 md:h-10`} />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-fg-muted">Применимость к авто</label>
            <input value={form.applicability} onChange={(e) => set('applicability', e.target.value)} placeholder="Toyota Camry 40/50, Lexus ES 2006–2012" className={`mt-1 ${fieldClass} h-11 md:h-10`} />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-fg-muted">Штрихкод</label>
              <input value={form.barcode} onChange={(e) => set('barcode', e.target.value)} className={`mt-1 ${fieldClass} h-11 md:h-10`} />
            </div>
            <div>
              <label className="text-xs font-medium text-fg-muted">Комментарий</label>
              <input value={form.note} onChange={(e) => set('note', e.target.value)} className={`mt-1 ${fieldClass} h-11 md:h-10`} />
            </div>
          </div>

          {isEdit && (
            <label className="flex items-center gap-2 text-sm text-fg-muted">
              <input type="checkbox" checked={form.is_active} onChange={(e) => set('is_active', e.target.checked)} className="h-4 w-4 accent-gray-900 dark:accent-gray-100" />
              Активен — показывать в поиске и на кассе
            </label>
          )}
        </section>
      </div>
    </Modal>
  )
}

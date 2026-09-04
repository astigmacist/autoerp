export type Role = 'owner' | 'stock' | 'seller'

export interface User {
  id: number
  username: string
  full_name: string
  role: Role
  phone: string
  is_active_employee: boolean
}

export interface Permissions {
  role: Role
  can_see_cost: boolean
  can_manage_catalog: boolean
  can_manage_users: boolean
  discount_limit_percent: number | null
}

export interface Warehouse {
  id: string
  name: string
  code: string
  kind: 'main' | 'shop'
  is_sellable: boolean
  is_active: boolean
}

export interface ProductStock {
  warehouse_id: string
  warehouse_code: string
  quantity: string
}

export interface Product {
  id: string
  name: string
  sku: string
  oem_code: string
  barcode: string | null
  brand: number | null
  brand_name: string | null
  category: number | null
  category_name: string | null
  unit: string
  purchase_price?: string
  avg_cost?: string
  sale_price: string
  min_price: string | null
  min_stock: number
  applicability: string
  location: string
  note: string
  is_active: boolean
  stocks: ProductStock[]
  created_at: string
}

export interface ProductSearchResult {
  id: string
  name: string
  sku: string
  oem_code: string
  barcode: string | null
  unit: string
  sale_price: string
  min_stock: number
  shop_qty: number
  main_qty: number
}

export type StockStatus = 'out' | 'low' | 'warning' | 'ok'

export interface StockRow {
  id: number
  product: string
  product_name: string
  sku: string
  warehouse: string
  warehouse_name: string
  quantity: string
  min_stock: number
  status: StockStatus
  updated_at: string
}

export type PaymentMethod = 'cash' | 'kaspi_qr' | 'card' | 'transfer'

export interface Payment {
  id: number
  method: PaymentMethod
  amount: string
}

export interface SaleItem {
  id: number
  product: string
  product_name: string
  sku: string
  quantity: string
  base_price: string
  final_price: string
  amount: string
  discount_amount: string
  discount_percent: string
  returned_qty: string
}

export interface Sale {
  id: string
  number: string
  created_at: string
  warehouse: string
  warehouse_name: string
  seller: number
  seller_name: string
  customer_name: string
  customer_phone: string
  subtotal: string
  discount_total: string
  total: string
  cost_total?: string
  profit?: string
  status: string
  comment: string
  needs_approval: boolean
  items: SaleItem[]
  payments: Payment[]
}

export interface Paginated<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export interface DashboardData {
  revenue: number
  revenue_change_pct: number | null
  sales_count: number
  sales_count_change_pct: number | null
  avg_check: number
  discount_total: number
  deficit_count: number
  profit?: number
  profit_change_pct?: number | null
  period_revenue_by_day: { day: string; revenue: number; count: number }[]
  payments_breakdown: { method: PaymentMethod; amount: number }[]
  top_products: { product__name: string; product__sku: string; qty: number; revenue: number }[]
  recent_sales: {
    id: string
    number: string
    created_at: string
    total: number
    seller__first_name: string
    seller__last_name: string
  }[]
}

export type DocStatus = 'draft' | 'posted' | 'cancelled'

export interface ReceiptItem {
  id?: number
  product: string
  product_name?: string
  quantity: string | number
  purchase_price: string | number
  sale_price?: string | number | null
  amount?: number
}

export interface Receipt {
  id: string
  number: string
  date: string
  warehouse: string
  warehouse_name?: string
  supplier: number | null
  supplier_name?: string | null
  status: DocStatus
  comment: string
  items: ReceiptItem[]
  total_amount?: number
  created_by_name?: string | null
  created_at: string
  posted_at: string | null
}

export interface TransferItem {
  id?: number
  product: string
  product_name?: string
  quantity: string | number
}

export interface Transfer {
  id: string
  number: string
  date: string
  from_warehouse: string
  from_warehouse_name?: string
  to_warehouse: string
  to_warehouse_name?: string
  status: DocStatus
  comment: string
  items: TransferItem[]
  created_at: string
  posted_at: string | null
}

export interface TransferSuggestion {
  product_id: string
  product_name: string
  sku: string
  shop_qty: number
  main_qty: number
  suggested_qty: number
}

export interface InventoryItem {
  id?: number
  product: string
  product_name?: string
  qty_system: string | number
  qty_fact: string | number
  diff?: number
}

export interface InventoryDoc {
  id: string
  number: string
  date: string
  warehouse: string
  warehouse_name?: string
  status: 'draft' | 'posted'
  items: InventoryItem[]
  created_at: string
  posted_at: string | null
}

export interface WriteOffItem {
  id?: number
  product: string
  product_name?: string
  quantity: string | number
}

export interface WriteOff {
  id: string
  number: string
  date: string
  warehouse: string
  warehouse_name?: string
  reason_text: string
  status: 'draft' | 'posted'
  items: WriteOffItem[]
  created_at: string
  posted_at: string | null
}

export interface Supplier {
  id: number
  name: string
  phone: string
  note: string
  is_active: boolean
}

export interface Category {
  id: number
  name: string
  parent: number | null
  is_active: boolean
}

export interface Brand {
  id: number
  name: string
  country: string
  is_active: boolean
}

export interface Shift {
  id: number
  opened_at: string
  closed_at: string | null
  opened_by: number
  opened_by_name?: string | null
  closed_by: number | null
  warehouse: string
  cash_start: string | number
  cash_end_fact: string | number | null
  cash_end_system: string | number | null
  status: 'open' | 'closed'
  cash_diff?: string | number | null
}

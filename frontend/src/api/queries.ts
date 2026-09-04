import { useQuery } from '@tanstack/react-query'
import { api } from './client'
import type {
  Brand, Category, DashboardData, InventoryDoc, Paginated, Product, ProductSearchResult,
  Receipt, Shift, StockRow, Supplier, Transfer, TransferSuggestion, Warehouse, WriteOff,
} from './types'

export function useWarehouses() {
  return useQuery({
    queryKey: ['warehouses'],
    queryFn: async () => (await api.get<Paginated<Warehouse>>('/warehouses/?page_size=50')).data.results,
    staleTime: 5 * 60 * 1000,
  })
}

export function useProducts(params: { search?: string; page?: number } = {}) {
  return useQuery({
    queryKey: ['products', params],
    queryFn: async () =>
      (await api.get<Paginated<Product>>('/products/', { params: { page_size: 50, ...params } })).data,
  })
}

export function useProductSearch(q: string) {
  return useQuery({
    queryKey: ['product-search', q],
    queryFn: async () => (await api.get<ProductSearchResult[]>('/products/search/', { params: { q } })).data,
    enabled: q.trim().length >= 2,
    staleTime: 10_000,
  })
}

export function useStock(params: { warehouse?: string; low_stock?: string } = {}) {
  return useQuery({
    queryKey: ['stock', params],
    queryFn: async () => (await api.get<Paginated<StockRow>>('/stock/', { params: { page_size: 500, ...params } })).data,
  })
}

export function useDashboard(period: 'today' | '7d' | '30d') {
  return useQuery({
    queryKey: ['dashboard', period],
    queryFn: async () => (await api.get<DashboardData>('/reports/dashboard/', { params: { period } })).data,
    refetchInterval: 60_000,
  })
}

export function useSuppliers() {
  return useQuery({
    queryKey: ['suppliers'],
    queryFn: async () => (await api.get<Paginated<Supplier>>('/suppliers/?page_size=200')).data.results,
    staleTime: 5 * 60 * 1000,
  })
}

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: async () => (await api.get<Paginated<Category>>('/categories/?page_size=200')).data.results,
    staleTime: 5 * 60 * 1000,
  })
}

export function useBrands() {
  return useQuery({
    queryKey: ['brands'],
    queryFn: async () => (await api.get<Paginated<Brand>>('/brands/?page_size=200')).data.results,
    staleTime: 5 * 60 * 1000,
  })
}

export function useCurrentShift() {
  return useQuery({
    queryKey: ['current-shift'],
    queryFn: async () => (await api.get<Shift | null>('/shifts/current/')).data,
    refetchInterval: 60_000,
  })
}

export function useReceipts() {
  return useQuery({
    queryKey: ['receipts'],
    queryFn: async () => (await api.get<Paginated<Receipt>>('/receipts/?page_size=100&ordering=-created_at')).data.results,
  })
}

export function useTransfers() {
  return useQuery({
    queryKey: ['transfers'],
    queryFn: async () => (await api.get<Paginated<Transfer>>('/transfers/?page_size=100&ordering=-created_at')).data.results,
  })
}

export function useTransferSuggest() {
  return useQuery({
    queryKey: ['transfer-suggest'],
    queryFn: async () => (await api.get<TransferSuggestion[]>('/transfers/suggest/')).data,
    enabled: false,
  })
}

export function useInventories() {
  return useQuery({
    queryKey: ['inventories'],
    queryFn: async () => (await api.get<Paginated<InventoryDoc>>('/inventories/?page_size=100&ordering=-created_at')).data.results,
  })
}

export function useWriteOffs() {
  return useQuery({
    queryKey: ['writeoffs'],
    queryFn: async () => (await api.get<Paginated<WriteOff>>('/writeoffs/?page_size=100&ordering=-created_at')).data.results,
  })
}

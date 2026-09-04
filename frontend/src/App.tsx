import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from '@/components/Layout'
import RequireAuth from '@/components/RequireAuth'
import Login from '@/pages/Login'
import Dashboard from '@/pages/Dashboard'
import SalePage from '@/pages/Sale'
import Products from '@/pages/Products'
import Stock from '@/pages/Stock'
import Receipts from '@/pages/Receipts'
import Transfers from '@/pages/Transfers'
import InventoryDocs from '@/pages/InventoryDocs'
import WriteOffs from '@/pages/WriteOffs'
import SalesJournal from '@/pages/SalesJournal'
import SaleDetail from '@/pages/SaleDetail'
import Reports from '@/pages/Reports'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<RequireAuth />}>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/sale" element={<SalePage />} />
          <Route path="/products" element={<Products />} />
          <Route path="/stock" element={<Stock />} />
          <Route path="/stock/receipts" element={<Receipts />} />
          <Route path="/stock/transfers" element={<Transfers />} />
          <Route path="/stock/inventories" element={<InventoryDocs />} />
          <Route path="/stock/writeoffs" element={<WriteOffs />} />
          <Route path="/sales" element={<SalesJournal />} />
          <Route path="/sales/:id" element={<SaleDetail />} />
          <Route path="/reports" element={<Reports />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

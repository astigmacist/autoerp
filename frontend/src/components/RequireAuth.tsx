import { useEffect } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/store/auth'
import { tokenStore } from '@/api/client'

export default function RequireAuth() {
  const { isAuthenticated, user, loadMe } = useAuth()

  useEffect(() => {
    if (isAuthenticated && !user) {
      loadMe()
    }
  }, [isAuthenticated, user, loadMe])

  if (!tokenStore.getAccess()) {
    return <Navigate to="/login" replace />
  }
  return <Outlet />
}

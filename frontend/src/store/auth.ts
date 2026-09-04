import { create } from 'zustand'
import { api, tokenStore } from '@/api/client'
import type { Permissions, User } from '@/api/types'

interface AuthState {
  user: User | null
  permissions: Permissions | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => void
  loadMe: () => Promise<void>
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  permissions: null,
  isAuthenticated: !!tokenStore.getAccess(),
  isLoading: false,

  login: async (username, password) => {
    set({ isLoading: true })
    try {
      const { data } = await api.post('/auth/login/', { username, password })
      tokenStore.set(data.access, data.refresh)
      set({ user: data.user, isAuthenticated: true })
      const perms = await api.get('/auth/permissions/')
      set({ permissions: perms.data })
    } finally {
      set({ isLoading: false })
    }
  },

  logout: () => {
    tokenStore.clear()
    set({ user: null, permissions: null, isAuthenticated: false })
  },

  loadMe: async () => {
    try {
      const [me, perms] = await Promise.all([api.get('/auth/me/'), api.get('/auth/permissions/')])
      set({ user: me.data, permissions: perms.data, isAuthenticated: true })
    } catch {
      tokenStore.clear()
      set({ user: null, permissions: null, isAuthenticated: false })
    }
  },
}))

import axios from 'axios'

const ACCESS_KEY = 'autozap_access'
const REFRESH_KEY = 'autozap_refresh'

export const tokenStore = {
  getAccess: () => localStorage.getItem(ACCESS_KEY),
  getRefresh: () => localStorage.getItem(REFRESH_KEY),
  set: (access: string, refresh: string) => {
    localStorage.setItem(ACCESS_KEY, access)
    localStorage.setItem(REFRESH_KEY, refresh)
  },
  setAccess: (access: string) => localStorage.setItem(ACCESS_KEY, access),
  clear: () => {
    localStorage.removeItem(ACCESS_KEY)
    localStorage.removeItem(REFRESH_KEY)
  },
}

// Фронтенд и бэкенд живут в двух разных проектах Vercel, поэтому в продакшене
// API находится на другом домене. Адрес бэкенда задаётся переменной
// VITE_API_URL в настройках фронтенд-проекта (например,
// https://autoerp-api.vercel.app). Если переменная не задана, запросы идут на
// тот же домен — именно это нужно и локально (dev-сервер Vite проксирует /api
// на 127.0.0.1:8000), и если API проброшен через rewrite в vercel.json.
//
// Важно: Vite подставляет значение переменной на этапе сборки, а не в рантайме,
// поэтому после добавления VITE_API_URL проект нужно передеплоить.
const API_ROOT = (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '')

export const API_BASE = `${API_ROOT}/api/v1`

export const api = axios.create({
  baseURL: API_BASE,
})

api.interceptors.request.use((config) => {
  const token = tokenStore.getAccess()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

let refreshing: Promise<string | null> | null = null

async function doRefresh(): Promise<string | null> {
  const refresh = tokenStore.getRefresh()
  if (!refresh) return null
  try {
    const { data } = await axios.post(`${API_BASE}/auth/refresh/`, { refresh })
    tokenStore.setAccess(data.access)
    return data.access
  } catch {
    tokenStore.clear()
    return null
  }
}

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true
      if (!refreshing) {
        refreshing = doRefresh().finally(() => {
          refreshing = null
        })
      }
      const newToken = await refreshing
      if (newToken) {
        original.headers.Authorization = `Bearer ${newToken}`
        return api(original)
      }
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export interface ApiError {
  code: string
  detail: string
  errors: Array<Record<string, unknown>>
}

export function getApiError(err: unknown): ApiError {
  const anyErr = err as any
  if (anyErr?.response?.data?.detail) {
    return anyErr.response.data as ApiError
  }
  return { code: 'network_error', detail: 'Ошибка сети. Проверьте подключение.', errors: [] }
}

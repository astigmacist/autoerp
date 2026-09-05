import { create } from 'zustand'

export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'autozap_theme'

/** Тема, выбранная пользователем ранее. null — выбора ещё не было. */
function storedTheme(): Theme | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return value === 'light' || value === 'dark' ? value : null
  } catch {
    return null // приватный режим / заблокированное хранилище — не повод падать
  }
}

function systemTheme(): Theme {
  try {
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

/** Первая тема при запуске: выбор пользователя, иначе — как в системе. */
export function initialTheme(): Theme {
  return storedTheme() ?? systemTheme()
}

export function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark')
}

interface ThemeState {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggle: () => void
}

export const useTheme = create<ThemeState>((set, get) => ({
  theme: initialTheme(),
  setTheme: (theme) => {
    try {
      localStorage.setItem(STORAGE_KEY, theme)
    } catch {
      // не критично: тема просто не переживёт перезагрузку
    }
    applyTheme(theme)
    set({ theme })
  },
  toggle: () => get().setTheme(get().theme === 'dark' ? 'light' : 'dark'),
}))

/**
 * Принудительно светлая тема на время, пока смонтирован компонент (экран входа).
 * При размонтировании возвращает выбранную пользователем.
 */
export function useForceLightTheme() {
  applyTheme('light')
}

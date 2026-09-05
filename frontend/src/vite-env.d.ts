/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Адрес бэкенда, когда API живёт на другом домене (два отдельных проекта на
   * Vercel). Пример: https://autoerp-api.vercel.app
   * Не задана — запросы идут на тот же домен, что и сам фронтенд.
   */
  readonly VITE_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

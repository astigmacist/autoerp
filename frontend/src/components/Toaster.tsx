import type { ReactNode } from 'react'
import { useToast } from '@/store/toast'
import { CheckCircle2, XCircle, Info, X } from 'lucide-react'

const styles: Record<string, string> = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/80 dark:text-emerald-100',
  error: 'border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/80 dark:text-red-100',
  info: 'border-line bg-surface-2 text-fg',
}

const icons: Record<string, ReactNode> = {
  success: <CheckCircle2 size={18} className="shrink-0 text-emerald-600 dark:text-emerald-400" />,
  error: <XCircle size={18} className="shrink-0 text-red-600 dark:text-red-400" />,
  info: <Info size={18} className="shrink-0 text-brand-500" />,
}

export default function Toaster() {
  const { toasts, remove } = useToast()
  return (
    // На телефоне уведомления показываются сверху во всю ширину, на компьютере —
    // в правом верхнем углу. Раньше на узком экране они наезжали на содержимое.
    <div className="pointer-events-none fixed inset-x-3 top-3 z-[100] flex flex-col gap-2 sm:inset-x-auto sm:right-4 sm:top-4 sm:w-full sm:max-w-sm">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm shadow-pop animate-[toastIn_.18s_ease-out] ${styles[t.variant]}`}
        >
          {icons[t.variant]}
          <div className="flex-1 leading-snug">{t.message}</div>
          <button
            onClick={() => remove(t.id)}
            aria-label="Закрыть"
            className="-mr-1 shrink-0 rounded-lg p-0.5 opacity-50 hover:opacity-100"
          >
            <X size={15} />
          </button>
        </div>
      ))}
    </div>
  )
}

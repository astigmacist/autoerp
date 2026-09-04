import type { ReactNode } from 'react'
import { useToast } from '@/store/toast'
import { CheckCircle2, XCircle, Info, X } from 'lucide-react'

const styles: Record<string, string> = {
  success: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  error: 'bg-red-50 border-red-200 text-red-800',
  info: 'bg-gray-50 border-gray-200 text-gray-800',
}

const icons: Record<string, ReactNode> = {
  success: <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />,
  error: <XCircle size={18} className="text-red-600 shrink-0" />,
  info: <Info size={18} className="text-gray-500 shrink-0" />,
}

export default function Toaster() {
  const { toasts, remove } = useToast()
  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 w-full max-w-sm">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`flex items-start gap-2 rounded-xl border px-4 py-3 shadow-sm text-sm ${styles[t.variant]}`}
        >
          {icons[t.variant]}
          <div className="flex-1">{t.message}</div>
          <button onClick={() => remove(t.id)} className="opacity-50 hover:opacity-100">
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  )
}

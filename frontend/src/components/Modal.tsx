import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'

export default function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  width = 'max-w-md',
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
  width?: string
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    if (open) window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // Пока окно открыто, страница под ним не должна прокручиваться: иначе на
  // телефоне «уезжает» фон, и непонятно, что именно листается.
  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div
        className="absolute inset-0 bg-gray-950/50 backdrop-blur-[2px] animate-[fadeIn_.15s_ease-out]"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={`relative w-full ${width} max-h-[92vh] overflow-hidden rounded-t-2xl border border-line bg-surface-2 shadow-pop animate-[popIn_.16s_ease-out] sm:rounded-2xl`}
      >
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          <h3 className="font-semibold text-fg">{title}</h3>
          <button
            onClick={onClose}
            aria-label="Закрыть"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-fg-muted hover:bg-surface-muted hover:text-fg"
          >
            <X size={18} />
          </button>
        </div>
        <div className="max-h-[68vh] overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 border-t border-line bg-surface-muted px-5 py-3.5 pb-[calc(0.875rem+env(safe-area-inset-bottom))] sm:pb-3.5">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

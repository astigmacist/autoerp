import type { ReactNode } from 'react'
import Modal from '@/components/Modal'

export interface DocLine {
  key: string
  title: string
  subtitle?: string
  right: string
  rightSub?: string
}

/**
 * Состав складского документа.
 *
 * Пока документ был черновиком, его содержимое можно было увидеть в окне
 * «Провести?». После проведения оно исчезало: в списке оставались номер, дата
 * и сумма, а на вопрос «что было в приходе PR-2026-00003» ответить было
 * нечем — хотя данные лежали ровно там же. Теперь строка списка открывается.
 */
export default function DocumentViewModal({
  open, onClose, title, meta, lines, totals, footer,
}: {
  open: boolean
  onClose: () => void
  title: string
  meta: { label: string; value: ReactNode }[]
  lines: DocLine[]
  totals?: { label: string; value: string; strong?: boolean }[]
  footer?: ReactNode
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      width="max-w-2xl"
      footer={
        <>
          <button
            onClick={onClose}
            className="inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-semibold text-fg-muted transition-transform hover:bg-surface-muted hover:text-fg active:scale-[0.98]"
          >
            Закрыть
          </button>
          {footer}
        </>
      }
    >
      <div className="space-y-4">
        <section>
          <h4 className="mb-2 text-xs font-semibold tracking-wide text-fg-muted uppercase">Документ</h4>
          <dl className="grid grid-cols-1 gap-x-4 gap-y-1.5 sm:grid-cols-2">
            {meta.map((m) => (
              <div key={m.label} className="flex items-baseline justify-between gap-3 text-sm">
                <dt className="text-fg-muted">{m.label}</dt>
                <dd className="min-w-0 text-right text-fg">{m.value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section>
          <h4 className="mb-2 text-xs font-semibold tracking-wide text-fg-muted uppercase">
            Товары {lines.length > 0 && <span className="text-fg-muted/70">· {lines.length}</span>}
          </h4>
          {lines.length === 0 ? (
            <div className="rounded-xl border border-dashed border-line-strong px-4 py-6 text-center text-sm text-fg-muted">
              В документе нет позиций
            </div>
          ) : (
            <div className="divide-y divide-line overflow-hidden rounded-xl border border-line">
              {lines.map((l) => (
                <div key={l.key} className="flex items-start justify-between gap-3 bg-surface px-3 py-2.5">
                  <div className="min-w-0">
                    <div className="text-sm leading-snug text-fg">{l.title}</div>
                    {l.subtitle && <div className="text-xs text-fg-muted">{l.subtitle}</div>}
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-sm font-semibold tabular-nums text-fg">{l.right}</div>
                    {l.rightSub && <div className="text-xs text-fg-muted tabular-nums">{l.rightSub}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {totals && totals.length > 0 && (
            <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 rounded-xl bg-surface-muted px-3 py-2.5">
              {totals.map((t) => (
                <span key={t.label} className={t.strong ? 'text-sm font-semibold text-fg' : 'text-sm text-fg-muted'}>
                  {t.label} <span className="tabular-nums">{t.value}</span>
                </span>
              ))}
            </div>
          )}
        </section>
      </div>
    </Modal>
  )
}

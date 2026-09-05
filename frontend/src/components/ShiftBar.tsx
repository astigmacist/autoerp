import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Loader2, Lock, Unlock, Wallet } from 'lucide-react'
import { api, getApiError } from '@/api/client'
import { useCurrentShift, useWarehouses } from '@/api/queries'
import { useToast } from '@/store/toast'
import { formatMoney, formatDateTime } from '@/lib/format'
import Modal from '@/components/Modal'
import type { Shift } from '@/api/types'

export default function ShiftBar() {
  const { data: shift, isLoading } = useCurrentShift()
  const { data: warehouses } = useWarehouses()
  const shop = warehouses?.find((w) => w.is_sellable)
  const { push } = useToast()
  const qc = useQueryClient()

  const [openModal, setOpenModal] = useState(false)
  const [closeModal, setCloseModal] = useState(false)
  const [cashStart, setCashStart] = useState('0')
  const [cashFact, setCashFact] = useState('')
  const [saving, setSaving] = useState(false)
  const [closedResult, setClosedResult] = useState<Shift | null>(null)

  async function openShift() {
    if (!shop) return
    setSaving(true)
    try {
      await api.post('/shifts/', { warehouse: shop.id, cash_start: cashStart || 0 })
      qc.invalidateQueries({ queryKey: ['current-shift'] })
      push('Смена открыта', 'success')
      setOpenModal(false)
      setCashStart('0')
    } catch (err) {
      push(getApiError(err).detail, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function closeShift() {
    if (!shift) return
    setSaving(true)
    try {
      const { data } = await api.post<Shift>(`/shifts/${shift.id}/close/`, { cash_end_fact: cashFact || 0 })
      qc.invalidateQueries({ queryKey: ['current-shift'] })
      setCloseModal(false)
      setClosedResult(data)
      setCashFact('')
    } catch (err) {
      push(getApiError(err).detail, 'error')
    } finally {
      setSaving(false)
    }
  }

  if (isLoading) return null

  return (
    <>
      <div
        className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-2.5 text-sm ${
          shift
            ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30'
            : 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30'
        }`}
      >
        <div className="flex items-center gap-2">
          {shift ? (
            <Unlock size={16} className="text-emerald-600 shrink-0" />
          ) : (
            <Lock size={16} className="text-amber-600 shrink-0" />
          )}
          {/* На телефоне подробности переносились на четыре строки и раздували
              полосу — там оставляем только суть, детали видны на большом экране. */}
          {shift ? (
            <span className="min-w-0 text-emerald-800 dark:text-emerald-300">
              <span className="font-medium">Смена открыта</span>
              <span className="hidden sm:inline"> с {formatDateTime(shift.opened_at)}</span>
              <span className="sm:hidden"> · {formatDateTime(shift.opened_at).split(' ')[1]}</span>
              {shift.opened_by_name && <span className="hidden sm:inline"> · {shift.opened_by_name}</span>}
              <span className="hidden text-emerald-600/70 sm:inline dark:text-emerald-400/70">
                {' '}· нач. касса {formatMoney(shift.cash_start)}
              </span>
            </span>
          ) : (
            <span className="text-amber-800 dark:text-amber-300">Смена не открыта</span>
          )}
        </div>
        {shift ? (
          <button
            onClick={() => setCloseModal(true)}
            className="shrink-0 text-xs font-semibold rounded-lg px-3 py-1.5 bg-surface border border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50"
          >
            Закрыть смену
          </button>
        ) : (
          <button
            onClick={() => setOpenModal(true)}
            disabled={!shop}
            className="shrink-0 text-xs font-semibold rounded-lg px-3 py-1.5 bg-surface border border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50 disabled:opacity-40"
          >
            Открыть смену
          </button>
        )}
      </div>

      <Modal
        open={openModal}
        onClose={() => !saving && setOpenModal(false)}
        title="Открыть смену"
        footer={
          <>
            <button onClick={() => setOpenModal(false)} disabled={saving} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold text-fg-muted transition-transform hover:bg-surface-muted hover:text-fg active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40">
              Отмена
            </button>
            <button onClick={openShift} disabled={saving} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 text-sm font-semibold text-white transition-transform hover:bg-gray-800 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white">
              {saving && <Loader2 className="animate-spin" size={14} />} Открыть
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-gray-500">Склад: {shop?.name ?? '—'}</p>
          <div>
            <label className="text-xs font-medium text-fg-muted">Наличные в кассе на начало смены</label>
            <input
              type="number"
              value={cashStart}
              onChange={(e) => setCashStart(e.target.value)}
              autoFocus
              className="w-full mt-1 rounded-xl border border-line-strong bg-transparent px-3 py-2 text-sm tabular-nums outline-none"
            />
          </div>
        </div>
      </Modal>

      <Modal
        open={closeModal}
        onClose={() => !saving && setCloseModal(false)}
        title="Закрыть смену"
        footer={
          <>
            <button onClick={() => setCloseModal(false)} disabled={saving} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold text-fg-muted transition-transform hover:bg-surface-muted hover:text-fg active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40">
              Отмена
            </button>
            <button onClick={closeShift} disabled={saving} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 text-sm font-semibold text-white transition-transform hover:bg-gray-800 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white">
              {saving && <Loader2 className="animate-spin" size={14} />} Закрыть смену
            </button>
          </>
        }
      >
        <div className="space-y-3 text-sm">
          <p className="text-gray-500">
            Посчитайте наличные в кассе и укажите фактическую сумму. Система сравнит её с ожидаемой суммой по продажам.
          </p>
          <div>
            <label className="text-xs font-medium text-fg-muted">Фактически наличных в кассе</label>
            <input
              type="number"
              value={cashFact}
              onChange={(e) => setCashFact(e.target.value)}
              autoFocus
              placeholder="0"
              className="w-full mt-1 rounded-xl border border-line-strong bg-transparent px-3 py-2 text-sm tabular-nums outline-none"
            />
          </div>
        </div>
      </Modal>

      <Modal
        open={!!closedResult}
        onClose={() => setClosedResult(null)}
        title="Смена закрыта"
        footer={
          <button onClick={() => setClosedResult(null)} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 text-sm font-semibold text-white transition-transform hover:bg-gray-800 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white">
            Готово
          </button>
        }
      >
        {closedResult && (
          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-gray-500">
              <span>Касса на начало</span>
              <span className="tabular-nums">{formatMoney(closedResult.cash_start)}</span>
            </div>
            <div className="flex justify-between text-gray-500">
              <span>Ожидалось по системе</span>
              <span className="tabular-nums">{formatMoney(closedResult.cash_end_system ?? 0)}</span>
            </div>
            <div className="flex justify-between font-medium text-fg">
              <span>Фактически</span>
              <span className="tabular-nums">{formatMoney(closedResult.cash_end_fact ?? 0)}</span>
            </div>
            {closedResult.cash_diff !== null && closedResult.cash_diff !== undefined && (
              <div
                className={`flex items-center justify-between rounded-xl px-3 py-2 font-semibold ${
                  Math.abs(parseFloat(String(closedResult.cash_diff))) < 0.01
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                    : 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300'
                }`}
              >
                <span className="flex items-center gap-1.5"><Wallet size={14} /> Расхождение</span>
                <span className="tabular-nums">{formatMoney(closedResult.cash_diff)}</span>
              </div>
            )}
          </div>
        )}
      </Modal>
    </>
  )
}

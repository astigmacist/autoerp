import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import clsx from 'clsx'
import { KeyRound, Loader2, Plus, UserCheck, UserX, Users } from 'lucide-react'
import { api, getApiError } from '@/api/client'
import { useAppSettings, useStaff } from '@/api/queries'
import { useAuth } from '@/store/auth'
import { useToast } from '@/store/toast'
import { formatDateTime } from '@/lib/format'
import Modal from '@/components/Modal'
import type { Role, Staff } from '@/api/types'
import { Card, EmptyState, NumericInput, SkeletonList, fieldClass } from '@/components/ui'

const ROLE_OPTIONS: { value: Role; label: string; hint: string }[] = [
  { value: 'owner', label: 'Владелец', hint: 'Всё без ограничений: настройки, сотрудники, себестоимость, скидки' },
  { value: 'stock', label: 'Менеджер склада', hint: 'Товары и складские документы, видит себестоимость. Касса закрыта' },
  { value: 'seller', label: 'Продавец', hint: 'Только касса и продажи. Себестоимость не видит, скидка — в пределах лимита' },
]

type Tab = 'shop' | 'staff' | 'password'

export default function Settings() {
  const { permissions } = useAuth()
  const isOwner = permissions?.role === 'owner'
  // Права приходят с сервера уже после первой отрисовки, поэтому стартовую
  // вкладку нельзя зафиксировать в useState: владелец попадал бы на «Мой
  // пароль». Держим выбор пользователя, а до него — вкладку по роли.
  const [chosen, setChosen] = useState<Tab | null>(null)
  const tab: Tab = chosen ?? (isOwner ? 'shop' : 'password')
  const setTab = setChosen

  const tabs: { key: Tab; label: string }[] = isOwner
    ? [
        { key: 'shop', label: 'Магазин' },
        { key: 'staff', label: 'Сотрудники' },
        { key: 'password', label: 'Мой пароль' },
      ]
    : [{ key: 'password', label: 'Мой пароль' }]

  return (
    <div className="max-w-3xl space-y-4">
      {/* На телефоне это же название уже показано в верхней полосе. */}
      <h1 className="hidden text-xl font-semibold text-fg md:block">Настройки</h1>

      {tabs.length > 1 && (
        <div className="-mx-1 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="inline-flex gap-1 rounded-xl border border-line bg-surface p-1">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={clsx(
                  'rounded-lg px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors',
                  tab === t.key
                    ? 'bg-gray-900 text-white shadow-card dark:bg-gray-100 dark:text-gray-900'
                    : 'text-fg-muted hover:bg-surface-muted hover:text-fg',
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {tab === 'shop' && <ShopTab />}
      {tab === 'staff' && <StaffTab />}
      {tab === 'password' && <OwnPasswordTab />}
    </div>
  )
}

/* ── Магазин ──────────────────────────────────────────────────────────────── */

function ShopTab() {
  const { data, isLoading } = useAppSettings()
  const { push } = useToast()
  const qc = useQueryClient()
  const [form, setForm] = useState({
    store_name: '',
    seller_discount_limit_percent: '',
    return_days_limit: '',
    default_min_stock: '',
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!data) return
    setForm({
      store_name: data.store_name,
      seller_discount_limit_percent: String(data.seller_discount_limit_percent),
      return_days_limit: String(data.return_days_limit),
      default_min_stock: String(data.default_min_stock),
    })
  }, [data])

  async function save() {
    setSaving(true)
    try {
      await api.patch('/auth/settings/', {
        store_name: form.store_name,
        seller_discount_limit_percent: form.seller_discount_limit_percent,
        return_days_limit: form.return_days_limit,
        default_min_stock: form.default_min_stock,
      })
      qc.invalidateQueries({ queryKey: ['app-settings'] })
      push('Настройки сохранены', 'success')
    } catch (err) {
      push(getApiError(err).detail, 'error')
    } finally {
      setSaving(false)
    }
  }

  if (isLoading) return <SkeletonList rows={3} />

  return (
    <Card className="space-y-4">
      <Field
        label="Название магазина"
        hint="Печатается в шапке чека, который покупатель уносит с собой"
        value={form.store_name}
        onChange={(v) => setForm((p) => ({ ...p, store_name: v }))}
      />
      <Field
        label="Лимит скидки для продавца, %"
        hint="Скидку выше этой продавец дать может, но продажа будет помечена как требующая подтверждения владельца"
        value={form.seller_discount_limit_percent}
        onChange={(v) => setForm((p) => ({ ...p, seller_discount_limit_percent: v }))}
        numeric
        suffix="%"
      />
      <Field
        label="Срок возврата, дней"
        hint="Сколько дней покупатель может вернуть товар"
        value={form.return_days_limit}
        onChange={(v) => setForm((p) => ({ ...p, return_days_limit: v }))}
        numeric
        suffix="дней"
      />
      <Field
        label="Порог дефицита по умолчанию"
        hint="Подставляется в новый товар: меньше этого остатка — подсветится как дефицит"
        value={form.default_min_stock}
        onChange={(v) => setForm((p) => ({ ...p, default_min_stock: v }))}
        numeric
        suffix="шт"
      />

      <button
        onClick={save}
        disabled={saving}
        className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gray-900 px-5 text-sm font-semibold text-white transition-transform hover:bg-gray-800 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
      >
        {saving && <Loader2 className="animate-spin" size={14} />} Сохранить
      </button>
    </Card>
  )
}

function Field({
  label, hint, value, onChange, numeric, type, suffix,
}: {
  label: string
  hint?: string
  value: string
  onChange: (v: string) => void
  numeric?: boolean
  type?: string
  suffix?: string
}) {
  return (
    <div>
      <label className="text-xs font-medium text-fg-muted">{label}</label>
      {numeric ? (
        <NumericInput
          value={value === '' ? '' : Number(value)}
          onChange={(v) => onChange(v === '' ? '' : String(v))}
          label={label}
          suffix={suffix}
          hint={hint}
          min={0}
          className={`mt-1 ${fieldClass} h-11 md:h-10 tabular-nums`}
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`mt-1 ${fieldClass} h-11 md:h-10`}
        />
      )}
      {hint && <div className="mt-1 text-xs text-fg-muted">{hint}</div>}
    </div>
  )
}

/* ── Сотрудники ───────────────────────────────────────────────────────────── */

const EMPTY_STAFF = { username: '', first_name: '', role: 'seller' as Role, phone: '', password: '' }

function StaffTab() {
  const { data: staff, isLoading } = useStaff()
  const { user } = useAuth()
  const { push } = useToast()
  const qc = useQueryClient()

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Staff | null>(null)
  const [form, setForm] = useState(EMPTY_STAFF)
  const [saving, setSaving] = useState(false)
  const [passwordFor, setPasswordFor] = useState<Staff | null>(null)
  const [newPassword, setNewPassword] = useState('')

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_STAFF)
    setFormOpen(true)
  }

  function openEdit(person: Staff) {
    setEditing(person)
    setForm({
      username: person.username,
      first_name: person.first_name,
      role: person.role,
      phone: person.phone,
      password: '',
    })
    setFormOpen(true)
  }

  async function save() {
    setSaving(true)
    try {
      if (editing) {
        await api.patch(`/auth/staff/${editing.id}/`, {
          username: form.username, first_name: form.first_name, role: form.role, phone: form.phone,
        })
        push('Сотрудник сохранён', 'success')
      } else {
        await api.post('/auth/staff/', form)
        push(`Сотрудник «${form.username}» заведён`, 'success')
      }
      qc.invalidateQueries({ queryKey: ['staff'] })
      setFormOpen(false)
    } catch (err) {
      push(getApiError(err).detail, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(person: Staff) {
    try {
      if (person.is_active_employee) {
        await api.delete(`/auth/staff/${person.id}/`)
        push(`«${person.full_name}» больше не работает`, 'success')
      } else {
        await api.patch(`/auth/staff/${person.id}/`, { is_active_employee: true })
        push(`«${person.full_name}» снова в деле`, 'success')
      }
      qc.invalidateQueries({ queryKey: ['staff'] })
    } catch (err) {
      push(getApiError(err).detail, 'error')
    }
  }

  async function savePassword() {
    if (!passwordFor) return
    setSaving(true)
    try {
      await api.post(`/auth/staff/${passwordFor.id}/set-password/`, { password: newPassword })
      push(`Пароль для «${passwordFor.full_name}» изменён`, 'success')
      setPasswordFor(null)
      setNewPassword('')
    } catch (err) {
      push(getApiError(err).detail, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-fg-muted">
          Демо-пароли лежат в открытом репозитории — смените их всем, кто останется работать.
        </p>
        <button
          onClick={openCreate}
          className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 text-sm font-semibold text-white transition-transform hover:bg-gray-800 active:scale-[0.98] md:h-10 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
        >
          <Plus size={15} /> Сотрудник
        </button>
      </div>

      {isLoading && <SkeletonList rows={3} />}
      {!isLoading && (staff ?? []).length === 0 && (
        <Card padded={false}>
          <EmptyState icon={<Users size={20} />} title="Сотрудников пока нет" />
        </Card>
      )}

      <div className="space-y-2">
        {(staff ?? []).map((person) => (
          <div
            key={person.id}
            className={clsx(
              'rounded-2xl border border-line bg-surface p-3',
              !person.is_active_employee && 'opacity-60',
            )}
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-medium text-fg">
                  {person.full_name}
                  {person.id === user?.id && <span className="ml-2 text-xs text-fg-muted">это вы</span>}
                </div>
                <div className="text-xs text-fg-muted">
                  {person.username} · {person.role_label}
                  {!person.is_active_employee && ' · не работает'}
                </div>
                <div className="mt-0.5 text-xs text-fg-muted">
                  {person.last_login ? `последний вход ${formatDateTime(person.last_login)}` : 'ни разу не входил'}
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap gap-1.5">
                <button
                  onClick={() => openEdit(person)}
                  className="inline-flex h-9 items-center justify-center rounded-xl border border-line-strong px-3 text-xs font-semibold text-fg-muted transition-transform hover:bg-surface-muted hover:text-fg active:scale-[0.98]"
                >
                  Изменить
                </button>
                <button
                  onClick={() => { setPasswordFor(person); setNewPassword('') }}
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-line-strong px-3 text-xs font-semibold text-fg-muted transition-transform hover:bg-surface-muted hover:text-fg active:scale-[0.98]"
                >
                  <KeyRound size={13} /> Пароль
                </button>
                {person.id !== user?.id && (
                  <button
                    onClick={() => toggleActive(person)}
                    className={clsx(
                      'inline-flex h-9 items-center justify-center gap-1.5 rounded-xl px-3 text-xs font-semibold transition-transform active:scale-[0.98]',
                      person.is_active_employee
                        ? 'text-fg-muted hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40'
                        : 'text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/40',
                    )}
                  >
                    {person.is_active_employee ? <><UserX size={13} /> Отключить</> : <><UserCheck size={13} /> Вернуть</>}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <Modal
        open={formOpen}
        onClose={() => !saving && setFormOpen(false)}
        title={editing ? 'Сотрудник' : 'Новый сотрудник'}
        footer={
          <>
            <button
              onClick={() => setFormOpen(false)}
              className="inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-semibold text-fg-muted transition-transform hover:bg-surface-muted hover:text-fg active:scale-[0.98]"
            >
              Отмена
            </button>
            <button
              onClick={save}
              disabled={saving || !form.username.trim() || (!editing && form.password.length < 8)}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 text-sm font-semibold text-white transition-transform hover:bg-gray-800 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
            >
              {saving && <Loader2 className="animate-spin" size={14} />} {editing ? 'Сохранить' : 'Завести'}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Имя" value={form.first_name} onChange={(v) => setForm((p) => ({ ...p, first_name: v }))} />
          <Field
            label="Логин"
            hint="Им сотрудник входит в программу"
            value={form.username}
            onChange={(v) => setForm((p) => ({ ...p, username: v }))}
          />
          <Field label="Телефон" value={form.phone} onChange={(v) => setForm((p) => ({ ...p, phone: v }))} />

          <div>
            <label className="text-xs font-medium text-fg-muted">Роль</label>
            <div className="mt-1.5 space-y-1.5">
              {ROLE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setForm((p) => ({ ...p, role: option.value }))}
                  className={clsx(
                    'block w-full rounded-xl border px-3 py-2.5 text-left transition-colors',
                    form.role === option.value
                      ? 'border-gray-900 bg-surface-muted dark:border-gray-100'
                      : 'border-line hover:bg-surface-muted',
                  )}
                >
                  <div className="text-sm font-medium text-fg">{option.label}</div>
                  <div className="text-xs text-fg-muted">{option.hint}</div>
                </button>
              ))}
            </div>
          </div>

          {!editing && (
            <Field
              label="Пароль"
              hint="Не короче 8 символов. Сотрудник сможет сменить его сам в разделе «Настройки»"
              type="password"
              value={form.password}
              onChange={(v) => setForm((p) => ({ ...p, password: v }))}
            />
          )}
        </div>
      </Modal>

      <Modal
        open={!!passwordFor}
        onClose={() => !saving && setPasswordFor(null)}
        title={`Новый пароль для «${passwordFor?.full_name ?? ''}»`}
        footer={
          <>
            <button
              onClick={() => setPasswordFor(null)}
              className="inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-semibold text-fg-muted transition-transform hover:bg-surface-muted hover:text-fg active:scale-[0.98]"
            >
              Отмена
            </button>
            <button
              onClick={savePassword}
              disabled={saving || newPassword.length < 8}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 text-sm font-semibold text-white transition-transform hover:bg-gray-800 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
            >
              {saving && <Loader2 className="animate-spin" size={14} />} Задать
            </button>
          </>
        }
      >
        <Field
          label="Пароль"
          hint="Не короче 8 символов. Передайте его сотруднику лично — по переписке пароли не отправляют"
          type="password"
          value={newPassword}
          onChange={setNewPassword}
        />
      </Modal>
    </div>
  )
}

/* ── Свой пароль ──────────────────────────────────────────────────────────── */

function OwnPasswordTab() {
  const { push } = useToast()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [repeat, setRepeat] = useState('')
  const [saving, setSaving] = useState(false)

  const mismatch = repeat.length > 0 && next !== repeat
  const canSave = current.length > 0 && next.length >= 8 && next === repeat

  async function save() {
    setSaving(true)
    try {
      await api.post('/auth/password/', { current_password: current, new_password: next })
      push('Пароль изменён', 'success')
      setCurrent('')
      setNext('')
      setRepeat('')
    } catch (err) {
      push(getApiError(err).detail, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="max-w-md space-y-4">
      <Field label="Текущий пароль" type="password" value={current} onChange={setCurrent} />
      <Field
        label="Новый пароль"
        hint="Не короче 8 символов"
        type="password"
        value={next}
        onChange={setNext}
      />
      <div>
        <Field label="Ещё раз" type="password" value={repeat} onChange={setRepeat} />
        {mismatch && <div className="mt-1 text-xs text-red-600 dark:text-red-400">Пароли не совпадают</div>}
      </div>
      <button
        onClick={save}
        disabled={saving || !canSave}
        className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gray-900 px-5 text-sm font-semibold text-white transition-transform hover:bg-gray-800 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
      >
        {saving && <Loader2 className="animate-spin" size={14} />} Сменить пароль
      </button>
    </Card>
  )
}

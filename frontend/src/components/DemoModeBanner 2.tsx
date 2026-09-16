import { useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { useHealth } from '@/api/queries'
import Modal from '@/components/Modal'

const DISMISS_KEY = 'autozap_demo_notice_hidden'

function hidden(): boolean {
  try {
    return sessionStorage.getItem(DISMISS_KEY) === '1'
  } catch {
    return false
  }
}

/**
 * Честная полоса про демо-режим.
 *
 * На Vercel без подключённой базы приложение работает на файле SQLite во
 * временном каталоге. Каталог принадлежит конкретному экземпляру функции:
 * соседний запрос может попасть на другой экземпляр, а через несколько минут
 * простоя экземпляры умирают вместе с данными. Со стороны это выглядит как
 * «приход сохранился и пропал» — то есть как сломанная программа, хотя
 * сломано хранилище. Пока база не подключена, интерфейс говорит об этом сам.
 */
export default function DemoModeBanner() {
  const { data } = useHealth()
  const [dismissed, setDismissed] = useState(hidden)
  const [howOpen, setHowOpen] = useState(false)

  if (data?.storage !== 'ephemeral' || dismissed) return null

  function dismiss() {
    setDismissed(true)
    try {
      sessionStorage.setItem(DISMISS_KEY, '1')
    } catch {
      // приватный режим — полоса просто вернётся при следующей загрузке
    }
  }

  return (
    <>
      <div className="flex items-start gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800 md:px-6 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
        <AlertTriangle size={14} className="mt-0.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <span className="font-semibold">Демо-режим.</span> Данные хранятся временно и пропадут при
          перезапуске — так работает хостинг, пока не подключена база.{' '}
          <button onClick={() => setHowOpen(true)} className="font-semibold underline underline-offset-2">
            Как включить сохранение
          </button>
        </div>
        <button
          onClick={dismiss}
          aria-label="Скрыть"
          className="-my-1 -mr-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/50"
        >
          <X size={14} />
        </button>
      </div>

      <Modal
        open={howOpen}
        onClose={() => setHowOpen(false)}
        title="Чтобы данные сохранялись"
        footer={
          <button
            onClick={() => setHowOpen(false)}
            className="inline-flex h-10 items-center justify-center rounded-xl bg-gray-900 px-4 text-sm font-semibold text-white transition-transform hover:bg-gray-800 active:scale-[0.98] dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
          >
            Понятно
          </button>
        }
      >
        <div className="space-y-3 text-sm text-fg-muted">
          <p className="text-fg">
            Нужна постоянная база. Она бесплатна и подключается из панели Vercel — код менять не
            нужно, приложение подхватит её само.
          </p>
          <ol className="list-decimal space-y-1.5 pl-5">
            <li>Откройте проект на vercel.com → вкладка <span className="font-medium text-fg">Storage</span>.</li>
            <li><span className="font-medium text-fg">Create Database</span> → <span className="font-medium text-fg">Postgres (Neon)</span> → <span className="font-medium text-fg">Create</span>.</li>
            <li>Нажмите <span className="font-medium text-fg">Connect to Project</span> и выберите этот проект.</li>
            <li>Вкладка <span className="font-medium text-fg">Deployments</span> → у верхнего деплоя <span className="font-medium text-fg">⋯</span> → <span className="font-medium text-fg">Redeploy</span>.</li>
          </ol>
          <p>
            После этого полоса исчезнет, а приходы, продажи и остатки будут храниться постоянно.
            Демо-данные создадутся один раз — дальше база ваша.
          </p>
        </div>
      </Modal>
    </>
  )
}

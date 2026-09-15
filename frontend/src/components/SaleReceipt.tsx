import { formatDateTime, formatMoney, formatQty } from '@/lib/format'
import type { PaymentMethod, Sale } from '@/api/types'

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cash: 'Наличные',
  kaspi_qr: 'Kaspi QR',
  card: 'Карта',
  transfer: 'Перевод',
}

/**
 * Товарный чек — то, что покупатель уносит с собой.
 *
 * На экране блок не виден: он появляется только при печати, когда всё
 * остальное (меню, кнопки, тёмная тема) скрывается правилами в index.css.
 * Так чек печатается прямо из карточки продажи, без отдельной страницы и без
 * всплывающего окна, которое браузеры любят блокировать.
 *
 * Ширина рассчитана на обычный лист A4; на чековом принтере 80 мм текст
 * тоже читается, потому что вёрстка — одна колонка без таблиц.
 */
export default function SaleReceipt({ sale, storeName }: { sale: Sale; storeName: string }) {
  const discount = parseFloat(sale.discount_total)

  return (
    <div className="print-only hidden text-black">
      <div className="mx-auto max-w-[80mm] px-2 py-4 font-mono text-[12px] leading-snug">
        <div className="text-center">
          <div className="text-[15px] font-bold tracking-wide">{storeName}</div>
          <div className="mt-0.5">Товарный чек {sale.number}</div>
          <div>{formatDateTime(sale.created_at)}</div>
          {sale.seller_name && <div>Продавец: {sale.seller_name}</div>}
        </div>

        <div className="my-2 border-t border-dashed border-black" />

        {sale.items.map((i) => (
          <div key={i.id} className="mb-1.5">
            <div>{i.product_name}</div>
            <div className="flex justify-between">
              <span>
                {formatQty(i.quantity)} × {formatMoney(i.final_price)}
              </span>
              <span>{formatMoney(i.amount)}</span>
            </div>
          </div>
        ))}

        <div className="my-2 border-t border-dashed border-black" />

        {discount > 0 && (
          <>
            <div className="flex justify-between">
              <span>Сумма по прайсу</span>
              <span>{formatMoney(sale.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span>Скидка</span>
              <span>−{formatMoney(sale.discount_total)}</span>
            </div>
          </>
        )}

        <div className="flex justify-between text-[14px] font-bold">
          <span>ИТОГО</span>
          <span>{formatMoney(sale.total)}</span>
        </div>

        {sale.payments.map((p, idx) => (
          <div key={idx} className="flex justify-between">
            <span>{PAYMENT_LABELS[p.method] ?? p.method}</span>
            <span>{formatMoney(p.amount)}</span>
          </div>
        ))}

        <div className="my-2 border-t border-dashed border-black" />

        <div className="text-center">
          <div>Спасибо за покупку!</div>
          <div className="mt-1 text-[10px] text-black">Чек не является фискальным документом</div>
        </div>
      </div>
    </div>
  )
}

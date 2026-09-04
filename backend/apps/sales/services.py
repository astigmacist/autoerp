from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from apps.core.exceptions import BusinessError
from apps.inventory.models import Stock, StockMovement
from apps.inventory.services import move_stock
from .models import Payment, Return, ReturnItem, Sale, SaleItem


@transaction.atomic
def create_sale(*, warehouse, seller, items_data, payments_data, idempotency_key=None,
                 customer_name="", customer_phone="", comment="", shift=None):
    """
    items_data: [{product, quantity, final_price}]
    payments_data: [{method, amount}]

    Fully atomic: locks stock rows, validates availability, validates pricing
    guardrails, writes StockMovement (reason=sale), and creates the Sale +
    SaleItem + Payment rows. Idempotent on idempotency_key.
    """
    if idempotency_key:
        existing = Sale.objects.filter(idempotency_key=idempotency_key).first()
        if existing:
            return existing, False

    if not items_data:
        raise BusinessError("В чеке нет товаров", code="empty_sale")

    subtotal = Decimal("0")
    discount_total = Decimal("0")
    cost_total = Decimal("0")
    needs_approval = False
    sale_items = []

    discount_limit_percent = seller.discount_limit_percent  # None for owner

    for row in items_data:
        product = row["product"]
        quantity = Decimal(str(row["quantity"]))
        final_price = Decimal(str(row["final_price"]))
        base_price = product.sale_price

        if quantity <= 0:
            raise BusinessError(f"Некорректное количество для {product.name}", code="invalid_quantity")
        if final_price < 0:
            raise BusinessError(f"Некорректная цена для {product.name}", code="invalid_price")

        # Guardrail: selling below cost is only allowed for owner-approved sales
        if final_price < product.avg_cost:
            needs_approval = True

        if base_price > 0:
            item_discount_pct = (base_price - final_price) / base_price * 100
        else:
            item_discount_pct = Decimal("0")

        if discount_limit_percent is not None and item_discount_pct > discount_limit_percent:
            needs_approval = True

        line_amount = final_price * quantity
        line_cost = product.avg_cost * quantity
        subtotal += base_price * quantity
        discount_total += (base_price - final_price) * quantity
        cost_total += line_cost

        sale_items.append({
            "product": product,
            "quantity": quantity,
            "base_price": base_price,
            "final_price": final_price,
            "unit_cost": product.avg_cost,
        })

    total = subtotal - discount_total

    paid_sum = sum((Decimal(str(p["amount"])) for p in payments_data), Decimal("0"))
    if payments_data and abs(paid_sum - total) > Decimal("0.01"):
        raise BusinessError(
            f"Сумма оплаты ({paid_sum}) не совпадает с итогом чека ({total})",
            code="payment_mismatch",
        )

    sale = Sale.objects.create(
        warehouse=warehouse,
        seller=seller,
        shift=shift,
        customer_name=customer_name,
        customer_phone=customer_phone,
        subtotal=subtotal,
        discount_total=discount_total,
        total=total,
        cost_total=cost_total,
        profit=total - cost_total,
        comment=comment,
        needs_approval=needs_approval,
        idempotency_key=idempotency_key,
    )

    for row in sale_items:
        SaleItem.objects.create(sale=sale, **row)
        move_stock(
            product=row["product"],
            warehouse=warehouse,
            qty_delta=-row["quantity"],
            reason=StockMovement.Reason.SALE,
            user=seller,
            unit_cost=row["product"].avg_cost,
            doc_type="sale",
            doc_id=sale.id,
            note=f"Продажа {sale.number}",
        )

    for p in payments_data:
        Payment.objects.create(sale=sale, method=p["method"], amount=Decimal(str(p["amount"])))

    return sale, True


@transaction.atomic
def create_return(*, sale: Sale, items_data, user, reason="", refund_method=None):
    """items_data: [{sale_item_id, quantity}]"""
    if not items_data:
        raise BusinessError("Не выбраны позиции для возврата", code="empty_return")

    ret = Return.objects.create(
        sale=sale, created_by=user, reason=reason,
        refund_method=refund_method or Payment.Method.CASH,
    )
    total_amount = Decimal("0")

    for row in items_data:
        sale_item = row["sale_item"]
        qty = Decimal(str(row["quantity"]))
        remaining = sale_item.quantity - sale_item.returned_qty
        if qty <= 0 or qty > remaining:
            raise BusinessError(
                f"Нельзя вернуть {qty} шт. позиции {sale_item.product.name}: доступно {remaining}",
                code="invalid_return_qty",
            )
        amount = qty * sale_item.final_price
        total_amount += amount

        ReturnItem.objects.create(ret=ret, sale_item=sale_item, quantity=qty, amount=amount)
        sale_item.returned_qty += qty
        sale_item.save(update_fields=["returned_qty"])

        move_stock(
            product=sale_item.product,
            warehouse=sale_item.sale.warehouse,
            qty_delta=qty,
            reason=StockMovement.Reason.RETURN,
            user=user,
            unit_cost=sale_item.unit_cost,
            doc_type="return",
            doc_id=ret.id,
            note=f"Возврат по чеку {sale.number}",
        )

    ret.total_amount = total_amount
    ret.save(update_fields=["total_amount"])

    all_items = list(sale.items.all())
    if all(i.returned_qty >= i.quantity for i in all_items):
        sale.status = Sale.Status.RETURNED
    else:
        sale.status = Sale.Status.PARTIALLY_RETURNED
    sale.save(update_fields=["status"])

    return ret

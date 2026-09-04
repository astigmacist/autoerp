"""
Core stock-movement engine. Every change to Stock MUST go through move_stock()
inside a transaction so that StockMovement stays the single source of truth
(see ТЗ §5.4). Never edit Stock.quantity directly anywhere else in the code.
"""
from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from apps.core.exceptions import BusinessError
from .models import (
    Inventory,
    Receipt,
    Stock,
    StockMovement,
    Transfer,
    Warehouse,
    WriteOff,
)


def move_stock(*, product, warehouse, qty_delta: Decimal, reason: str, user=None,
                unit_cost: Decimal = Decimal("0"), doc_type: str = "", doc_id: str = "",
                note: str = "", allow_negative: bool = False):
    """Atomically adjust Stock and append a StockMovement row. Locks the Stock row."""
    stock, _ = Stock.objects.select_for_update().get_or_create(
        product=product, warehouse=warehouse, defaults={"quantity": Decimal("0")}
    )
    new_qty = stock.quantity + qty_delta
    if new_qty < 0 and not allow_negative:
        raise BusinessError(
            detail="Недостаточно товара на складе",
            code="insufficient_stock",
            errors=[{
                "product_id": str(product.id),
                "product_name": product.name,
                "requested": str(-qty_delta),
                "available": str(stock.quantity),
            }],
            http_status=409,
        )
    stock.quantity = new_qty
    stock.save(update_fields=["quantity", "updated_at"])

    return StockMovement.objects.create(
        product=product,
        warehouse=warehouse,
        qty_delta=qty_delta,
        balance_after=new_qty,
        unit_cost=unit_cost,
        reason=reason,
        doc_type=doc_type,
        doc_id=str(doc_id),
        user=user,
        note=note,
    )


@transaction.atomic
def post_receipt(receipt: Receipt, user):
    if receipt.status != Receipt.Status.DRAFT:
        raise BusinessError("Документ уже проведён или отменён", code="invalid_status")
    items = list(receipt.items.select_related("product").all())
    if not items:
        raise BusinessError("В приходе нет позиций", code="empty_document")

    for item in items:
        product = item.product
        old_stock = Stock.objects.filter(product=product, warehouse=receipt.warehouse).first()
        old_qty = old_stock.quantity if old_stock else Decimal("0")
        old_cost = product.avg_cost or Decimal("0")

        move_stock(
            product=product,
            warehouse=receipt.warehouse,
            qty_delta=item.quantity,
            reason=StockMovement.Reason.RECEIPT,
            user=user,
            unit_cost=item.purchase_price,
            doc_type="receipt",
            doc_id=receipt.id,
            note=f"Приход {receipt.number}",
        )

        total_qty = old_qty + item.quantity
        if total_qty > 0:
            product.avg_cost = ((old_qty * old_cost) + (item.quantity * item.purchase_price)) / total_qty
        product.purchase_price = item.purchase_price
        if item.sale_price:
            product.sale_price = item.sale_price
        product.save(update_fields=["avg_cost", "purchase_price", "sale_price"])

    receipt.status = Receipt.Status.POSTED
    receipt.posted_at = timezone.now()
    receipt.save(update_fields=["status", "posted_at"])
    return receipt


@transaction.atomic
def post_transfer(transfer: Transfer, user):
    if transfer.status != Transfer.Status.DRAFT:
        raise BusinessError("Документ уже проведён или отменён", code="invalid_status")
    items = list(transfer.items.select_related("product").all())
    if not items:
        raise BusinessError("В перемещении нет позиций", code="empty_document")

    for item in items:
        product = item.product
        move_stock(
            product=product,
            warehouse=transfer.from_warehouse,
            qty_delta=-item.quantity,
            reason=StockMovement.Reason.TRANSFER_OUT,
            user=user,
            unit_cost=product.avg_cost,
            doc_type="transfer",
            doc_id=transfer.id,
            note=f"Перемещение {transfer.number} -> {transfer.to_warehouse.name}",
        )
        move_stock(
            product=product,
            warehouse=transfer.to_warehouse,
            qty_delta=item.quantity,
            reason=StockMovement.Reason.TRANSFER_IN,
            user=user,
            unit_cost=product.avg_cost,
            doc_type="transfer",
            doc_id=transfer.id,
            note=f"Перемещение {transfer.number} <- {transfer.from_warehouse.name}",
        )

    transfer.status = Transfer.Status.POSTED
    transfer.posted_at = timezone.now()
    transfer.save(update_fields=["status", "posted_at"])
    return transfer


def suggest_transfer_items(to_warehouse: Warehouse, from_warehouse: Warehouse):
    """Products below min_stock on to_warehouse, with a suggested top-up qty
    limited by what's actually available on from_warehouse."""
    from apps.catalog.models import Product

    result = []
    shop_stocks = {
        s.product_id: s.quantity
        for s in Stock.objects.filter(warehouse=to_warehouse)
    }
    main_stocks = {
        s.product_id: s.quantity
        for s in Stock.objects.filter(warehouse=from_warehouse)
    }
    products = Product.objects.filter(is_active=True)
    for p in products:
        shop_qty = shop_stocks.get(p.id, Decimal("0"))
        if shop_qty >= p.min_stock:
            continue
        main_qty = main_stocks.get(p.id, Decimal("0"))
        if main_qty <= 0:
            continue
        desired = (p.min_stock * 2) - shop_qty
        suggested = min(desired, main_qty)
        if suggested > 0:
            result.append({
                "product_id": p.id,
                "product_name": p.name,
                "sku": p.sku,
                "shop_qty": shop_qty,
                "main_qty": main_qty,
                "suggested_qty": suggested,
            })
    return result


@transaction.atomic
def post_inventory(inventory: Inventory, user):
    if inventory.status != Inventory.Status.DRAFT:
        raise BusinessError("Документ уже проведён", code="invalid_status")
    items = list(inventory.items.select_related("product").all())
    for item in items:
        diff = item.qty_fact - item.qty_system
        if diff == 0:
            continue
        move_stock(
            product=item.product,
            warehouse=inventory.warehouse,
            qty_delta=diff,
            reason=StockMovement.Reason.INVENTORY,
            user=user,
            unit_cost=item.product.avg_cost,
            doc_type="inventory",
            doc_id=inventory.id,
            note=f"Инвентаризация {inventory.number}",
        )
    inventory.status = Inventory.Status.POSTED
    inventory.posted_at = timezone.now()
    inventory.save(update_fields=["status", "posted_at"])
    return inventory


@transaction.atomic
def post_writeoff(writeoff: WriteOff, user):
    if writeoff.status != WriteOff.Status.DRAFT:
        raise BusinessError("Документ уже проведён", code="invalid_status")
    items = list(writeoff.items.select_related("product").all())
    if not items:
        raise BusinessError("В списании нет позиций", code="empty_document")
    for item in items:
        move_stock(
            product=item.product,
            warehouse=writeoff.warehouse,
            qty_delta=-item.quantity,
            reason=StockMovement.Reason.WRITEOFF,
            user=user,
            unit_cost=item.product.avg_cost,
            doc_type="writeoff",
            doc_id=writeoff.id,
            note=f"Списание {writeoff.number}: {writeoff.reason_text}",
        )
    writeoff.status = WriteOff.Status.POSTED
    writeoff.posted_at = timezone.now()
    writeoff.save(update_fields=["status", "posted_at"])
    return writeoff

from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import Sum

from apps.inventory.models import Stock, StockMovement


class Command(BaseCommand):
    help = "Пересчитывает Stock.quantity из журнала StockMovement (источник истины). Использовать при расхождениях."

    @transaction.atomic
    def handle(self, *args, **options):
        agg = list(
            StockMovement.objects.values("product_id", "warehouse_id").annotate(total=Sum("qty_delta"))
        )
        updated = 0
        for row in agg:
            stock, _ = Stock.objects.select_for_update().get_or_create(
                product_id=row["product_id"], warehouse_id=row["warehouse_id"], defaults={"quantity": 0}
            )
            new_qty = row["total"] or Decimal("0")
            if stock.quantity != new_qty:
                stock.quantity = new_qty
                stock.save(update_fields=["quantity"])
                updated += 1
        self.stdout.write(self.style.SUCCESS(f"Пересчитано записей: {updated}"))

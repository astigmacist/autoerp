from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db.models import Sum

from apps.inventory.models import Stock, StockMovement


class Command(BaseCommand):
    help = "Сверяет Stock.quantity с суммой StockMovement.qty_delta для каждого (товар, склад). Печатает расхождения."

    def handle(self, *args, **options):
        agg = {
            (row["product_id"], row["warehouse_id"]): row["total"] or Decimal("0")
            for row in StockMovement.objects.values("product_id", "warehouse_id").annotate(total=Sum("qty_delta"))
        }
        mismatches = 0
        for stock in Stock.objects.select_related("product", "warehouse"):
            expected = agg.get((stock.product_id, stock.warehouse_id), Decimal("0"))
            if expected != stock.quantity:
                mismatches += 1
                self.stdout.write(self.style.ERROR(
                    f"{stock.product.sku} @ {stock.warehouse.code}: Stock={stock.quantity} != Movements={expected}"
                ))
        if mismatches == 0:
            self.stdout.write(self.style.SUCCESS("Расхождений не найдено. Stock согласован с журналом движений."))
        else:
            self.stdout.write(self.style.WARNING(f"Найдено расхождений: {mismatches}"))

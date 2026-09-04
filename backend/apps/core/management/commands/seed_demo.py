from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction

from apps.accounts.models import User
from apps.catalog.models import Brand, Category, Product
from apps.core.models import AppSettings
from apps.inventory.models import Stock, Warehouse
from apps.inventory.services import move_stock
from apps.inventory.models import StockMovement


class Command(BaseCommand):
    help = "Заполняет базу стартовыми данными: склады, пользователи, немного товаров (для демо/разработки)."

    @transaction.atomic
    def handle(self, *args, **options):
        AppSettings.load()

        main, _ = Warehouse.objects.get_or_create(
            code="MAIN", defaults={"name": "Основной склад", "kind": Warehouse.Kind.MAIN, "is_sellable": False}
        )
        shop, _ = Warehouse.objects.get_or_create(
            code="SHOP", defaults={"name": "Магазин", "kind": Warehouse.Kind.SHOP, "is_sellable": True}
        )

        owner, created = User.objects.get_or_create(
            username="owner", defaults={"role": User.Role.OWNER, "first_name": "Владелец", "is_staff": True, "is_superuser": True}
        )
        if created:
            owner.set_password("owner12345")
            owner.save()
            self.stdout.write(self.style.SUCCESS("Создан владелец: owner / owner12345"))

        stock_mgr, created = User.objects.get_or_create(
            username="stock", defaults={"role": User.Role.STOCK, "first_name": "Кладовщик"}
        )
        if created:
            stock_mgr.set_password("stock12345")
            stock_mgr.save()
            self.stdout.write(self.style.SUCCESS("Создан менеджер склада: stock / stock12345"))

        seller, created = User.objects.get_or_create(
            username="seller", defaults={"role": User.Role.SELLER, "first_name": "Продавец"}
        )
        if created:
            seller.set_password("seller12345")
            seller.save()
            self.stdout.write(self.style.SUCCESS("Создан продавец: seller / seller12345"))

        brand_bosch, _ = Brand.objects.get_or_create(name="Bosch")
        brand_mann, _ = Brand.objects.get_or_create(name="Mann Filter")
        brand_sakura, _ = Brand.objects.get_or_create(name="Sakura")

        cat_filters, _ = Category.objects.get_or_create(name="Фильтры")
        cat_brakes, _ = Category.objects.get_or_create(name="Тормозная система")
        cat_oils, _ = Category.objects.get_or_create(name="Масла и жидкости")

        demo_products = [
            dict(name="Фильтр масляный Toyota Camry 2.5", sku="AZ-000001", oem_code="90915-YZZD4",
                 brand=brand_sakura, category=cat_filters, purchase_price=1800, sale_price=3500, main_qty=20, shop_qty=2),
            dict(name="Колодки тормозные передние Camry 40/50", sku="AZ-000002", oem_code="04465-33471",
                 brand=brand_bosch, category=cat_brakes, purchase_price=9500, sale_price=15000, main_qty=10, shop_qty=6),
            dict(name="Фильтр воздушный Mann Camry", sku="AZ-000003", oem_code="17801-0V010",
                 brand=brand_mann, category=cat_filters, purchase_price=2200, sale_price=4200, main_qty=15, shop_qty=1),
            dict(name="Масло моторное 5W-30 синтетика 4л", sku="AZ-000004", oem_code="",
                 brand=brand_bosch, category=cat_oils, purchase_price=8500, sale_price=13500, main_qty=25, shop_qty=8),
            dict(name="Колодки тормозные задние Camry 40/50", sku="AZ-000005", oem_code="04466-33130",
                 brand=brand_bosch, category=cat_brakes, purchase_price=7200, sale_price=12000, main_qty=8, shop_qty=3),
        ]

        for row in demo_products:
            main_qty = row.pop("main_qty")
            shop_qty = row.pop("shop_qty")
            product, created = Product.objects.get_or_create(sku=row["sku"], defaults={**row, "min_stock": 5})
            if not created:
                continue
            product.avg_cost = row["purchase_price"]
            product.save(update_fields=["avg_cost"])

            move_stock(product=product, warehouse=main, qty_delta=Decimal(main_qty),
                       reason=StockMovement.Reason.RECEIPT, unit_cost=row["purchase_price"],
                       note="Начальный остаток (демо)")
            move_stock(product=product, warehouse=shop, qty_delta=Decimal(shop_qty),
                       reason=StockMovement.Reason.RECEIPT, unit_cost=row["purchase_price"],
                       note="Начальный остаток (демо)")
            self.stdout.write(f"  + {product.name}")

        self.stdout.write(self.style.SUCCESS("Демо-данные загружены."))

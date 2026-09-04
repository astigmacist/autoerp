from decimal import Decimal
from io import StringIO

from django.core.management import call_command
from django.test import TestCase

from apps.accounts.models import User
from apps.catalog.models import Product
from apps.core.exceptions import BusinessError
from apps.core.models import AppSettings
from . import services
from .models import (
    Inventory, InventoryItem, Receipt, ReceiptItem, Stock, Transfer,
    TransferItem, Warehouse, WriteOff, WriteOffItem,
)


def make_warehouses():
    main = Warehouse.objects.create(name="Основной склад", code="MAIN", kind=Warehouse.Kind.MAIN, is_sellable=False)
    shop = Warehouse.objects.create(name="Магазин", code="SHOP", kind=Warehouse.Kind.SHOP, is_sellable=True)
    return main, shop


class ReceiptTests(TestCase):
    def setUp(self):
        AppSettings.load()
        self.main, self.shop = make_warehouses()
        self.user = User.objects.create_user(username="stock", password="x", role=User.Role.STOCK)
        self.product = Product.objects.create(name="Фильтр", sku="F-1", sale_price=3500, purchase_price=0, avg_cost=0)

    def test_posting_receipt_increments_stock_and_recalculates_avg_cost(self):
        receipt = Receipt.objects.create(date="2026-09-03", warehouse=self.main, created_by=self.user)
        ReceiptItem.objects.create(receipt=receipt, product=self.product, quantity=Decimal("10"), purchase_price=Decimal("1800"))

        services.post_receipt(receipt, self.user)

        receipt.refresh_from_db()
        self.assertEqual(receipt.status, Receipt.Status.POSTED)
        stock = Stock.objects.get(product=self.product, warehouse=self.main)
        self.assertEqual(stock.quantity, Decimal("10"))
        self.product.refresh_from_db()
        self.assertEqual(self.product.avg_cost, Decimal("1800"))
        self.assertEqual(self.product.purchase_price, Decimal("1800"))

    def test_avg_cost_is_weighted_average_across_two_receipts(self):
        r1 = Receipt.objects.create(date="2026-09-01", warehouse=self.main, created_by=self.user)
        ReceiptItem.objects.create(receipt=r1, product=self.product, quantity=Decimal("10"), purchase_price=Decimal("1000"))
        services.post_receipt(r1, self.user)

        r2 = Receipt.objects.create(date="2026-09-02", warehouse=self.main, created_by=self.user)
        ReceiptItem.objects.create(receipt=r2, product=self.product, quantity=Decimal("10"), purchase_price=Decimal("2000"))
        services.post_receipt(r2, self.user)

        self.product.refresh_from_db()
        # (10*1000 + 10*2000) / 20 = 1500
        self.assertEqual(self.product.avg_cost, Decimal("1500"))

    def test_cannot_post_receipt_twice(self):
        receipt = Receipt.objects.create(date="2026-09-03", warehouse=self.main, created_by=self.user)
        ReceiptItem.objects.create(receipt=receipt, product=self.product, quantity=Decimal("1"), purchase_price=Decimal("100"))
        services.post_receipt(receipt, self.user)
        with self.assertRaises(BusinessError):
            services.post_receipt(receipt, self.user)

    def test_cannot_post_empty_receipt(self):
        receipt = Receipt.objects.create(date="2026-09-03", warehouse=self.main, created_by=self.user)
        with self.assertRaises(BusinessError):
            services.post_receipt(receipt, self.user)


class TransferTests(TestCase):
    def setUp(self):
        AppSettings.load()
        self.main, self.shop = make_warehouses()
        self.user = User.objects.create_user(username="stock", password="x", role=User.Role.STOCK)
        self.product = Product.objects.create(name="Колодки", sku="B-1", sale_price=15000, purchase_price=9500, avg_cost=9500)

        receipt = Receipt.objects.create(date="2026-09-01", warehouse=self.main, created_by=self.user)
        ReceiptItem.objects.create(receipt=receipt, product=self.product, quantity=Decimal("10"), purchase_price=Decimal("9500"))
        services.post_receipt(receipt, self.user)

    def test_posting_transfer_moves_stock_between_warehouses(self):
        transfer = Transfer.objects.create(date="2026-09-03", from_warehouse=self.main, to_warehouse=self.shop, created_by=self.user)
        TransferItem.objects.create(transfer=transfer, product=self.product, quantity=Decimal("4"))

        services.post_transfer(transfer, self.user)

        self.assertEqual(Stock.objects.get(product=self.product, warehouse=self.main).quantity, Decimal("6"))
        self.assertEqual(Stock.objects.get(product=self.product, warehouse=self.shop).quantity, Decimal("4"))

    def test_transfer_more_than_available_fails_and_rolls_back(self):
        transfer = Transfer.objects.create(date="2026-09-03", from_warehouse=self.main, to_warehouse=self.shop, created_by=self.user)
        TransferItem.objects.create(transfer=transfer, product=self.product, quantity=Decimal("999"))

        with self.assertRaises(BusinessError) as ctx:
            services.post_transfer(transfer, self.user)
        self.assertEqual(ctx.exception.code, "insufficient_stock")

        # Nothing should have moved - fully rolled back.
        transfer.refresh_from_db()
        self.assertEqual(transfer.status, Transfer.Status.DRAFT)
        self.assertEqual(Stock.objects.get(product=self.product, warehouse=self.main).quantity, Decimal("10"))
        self.assertFalse(Stock.objects.filter(product=self.product, warehouse=self.shop).exists())

    def test_suggest_transfer_items_respects_min_stock_and_availability(self):
        self.product.min_stock = 5
        self.product.save(update_fields=["min_stock"])
        # shop currently has 0 -> should be suggested, capped by what's on main (10)
        suggestions = services.suggest_transfer_items(self.shop, self.main)
        self.assertEqual(len(suggestions), 1)
        self.assertEqual(suggestions[0]["product_id"], self.product.id)
        self.assertLessEqual(suggestions[0]["suggested_qty"], Decimal("10"))


class InventoryWriteOffTests(TestCase):
    def setUp(self):
        AppSettings.load()
        self.main, self.shop = make_warehouses()
        self.user = User.objects.create_user(username="stock", password="x", role=User.Role.STOCK)
        self.product = Product.objects.create(name="Масло", sku="OIL-1", sale_price=13500, purchase_price=8500, avg_cost=8500)
        receipt = Receipt.objects.create(date="2026-09-01", warehouse=self.main, created_by=self.user)
        ReceiptItem.objects.create(receipt=receipt, product=self.product, quantity=Decimal("20"), purchase_price=Decimal("8500"))
        services.post_receipt(receipt, self.user)

    def test_inventory_posts_positive_and_negative_corrections(self):
        inv = Inventory.objects.create(date="2026-09-03", warehouse=self.main, created_by=self.user)
        InventoryItem.objects.create(inventory=inv, product=self.product, qty_system=Decimal("20"), qty_fact=Decimal("18"))

        services.post_inventory(inv, self.user)

        self.assertEqual(Stock.objects.get(product=self.product, warehouse=self.main).quantity, Decimal("18"))
        inv.refresh_from_db()
        self.assertEqual(inv.status, Inventory.Status.POSTED)

    def test_inventory_with_no_diff_does_not_create_movement(self):
        from .models import StockMovement
        inv = Inventory.objects.create(date="2026-09-03", warehouse=self.main, created_by=self.user)
        InventoryItem.objects.create(inventory=inv, product=self.product, qty_system=Decimal("20"), qty_fact=Decimal("20"))
        before = StockMovement.objects.count()
        services.post_inventory(inv, self.user)
        after = StockMovement.objects.count()
        self.assertEqual(before, after)

    def test_writeoff_decrements_stock(self):
        wo = WriteOff.objects.create(date="2026-09-03", warehouse=self.main, reason_text="Брак", created_by=self.user)
        WriteOffItem.objects.create(writeoff=wo, product=self.product, quantity=Decimal("2"))

        services.post_writeoff(wo, self.user)

        self.assertEqual(Stock.objects.get(product=self.product, warehouse=self.main).quantity, Decimal("18"))

    def test_writeoff_more_than_available_fails(self):
        wo = WriteOff.objects.create(date="2026-09-03", warehouse=self.main, reason_text="Брак", created_by=self.user)
        WriteOffItem.objects.create(writeoff=wo, product=self.product, quantity=Decimal("999"))
        with self.assertRaises(BusinessError):
            services.post_writeoff(wo, self.user)


class VerifyRecalcStockCommandTests(TestCase):
    def setUp(self):
        AppSettings.load()
        self.main, self.shop = make_warehouses()
        self.user = User.objects.create_user(username="stock", password="x", role=User.Role.STOCK)
        self.product = Product.objects.create(name="Фильтр", sku="F-2", sale_price=3500, purchase_price=1800, avg_cost=1800)
        receipt = Receipt.objects.create(date="2026-09-01", warehouse=self.main, created_by=self.user)
        ReceiptItem.objects.create(receipt=receipt, product=self.product, quantity=Decimal("5"), purchase_price=Decimal("1800"))
        services.post_receipt(receipt, self.user)

    def test_verify_stock_reports_no_mismatch_when_consistent(self):
        out = StringIO()
        call_command("verify_stock", stdout=out)
        self.assertIn("Расхождений не найдено", out.getvalue())

    def test_verify_stock_detects_manual_tampering(self):
        stock = Stock.objects.get(product=self.product, warehouse=self.main)
        stock.quantity = Decimal("999")
        stock.save(update_fields=["quantity"])

        out = StringIO()
        call_command("verify_stock", stdout=out)
        self.assertIn("Найдено расхождений: 1", out.getvalue())

    def test_recalc_stock_fixes_mismatch(self):
        stock = Stock.objects.get(product=self.product, warehouse=self.main)
        stock.quantity = Decimal("999")
        stock.save(update_fields=["quantity"])

        call_command("recalc_stock", stdout=StringIO())

        stock.refresh_from_db()
        self.assertEqual(stock.quantity, Decimal("5"))

import uuid
from decimal import Decimal

from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.catalog.models import Product
from apps.core.exceptions import BusinessError
from apps.core.models import AppSettings
from apps.inventory.models import Stock, StockMovement, Warehouse
from apps.inventory.services import move_stock
from . import services
from .models import Sale


def make_product(sku="P-1", sale_price=3500, avg_cost=1800, min_stock=5):
    p = Product.objects.create(
        name=f"Товар {sku}", sku=sku, sale_price=sale_price, purchase_price=avg_cost,
        avg_cost=avg_cost, min_stock=min_stock,
    )
    return p


def make_warehouses():
    main = Warehouse.objects.create(name="Основной склад", code="MAIN", kind=Warehouse.Kind.MAIN, is_sellable=False)
    shop = Warehouse.objects.create(name="Магазин", code="SHOP", kind=Warehouse.Kind.SHOP, is_sellable=True)
    return main, shop


class SaleServiceTests(TestCase):
    def setUp(self):
        AppSettings.load()
        self.main, self.shop = make_warehouses()
        self.product = make_product()
        self.owner = User.objects.create_user(username="owner", password="x", role=User.Role.OWNER)
        self.seller = User.objects.create_user(username="seller", password="x", role=User.Role.SELLER)
        move_stock(product=self.product, warehouse=self.shop, qty_delta=Decimal("10"),
                   reason=StockMovement.Reason.RECEIPT, unit_cost=self.product.avg_cost)

    def test_full_price_sale_decrements_stock(self):
        sale, created = services.create_sale(
            warehouse=self.shop, seller=self.seller,
            items_data=[{"product": self.product, "quantity": Decimal("2"), "final_price": Decimal("3500")}],
            payments_data=[{"method": "cash", "amount": Decimal("7000")}],
        )
        self.assertTrue(created)
        self.assertEqual(sale.total, Decimal("7000.00"))
        self.assertEqual(sale.discount_total, Decimal("0.00"))
        self.assertFalse(sale.needs_approval)

        stock = Stock.objects.get(product=self.product, warehouse=self.shop)
        self.assertEqual(stock.quantity, Decimal("8"))

    def test_negotiated_discount_is_recorded(self):
        # ТЗ example: товар 5000, продали за 4000 -> скидка 1000 записывается явно
        product = make_product(sku="P-DISCOUNT", sale_price=5000, avg_cost=2000)
        move_stock(product=product, warehouse=self.shop, qty_delta=Decimal("5"), reason=StockMovement.Reason.RECEIPT)

        sale, _ = services.create_sale(
            warehouse=self.shop, seller=self.owner,
            items_data=[{"product": product, "quantity": Decimal("1"), "final_price": Decimal("4000")}],
            payments_data=[{"method": "kaspi_qr", "amount": Decimal("4000")}],
        )
        item = sale.items.first()
        self.assertEqual(item.discount_amount, Decimal("1000"))
        self.assertEqual(sale.total, Decimal("4000.00"))

    def test_seller_over_discount_limit_flags_needs_approval(self):
        AppSettings.objects.filter(pk=1).update(seller_discount_limit_percent=Decimal("10"))
        sale, _ = services.create_sale(
            warehouse=self.shop, seller=self.seller,
            items_data=[{"product": self.product, "quantity": Decimal("1"), "final_price": Decimal("3000")}],  # ~14% off
            payments_data=[{"method": "cash", "amount": Decimal("3000")}],
        )
        self.assertTrue(sale.needs_approval)

    def test_owner_has_no_discount_limit(self):
        sale, _ = services.create_sale(
            warehouse=self.shop, seller=self.owner,
            items_data=[{"product": self.product, "quantity": Decimal("1"), "final_price": Decimal("1000")}],  # huge discount
            payments_data=[{"method": "cash", "amount": Decimal("1000")}],
        )
        # Owner can discount freely, but selling below cost still flags for the record.
        self.assertTrue(sale.needs_approval)

    def test_insufficient_stock_raises_business_error(self):
        with self.assertRaises(BusinessError) as ctx:
            services.create_sale(
                warehouse=self.shop, seller=self.seller,
                items_data=[{"product": self.product, "quantity": Decimal("999"), "final_price": Decimal("3500")}],
                payments_data=[{"method": "cash", "amount": Decimal("3496500")}],
            )
        self.assertEqual(ctx.exception.code, "insufficient_stock")
        self.assertEqual(ctx.exception.http_status, 409)
        # Stock must be untouched after the failed attempt (atomic rollback).
        stock = Stock.objects.get(product=self.product, warehouse=self.shop)
        self.assertEqual(stock.quantity, Decimal("10"))

    def test_idempotency_key_prevents_duplicate_sale(self):
        key = uuid.uuid4()
        sale1, created1 = services.create_sale(
            warehouse=self.shop, seller=self.seller, idempotency_key=key,
            items_data=[{"product": self.product, "quantity": Decimal("1"), "final_price": Decimal("3500")}],
            payments_data=[{"method": "cash", "amount": Decimal("3500")}],
        )
        sale2, created2 = services.create_sale(
            warehouse=self.shop, seller=self.seller, idempotency_key=key,
            items_data=[{"product": self.product, "quantity": Decimal("1"), "final_price": Decimal("3500")}],
            payments_data=[{"method": "cash", "amount": Decimal("3500")}],
        )
        self.assertTrue(created1)
        self.assertFalse(created2)
        self.assertEqual(sale1.id, sale2.id)
        self.assertEqual(Sale.objects.count(), 1)

        stock = Stock.objects.get(product=self.product, warehouse=self.shop)
        self.assertEqual(stock.quantity, Decimal("9"))  # decremented only once

    def test_payment_mismatch_rejected(self):
        with self.assertRaises(BusinessError) as ctx:
            services.create_sale(
                warehouse=self.shop, seller=self.seller,
                items_data=[{"product": self.product, "quantity": Decimal("1"), "final_price": Decimal("3500")}],
                payments_data=[{"method": "cash", "amount": Decimal("1000")}],
            )
        self.assertEqual(ctx.exception.code, "payment_mismatch")

    def test_return_puts_stock_back(self):
        sale, _ = services.create_sale(
            warehouse=self.shop, seller=self.seller,
            items_data=[{"product": self.product, "quantity": Decimal("3"), "final_price": Decimal("3500")}],
            payments_data=[{"method": "cash", "amount": Decimal("10500")}],
        )
        stock_after_sale = Stock.objects.get(product=self.product, warehouse=self.shop).quantity
        self.assertEqual(stock_after_sale, Decimal("7"))

        sale_item = sale.items.first()
        services.create_return(
            sale=sale, user=self.seller,
            items_data=[{"sale_item": sale_item, "quantity": Decimal("1")}],
        )
        stock_after_return = Stock.objects.get(product=self.product, warehouse=self.shop).quantity
        self.assertEqual(stock_after_return, Decimal("8"))

        sale.refresh_from_db()
        self.assertEqual(sale.status, Sale.Status.PARTIALLY_RETURNED)

    def test_return_more_than_purchased_rejected(self):
        sale, _ = services.create_sale(
            warehouse=self.shop, seller=self.seller,
            items_data=[{"product": self.product, "quantity": Decimal("1"), "final_price": Decimal("3500")}],
            payments_data=[{"method": "cash", "amount": Decimal("3500")}],
        )
        sale_item = sale.items.first()
        with self.assertRaises(BusinessError):
            services.create_return(
                sale=sale, user=self.seller,
                items_data=[{"sale_item": sale_item, "quantity": Decimal("2")}],
            )


class SaleApiTests(TestCase):
    """Exercises the POS checkout endpoint end-to-end, including role-based field hiding."""

    def setUp(self):
        AppSettings.load()
        self.main, self.shop = make_warehouses()
        self.product = make_product()
        move_stock(product=self.product, warehouse=self.shop, qty_delta=Decimal("5"), reason=StockMovement.Reason.RECEIPT)
        self.owner = User.objects.create_user(username="owner", password="pw12345", role=User.Role.OWNER)
        self.seller = User.objects.create_user(username="seller", password="pw12345", role=User.Role.SELLER)

    def auth(self, user):
        client = APIClient()
        client.force_authenticate(user=user)
        return client

    def test_seller_cannot_see_cost_fields_in_product_api(self):
        client = self.auth(self.seller)
        resp = client.get(f"/api/v1/products/?search={self.product.sku}")
        self.assertEqual(resp.status_code, 200)
        row = resp.json()["results"][0]
        self.assertNotIn("purchase_price", row)
        self.assertNotIn("avg_cost", row)

    def test_owner_sees_cost_fields(self):
        client = self.auth(self.owner)
        resp = client.get(f"/api/v1/products/?search={self.product.sku}")
        row = resp.json()["results"][0]
        self.assertIn("purchase_price", row)
        self.assertIn("avg_cost", row)

    def test_create_sale_endpoint_success(self):
        client = self.auth(self.seller)
        resp = client.post(
            "/api/v1/sales/create/",
            {
                "warehouse_id": str(self.shop.id),
                "items": [{"product_id": str(self.product.id), "quantity": "1", "final_price": "3500"}],
                "payments": [{"method": "cash", "amount": "3500"}],
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 201, resp.content)
        self.assertEqual(resp.json()["total"], "3500.00")

    def test_create_sale_endpoint_overselling_returns_409(self):
        client = self.auth(self.seller)
        resp = client.post(
            "/api/v1/sales/create/",
            {
                "warehouse_id": str(self.shop.id),
                "items": [{"product_id": str(self.product.id), "quantity": "999", "final_price": "3500"}],
                # amount matches subtotal (999 * 3500) so the failure we're testing is
                # specifically insufficient_stock, not the payment-mismatch check.
                "payments": [{"method": "cash", "amount": "3496500"}],
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 409, resp.content)
        self.assertEqual(resp.json()["code"], "insufficient_stock")

    def test_unauthenticated_cannot_create_sale(self):
        client = APIClient()
        resp = client.post("/api/v1/sales/create/", {}, format="json")
        self.assertEqual(resp.status_code, 401)

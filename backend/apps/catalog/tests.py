from rest_framework.test import APIClient
from django.test import TestCase

from apps.accounts.models import User
from .models import Product
from .serializers import ProductSerializer


class SkuAutoGenerationTests(TestCase):
    """The frontend lets warehouse staff create a product without typing a SKU
    (e.g. the 'create on the fly' flow from the receipt form) — the backend
    must fill one in itself rather than rejecting the request."""

    def test_blank_sku_is_auto_generated(self):
        serializer = ProductSerializer(data={"name": "Деталь без кода", "sale_price": "1000"})
        serializer.is_valid(raise_exception=True)
        product = serializer.save()
        self.assertEqual(product.sku, "AZ-000001")

    def test_auto_generated_skus_increment_and_skip_manual_ones(self):
        Product.objects.create(name="Ручной", sku="AZ-000005", sale_price=1)

        serializer = ProductSerializer(data={"name": "Автоматический", "sale_price": "1000"})
        serializer.is_valid(raise_exception=True)
        product = serializer.save()
        self.assertEqual(product.sku, "AZ-000006")

    def test_explicit_sku_is_respected(self):
        serializer = ProductSerializer(data={"name": "Со своим кодом", "sku": "CUSTOM-1", "sale_price": "1000"})
        serializer.is_valid(raise_exception=True)
        product = serializer.save()
        self.assertEqual(product.sku, "CUSTOM-1")


class ProductApiCreateTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username="owner2", password="x", role=User.Role.OWNER)
        self.seller = User.objects.create_user(username="seller2", password="x", role=User.Role.SELLER)

    def test_owner_can_create_product_without_sku(self):
        client = APIClient()
        client.force_authenticate(user=self.owner)
        resp = client.post("/api/v1/products/", {"name": "Новый товар", "sale_price": "500"}, format="json")
        self.assertEqual(resp.status_code, 201, resp.content)
        self.assertTrue(resp.data["sku"].startswith("AZ-"))

    def test_seller_cannot_create_product(self):
        client = APIClient()
        client.force_authenticate(user=self.seller)
        resp = client.post("/api/v1/products/", {"name": "Новый товар", "sale_price": "500"}, format="json")
        self.assertEqual(resp.status_code, 403)

from django.db import IntegrityError, transaction
from rest_framework import serializers

from apps.inventory.models import Stock, Warehouse
from .models import Brand, Category, Product, Supplier


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ("id", "name", "parent", "is_active")


class BrandSerializer(serializers.ModelSerializer):
    class Meta:
        model = Brand
        fields = ("id", "name", "country", "is_active")


class SupplierSerializer(serializers.ModelSerializer):
    class Meta:
        model = Supplier
        fields = ("id", "name", "phone", "note", "is_active")


class ProductStockSerializer(serializers.Serializer):
    warehouse_id = serializers.UUIDField(source="warehouse.id")
    warehouse_code = serializers.CharField(source="warehouse.code")
    quantity = serializers.DecimalField(max_digits=12, decimal_places=3)


class ProductSerializer(serializers.ModelSerializer):
    brand_name = serializers.CharField(source="brand.name", read_only=True, default=None)
    category_name = serializers.CharField(source="category.name", read_only=True, default=None)
    stocks = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = (
            "id", "name", "sku", "oem_code", "barcode", "brand", "brand_name",
            "category", "category_name", "unit", "purchase_price", "avg_cost",
            "sale_price", "min_price", "min_stock", "applicability", "location",
            "note", "is_active", "stocks", "created_at",
        )
        read_only_fields = ("avg_cost",)
        extra_kwargs = {"sku": {"required": False, "allow_blank": True}}

    SKU_PREFIX = "AZ-"

    def _generate_sku(self):
        max_n = 0
        for sku in Product.objects.filter(sku__startswith=self.SKU_PREFIX).values_list("sku", flat=True):
            suffix = sku[len(self.SKU_PREFIX):]
            if suffix.isdigit():
                max_n = max(max_n, int(suffix))
        return f"{self.SKU_PREFIX}{max_n + 1:06d}"

    def create(self, validated_data):
        if not validated_data.get("sku"):
            last_error = None
            for _ in range(5):
                validated_data["sku"] = self._generate_sku()
                try:
                    with transaction.atomic():
                        return super().create(validated_data)
                except IntegrityError as exc:
                    last_error = exc
                    continue
            raise serializers.ValidationError(
                {"sku": "Не удалось сгенерировать уникальный код, укажите вручную."}
            ) from last_error
        return super().create(validated_data)

    def get_stocks(self, obj):
        stocks = getattr(obj, "prefetched_stocks", None)
        if stocks is None:
            stocks = obj.stocks.select_related("warehouse").all()
        return [
            {"warehouse_id": s.warehouse_id, "warehouse_code": s.warehouse.code, "quantity": s.quantity}
            for s in stocks
        ]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get("request")
        if request and not request.user.can_see_cost:
            data.pop("purchase_price", None)
            data.pop("avg_cost", None)
        return data


class ProductSearchResultSerializer(serializers.ModelSerializer):
    """Lightweight payload for the POS search box."""

    shop_qty = serializers.SerializerMethodField()
    main_qty = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = ("id", "name", "sku", "oem_code", "barcode", "unit", "sale_price", "min_stock", "shop_qty", "main_qty")

    def get_shop_qty(self, obj):
        return self.context.get("shop_qty_map", {}).get(obj.id, 0)

    def get_main_qty(self, obj):
        return self.context.get("main_qty_map", {}).get(obj.id, 0)

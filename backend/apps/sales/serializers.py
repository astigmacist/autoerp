from decimal import Decimal

from rest_framework import serializers

from apps.catalog.models import Product
from .models import Payment, Return, ReturnItem, Sale, SaleItem, Shift


class PaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = ("id", "method", "amount")


class SaleItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    sku = serializers.CharField(source="product.sku", read_only=True)
    amount = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)
    discount_amount = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)
    discount_percent = serializers.DecimalField(max_digits=6, decimal_places=2, read_only=True)

    class Meta:
        model = SaleItem
        fields = (
            "id", "product", "product_name", "sku", "quantity", "base_price",
            "final_price", "amount", "discount_amount", "discount_percent", "returned_qty",
        )


class SaleSerializer(serializers.ModelSerializer):
    items = SaleItemSerializer(many=True, read_only=True)
    payments = PaymentSerializer(many=True, read_only=True)
    seller_name = serializers.CharField(source="seller.get_full_name", read_only=True, default=None)
    warehouse_name = serializers.CharField(source="warehouse.name", read_only=True)

    class Meta:
        model = Sale
        fields = (
            "id", "number", "created_at", "warehouse", "warehouse_name", "seller", "seller_name",
            "customer_name", "customer_phone", "subtotal", "discount_total", "total",
            "cost_total", "profit", "status", "comment", "needs_approval", "items", "payments",
        )

    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get("request")
        if request and not request.user.can_see_cost:
            data.pop("cost_total", None)
            data.pop("profit", None)
        return data


# --- write serializers for the POS "create sale" endpoint ---

class SaleItemInputSerializer(serializers.Serializer):
    product_id = serializers.UUIDField()
    quantity = serializers.DecimalField(max_digits=12, decimal_places=3, min_value=Decimal("0.001"))
    final_price = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal("0"))


class PaymentInputSerializer(serializers.Serializer):
    method = serializers.ChoiceField(choices=Payment.Method.choices)
    amount = serializers.DecimalField(max_digits=14, decimal_places=2, min_value=Decimal("0.01"))


class SaleCreateSerializer(serializers.Serializer):
    idempotency_key = serializers.UUIDField(required=False, allow_null=True)
    warehouse_id = serializers.UUIDField()
    items = SaleItemInputSerializer(many=True)
    payments = PaymentInputSerializer(many=True)
    customer_name = serializers.CharField(required=False, allow_blank=True, default="")
    customer_phone = serializers.CharField(required=False, allow_blank=True, default="")
    comment = serializers.CharField(required=False, allow_blank=True, default="")

    def validate_items(self, value):
        if not value:
            raise serializers.ValidationError("Добавьте хотя бы один товар")
        return value


class ReturnItemInputSerializer(serializers.Serializer):
    sale_item_id = serializers.IntegerField()
    quantity = serializers.DecimalField(max_digits=12, decimal_places=3, min_value=Decimal("0.001"))


class ReturnCreateSerializer(serializers.Serializer):
    items = ReturnItemInputSerializer(many=True)
    reason = serializers.CharField(required=False, allow_blank=True, default="")
    refund_method = serializers.ChoiceField(choices=Payment.Method.choices, required=False)


class ReturnItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReturnItem
        fields = ("id", "sale_item", "quantity", "amount")


class ReturnSerializer(serializers.ModelSerializer):
    items = ReturnItemSerializer(many=True, read_only=True)

    class Meta:
        model = Return
        fields = ("id", "number", "created_at", "sale", "reason", "total_amount", "refund_method", "items")


class ShiftSerializer(serializers.ModelSerializer):
    opened_by_name = serializers.CharField(source="opened_by.get_full_name", read_only=True, default=None)
    cash_diff = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = Shift
        fields = (
            "id", "opened_at", "closed_at", "opened_by", "opened_by_name", "closed_by",
            "warehouse", "cash_start", "cash_end_fact", "cash_end_system", "status", "cash_diff",
        )
        read_only_fields = ("opened_by", "closed_by", "cash_end_system", "status")

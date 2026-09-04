from rest_framework import serializers

from apps.catalog.models import Product
from .models import (
    Inventory, InventoryItem, Receipt, ReceiptItem, Stock, StockMovement,
    Transfer, TransferItem, Warehouse, WriteOff, WriteOffItem,
)


class WarehouseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Warehouse
        fields = ("id", "name", "code", "kind", "is_sellable", "is_active")


class StockSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    sku = serializers.CharField(source="product.sku", read_only=True)
    min_stock = serializers.IntegerField(source="product.min_stock", read_only=True)
    warehouse_name = serializers.CharField(source="warehouse.name", read_only=True)
    status = serializers.SerializerMethodField()

    class Meta:
        model = Stock
        fields = ("id", "product", "product_name", "sku", "warehouse", "warehouse_name", "quantity", "min_stock", "status", "updated_at")

    def get_status(self, obj):
        min_stock = obj.product.min_stock or 5
        if obj.quantity <= 0:
            return "out"
        if obj.quantity < min_stock:
            return "low"
        if obj.quantity < min_stock * 2:
            return "warning"
        return "ok"


class StockMovementSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    warehouse_name = serializers.CharField(source="warehouse.name", read_only=True)
    reason_display = serializers.CharField(source="get_reason_display", read_only=True)
    user_name = serializers.CharField(source="user.get_full_name", read_only=True, default=None)

    class Meta:
        model = StockMovement
        fields = (
            "id", "created_at", "product", "product_name", "warehouse", "warehouse_name",
            "qty_delta", "balance_after", "unit_cost", "reason", "reason_display",
            "doc_type", "doc_id", "user_name", "note",
        )


class ReceiptItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    amount = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)

    class Meta:
        model = ReceiptItem
        fields = ("id", "product", "product_name", "quantity", "purchase_price", "sale_price", "amount")


class ReceiptSerializer(serializers.ModelSerializer):
    items = ReceiptItemSerializer(many=True)
    warehouse_name = serializers.CharField(source="warehouse.name", read_only=True)
    supplier_name = serializers.CharField(source="supplier.name", read_only=True, default=None)
    total_amount = serializers.SerializerMethodField()
    created_by_name = serializers.CharField(source="created_by.get_full_name", read_only=True, default=None)

    class Meta:
        model = Receipt
        fields = (
            "id", "number", "date", "warehouse", "warehouse_name", "supplier", "supplier_name",
            "status", "comment", "items", "total_amount", "created_by_name", "created_at", "posted_at",
        )
        read_only_fields = ("number", "status")

    def get_total_amount(self, obj):
        return obj.total_amount

    def create(self, validated_data):
        items_data = validated_data.pop("items")
        request = self.context["request"]
        receipt = Receipt.objects.create(created_by=request.user, **validated_data)
        for item in items_data:
            ReceiptItem.objects.create(receipt=receipt, **item)
        return receipt

    def update(self, instance, validated_data):
        if instance.status != Receipt.Status.DRAFT:
            raise serializers.ValidationError("Нельзя редактировать проведённый документ")
        items_data = validated_data.pop("items", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if items_data is not None:
            instance.items.all().delete()
            for item in items_data:
                ReceiptItem.objects.create(receipt=instance, **item)
        return instance


class TransferItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)

    class Meta:
        model = TransferItem
        fields = ("id", "product", "product_name", "quantity")


class TransferSerializer(serializers.ModelSerializer):
    items = TransferItemSerializer(many=True)
    from_warehouse_name = serializers.CharField(source="from_warehouse.name", read_only=True)
    to_warehouse_name = serializers.CharField(source="to_warehouse.name", read_only=True)

    class Meta:
        model = Transfer
        fields = (
            "id", "number", "date", "from_warehouse", "from_warehouse_name",
            "to_warehouse", "to_warehouse_name", "status", "comment", "items",
            "created_at", "posted_at",
        )
        read_only_fields = ("number", "status")

    def create(self, validated_data):
        items_data = validated_data.pop("items")
        request = self.context["request"]
        transfer = Transfer.objects.create(created_by=request.user, **validated_data)
        for item in items_data:
            TransferItem.objects.create(transfer=transfer, **item)
        return transfer

    def update(self, instance, validated_data):
        if instance.status != Transfer.Status.DRAFT:
            raise serializers.ValidationError("Нельзя редактировать проведённый документ")
        items_data = validated_data.pop("items", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if items_data is not None:
            instance.items.all().delete()
            for item in items_data:
                TransferItem.objects.create(transfer=instance, **item)
        return instance


class InventoryItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    diff = serializers.DecimalField(max_digits=12, decimal_places=3, read_only=True)

    class Meta:
        model = InventoryItem
        fields = ("id", "product", "product_name", "qty_system", "qty_fact", "diff")


class InventorySerializer(serializers.ModelSerializer):
    items = InventoryItemSerializer(many=True)
    warehouse_name = serializers.CharField(source="warehouse.name", read_only=True)

    class Meta:
        model = Inventory
        fields = ("id", "number", "date", "warehouse", "warehouse_name", "status", "items", "created_at", "posted_at")
        read_only_fields = ("number", "status")

    def create(self, validated_data):
        items_data = validated_data.pop("items")
        request = self.context["request"]
        inv = Inventory.objects.create(created_by=request.user, **validated_data)
        for item in items_data:
            InventoryItem.objects.create(inventory=inv, **item)
        return inv


class WriteOffItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)

    class Meta:
        model = WriteOffItem
        fields = ("id", "product", "product_name", "quantity")


class WriteOffSerializer(serializers.ModelSerializer):
    items = WriteOffItemSerializer(many=True)
    warehouse_name = serializers.CharField(source="warehouse.name", read_only=True)

    class Meta:
        model = WriteOff
        fields = ("id", "number", "date", "warehouse", "warehouse_name", "reason_text", "status", "items", "created_at", "posted_at")
        read_only_fields = ("number", "status")

    def create(self, validated_data):
        items_data = validated_data.pop("items")
        request = self.context["request"]
        wo = WriteOff.objects.create(created_by=request.user, **validated_data)
        for item in items_data:
            WriteOffItem.objects.create(writeoff=wo, **item)
        return wo

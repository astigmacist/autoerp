from django.contrib import admin

from .models import (
    Inventory, InventoryItem, Receipt, ReceiptItem, Stock, StockMovement,
    Transfer, TransferItem, Warehouse, WriteOff, WriteOffItem,
)


@admin.register(Warehouse)
class WarehouseAdmin(admin.ModelAdmin):
    list_display = ("name", "code", "kind", "is_sellable", "is_active")


@admin.register(Stock)
class StockAdmin(admin.ModelAdmin):
    list_display = ("product", "warehouse", "quantity", "updated_at")
    list_filter = ("warehouse",)
    search_fields = ("product__name", "product__sku")


@admin.register(StockMovement)
class StockMovementAdmin(admin.ModelAdmin):
    list_display = ("created_at", "product", "warehouse", "qty_delta", "balance_after", "reason", "user")
    list_filter = ("reason", "warehouse")
    search_fields = ("product__name", "product__sku", "doc_id")
    readonly_fields = [f.name for f in StockMovement._meta.fields]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


class ReceiptItemInline(admin.TabularInline):
    model = ReceiptItem
    extra = 1


@admin.register(Receipt)
class ReceiptAdmin(admin.ModelAdmin):
    list_display = ("number", "date", "warehouse", "supplier", "status", "created_by")
    list_filter = ("status", "warehouse")
    inlines = [ReceiptItemInline]
    readonly_fields = ("number",)


class TransferItemInline(admin.TabularInline):
    model = TransferItem
    extra = 1


@admin.register(Transfer)
class TransferAdmin(admin.ModelAdmin):
    list_display = ("number", "date", "from_warehouse", "to_warehouse", "status")
    list_filter = ("status",)
    inlines = [TransferItemInline]
    readonly_fields = ("number",)


class InventoryItemInline(admin.TabularInline):
    model = InventoryItem
    extra = 1


@admin.register(Inventory)
class InventoryAdmin(admin.ModelAdmin):
    list_display = ("number", "date", "warehouse", "status")
    inlines = [InventoryItemInline]
    readonly_fields = ("number",)


class WriteOffItemInline(admin.TabularInline):
    model = WriteOffItem
    extra = 1


@admin.register(WriteOff)
class WriteOffAdmin(admin.ModelAdmin):
    list_display = ("number", "date", "warehouse", "status", "reason_text")
    inlines = [WriteOffItemInline]
    readonly_fields = ("number",)

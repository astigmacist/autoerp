from django.contrib import admin

from .models import Payment, Return, ReturnItem, Sale, SaleItem, Shift


class SaleItemInline(admin.TabularInline):
    model = SaleItem
    extra = 0
    readonly_fields = ("product", "quantity", "base_price", "final_price", "unit_cost", "returned_qty")


class PaymentInline(admin.TabularInline):
    model = Payment
    extra = 0


@admin.register(Sale)
class SaleAdmin(admin.ModelAdmin):
    list_display = ("number", "created_at", "seller", "warehouse", "total", "discount_total", "status", "needs_approval")
    list_filter = ("status", "needs_approval", "warehouse")
    search_fields = ("number", "customer_name", "customer_phone")
    inlines = [SaleItemInline, PaymentInline]
    readonly_fields = ("number", "subtotal", "discount_total", "total", "cost_total", "profit")


@admin.register(Shift)
class ShiftAdmin(admin.ModelAdmin):
    list_display = ("id", "opened_at", "closed_at", "opened_by", "warehouse", "status", "cash_diff")
    list_filter = ("status", "warehouse")


class ReturnItemInline(admin.TabularInline):
    model = ReturnItem
    extra = 0


@admin.register(Return)
class ReturnAdmin(admin.ModelAdmin):
    list_display = ("number", "created_at", "sale", "total_amount", "created_by")
    inlines = [ReturnItemInline]
    readonly_fields = ("number",)

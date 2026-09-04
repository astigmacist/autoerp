from django.contrib import admin

from .models import Brand, Category, Product, Supplier


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "parent", "is_active")
    search_fields = ("name",)


@admin.register(Brand)
class BrandAdmin(admin.ModelAdmin):
    list_display = ("name", "country", "is_active")
    search_fields = ("name",)


@admin.register(Supplier)
class SupplierAdmin(admin.ModelAdmin):
    list_display = ("name", "phone", "is_active")
    search_fields = ("name",)


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ("name", "sku", "oem_code", "brand", "category", "sale_price", "purchase_price", "min_stock", "is_active")
    search_fields = ("name", "sku", "oem_code", "barcode")
    list_filter = ("brand", "category", "is_active")
    autocomplete_fields = ("brand", "category")

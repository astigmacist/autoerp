from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ("username", "get_full_name", "role", "phone", "is_active_employee", "is_active")
    list_filter = ("role", "is_active_employee", "is_active")
    fieldsets = BaseUserAdmin.fieldsets + (
        ("AutoZap", {"fields": ("role", "phone", "pin_code", "is_active_employee")}),
    )

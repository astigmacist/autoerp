from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    class Role(models.TextChoices):
        OWNER = "owner", "Владелец"
        STOCK = "stock", "Менеджер склада"
        SELLER = "seller", "Продавец"

    role = models.CharField(max_length=20, choices=Role.choices, default=Role.SELLER)
    phone = models.CharField(max_length=32, blank=True)
    pin_code = models.CharField(
        max_length=6, blank=True,
        help_text="Короткий PIN для быстрого входа / подтверждения скидок",
    )
    is_active_employee = models.BooleanField(default=True)

    def __str__(self):
        return self.get_full_name() or self.username

    @property
    def can_see_cost(self):
        return self.role in (self.Role.OWNER, self.Role.STOCK)

    @property
    def discount_limit_percent(self):
        from apps.core.models import AppSettings

        if self.role == self.Role.OWNER:
            return None  # без ограничений
        return AppSettings.load().seller_discount_limit_percent

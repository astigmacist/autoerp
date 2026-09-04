import uuid

from django.db import models


class TimeStampedModel(models.Model):
    """Abstract base: UUID pk + created/updated timestamps."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class AppSettings(models.Model):
    """Singleton with store-wide configuration."""

    store_name = models.CharField(max_length=200, default="AutoZap")
    currency = models.CharField(max_length=8, default="KZT")
    default_min_stock = models.PositiveIntegerField(default=5)
    seller_discount_limit_percent = models.DecimalField(
        max_digits=5, decimal_places=2, default=10,
        help_text="Максимальный % скидки, который продавец может дать без подтверждения владельца",
    )
    return_days_limit = models.PositiveIntegerField(default=14)
    shifts_enabled = models.BooleanField(default=False)

    class Meta:
        verbose_name = "Настройки"
        verbose_name_plural = "Настройки"

    def __str__(self):
        return self.store_name

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    @classmethod
    def load(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj


class AuditLog(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        "accounts.User", null=True, blank=True, on_delete=models.SET_NULL, related_name="audit_logs"
    )
    action = models.CharField(max_length=50)
    object_type = models.CharField(max_length=100)
    object_id = models.CharField(max_length=64, blank=True)
    changes = models.JSONField(default=dict, blank=True)
    ip = models.GenericIPAddressField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        verbose_name = "Журнал аудита"
        verbose_name_plural = "Журнал аудита"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.created_at:%Y-%m-%d %H:%M} {self.user} {self.action} {self.object_type}"

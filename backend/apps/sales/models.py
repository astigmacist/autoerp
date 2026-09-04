import uuid

from django.db import models

from apps.core.models import TimeStampedModel
from apps.inventory.models import next_doc_number


class Shift(models.Model):
    class Status(models.TextChoices):
        OPEN = "open", "Открыта"
        CLOSED = "closed", "Закрыта"

    opened_at = models.DateTimeField(auto_now_add=True)
    closed_at = models.DateTimeField(null=True, blank=True)
    opened_by = models.ForeignKey("accounts.User", on_delete=models.PROTECT, related_name="shifts_opened")
    closed_by = models.ForeignKey("accounts.User", null=True, on_delete=models.SET_NULL, related_name="shifts_closed")
    warehouse = models.ForeignKey("inventory.Warehouse", on_delete=models.PROTECT, related_name="shifts")
    cash_start = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    cash_end_fact = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    cash_end_system = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.OPEN)

    class Meta:
        verbose_name = "Смена"
        verbose_name_plural = "Смены"
        ordering = ["-opened_at"]

    def __str__(self):
        return f"Смена от {self.opened_at:%Y-%m-%d %H:%M}"

    @property
    def cash_diff(self):
        if self.cash_end_fact is None or self.cash_end_system is None:
            return None
        return self.cash_end_fact - self.cash_end_system


class Sale(TimeStampedModel):
    class Status(models.TextChoices):
        COMPLETED = "completed", "Завершена"
        RETURNED = "returned", "Возвращена"
        PARTIALLY_RETURNED = "partially_returned", "Частично возвращена"
        CANCELLED = "cancelled", "Отменена"

    number = models.CharField(max_length=32, unique=True, blank=True)
    warehouse = models.ForeignKey("inventory.Warehouse", on_delete=models.PROTECT, related_name="sales")
    seller = models.ForeignKey("accounts.User", on_delete=models.PROTECT, related_name="sales")
    shift = models.ForeignKey(Shift, null=True, blank=True, on_delete=models.SET_NULL, related_name="sales")

    customer_name = models.CharField(max_length=150, blank=True)
    customer_phone = models.CharField(max_length=32, blank=True)

    subtotal = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    discount_total = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    cost_total = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    profit = models.DecimalField(max_digits=14, decimal_places=2, default=0)

    status = models.CharField(max_length=20, choices=Status.choices, default=Status.COMPLETED)
    comment = models.TextField(blank=True)
    needs_approval = models.BooleanField(default=False)
    approved_by = models.ForeignKey(
        "accounts.User", null=True, blank=True, on_delete=models.SET_NULL, related_name="sales_approved"
    )
    idempotency_key = models.UUIDField(null=True, blank=True, unique=True)

    class Meta:
        verbose_name = "Продажа"
        verbose_name_plural = "Продажи"
        ordering = ["-created_at"]

    def __str__(self):
        return self.number or f"Продажа {self.id}"

    def save(self, *args, **kwargs):
        if not self.number:
            self.number = next_doc_number(Sale, "S")
        super().save(*args, **kwargs)


class SaleItem(models.Model):
    sale = models.ForeignKey(Sale, on_delete=models.CASCADE, related_name="items")
    product = models.ForeignKey("catalog.Product", on_delete=models.PROTECT, related_name="sale_items")
    quantity = models.DecimalField(max_digits=12, decimal_places=3)
    base_price = models.DecimalField(max_digits=12, decimal_places=2)
    final_price = models.DecimalField(max_digits=12, decimal_places=2)
    unit_cost = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    returned_qty = models.DecimalField(max_digits=12, decimal_places=3, default=0)

    class Meta:
        verbose_name = "Позиция продажи"
        verbose_name_plural = "Позиции продажи"

    @property
    def amount(self):
        return self.quantity * self.final_price

    @property
    def discount_amount(self):
        return (self.base_price - self.final_price) * self.quantity

    @property
    def discount_percent(self):
        if not self.base_price:
            return 0
        return (self.base_price - self.final_price) / self.base_price * 100


class Payment(models.Model):
    class Method(models.TextChoices):
        CASH = "cash", "Наличные"
        KASPI_QR = "kaspi_qr", "Kaspi QR"
        CARD = "card", "Карта"
        TRANSFER = "transfer", "Перевод"

    sale = models.ForeignKey(Sale, on_delete=models.CASCADE, related_name="payments")
    method = models.CharField(max_length=20, choices=Method.choices)
    amount = models.DecimalField(max_digits=14, decimal_places=2)

    class Meta:
        verbose_name = "Оплата"
        verbose_name_plural = "Оплаты"


class Return(TimeStampedModel):
    number = models.CharField(max_length=32, unique=True, blank=True)
    sale = models.ForeignKey(Sale, on_delete=models.PROTECT, related_name="returns")
    created_by = models.ForeignKey("accounts.User", on_delete=models.PROTECT, related_name="+")
    reason = models.CharField(max_length=255, blank=True)
    total_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    refund_method = models.CharField(max_length=20, choices=Payment.Method.choices, default=Payment.Method.CASH)

    class Meta:
        verbose_name = "Возврат"
        verbose_name_plural = "Возвраты"
        ordering = ["-created_at"]

    def save(self, *args, **kwargs):
        if not self.number:
            self.number = next_doc_number(Return, "RET")
        super().save(*args, **kwargs)


class ReturnItem(models.Model):
    ret = models.ForeignKey(Return, on_delete=models.CASCADE, related_name="items")
    sale_item = models.ForeignKey(SaleItem, on_delete=models.PROTECT, related_name="return_items")
    quantity = models.DecimalField(max_digits=12, decimal_places=3)
    amount = models.DecimalField(max_digits=14, decimal_places=2)

    class Meta:
        verbose_name = "Позиция возврата"
        verbose_name_plural = "Позиции возврата"

import uuid

from django.db import models
from django.db.models import Q

from apps.core.models import TimeStampedModel


class Warehouse(TimeStampedModel):
    class Kind(models.TextChoices):
        MAIN = "main", "Основной склад"
        SHOP = "shop", "Магазин"

    name = models.CharField(max_length=100)
    code = models.CharField(max_length=20, unique=True)
    kind = models.CharField(max_length=10, choices=Kind.choices, default=Kind.MAIN)
    is_sellable = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name = "Склад"
        verbose_name_plural = "Склады"

    def __str__(self):
        return self.name


class Stock(models.Model):
    product = models.ForeignKey("catalog.Product", on_delete=models.CASCADE, related_name="stocks")
    warehouse = models.ForeignKey(Warehouse, on_delete=models.CASCADE, related_name="stocks")
    quantity = models.DecimalField(max_digits=12, decimal_places=3, default=0)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Остаток"
        verbose_name_plural = "Остатки"
        constraints = [
            models.UniqueConstraint(fields=["product", "warehouse"], name="uniq_product_warehouse"),
            models.CheckConstraint(check=Q(quantity__gte=0), name="stock_quantity_gte_0"),
        ]

    def __str__(self):
        return f"{self.product} @ {self.warehouse}: {self.quantity}"


class StockMovement(models.Model):
    class Reason(models.TextChoices):
        RECEIPT = "receipt", "Приход"
        TRANSFER_OUT = "transfer_out", "Перемещение (списание)"
        TRANSFER_IN = "transfer_in", "Перемещение (зачисление)"
        SALE = "sale", "Продажа"
        RETURN = "return", "Возврат"
        WRITEOFF = "writeoff", "Списание"
        INVENTORY = "inventory", "Инвентаризация"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    product = models.ForeignKey("catalog.Product", on_delete=models.PROTECT, related_name="movements")
    warehouse = models.ForeignKey(Warehouse, on_delete=models.PROTECT, related_name="movements")
    qty_delta = models.DecimalField(max_digits=12, decimal_places=3)
    balance_after = models.DecimalField(max_digits=12, decimal_places=3)
    unit_cost = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    reason = models.CharField(max_length=20, choices=Reason.choices)
    doc_type = models.CharField(max_length=50, blank=True)
    doc_id = models.CharField(max_length=64, blank=True)
    user = models.ForeignKey("accounts.User", null=True, on_delete=models.SET_NULL, related_name="movements")
    note = models.CharField(max_length=255, blank=True)

    class Meta:
        verbose_name = "Движение товара"
        verbose_name_plural = "Движения товара"
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["product", "warehouse", "created_at"])]

    def __str__(self):
        return f"{self.created_at:%Y-%m-%d %H:%M} {self.product} {self.qty_delta:+} ({self.reason})"


def next_doc_number(model, prefix):
    from django.utils import timezone

    year = timezone.now().year
    count = model.objects.filter(number__startswith=f"{prefix}-{year}-").count() + 1
    return f"{prefix}-{year}-{count:05d}"


class Receipt(TimeStampedModel):
    class Status(models.TextChoices):
        DRAFT = "draft", "Черновик"
        POSTED = "posted", "Проведён"
        CANCELLED = "cancelled", "Отменён"

    number = models.CharField(max_length=32, unique=True, blank=True)
    date = models.DateField()
    warehouse = models.ForeignKey(Warehouse, on_delete=models.PROTECT, related_name="receipts")
    supplier = models.ForeignKey("catalog.Supplier", null=True, blank=True, on_delete=models.SET_NULL)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.DRAFT)
    comment = models.TextField(blank=True)
    created_by = models.ForeignKey("accounts.User", null=True, on_delete=models.SET_NULL, related_name="+")
    posted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "Приход"
        verbose_name_plural = "Приходы"
        ordering = ["-date", "-created_at"]

    def __str__(self):
        return self.number or f"Приход {self.id}"

    def save(self, *args, **kwargs):
        if not self.number:
            self.number = next_doc_number(Receipt, "PR")
        super().save(*args, **kwargs)

    @property
    def total_amount(self):
        return sum((i.amount for i in self.items.all()), 0)


class ReceiptItem(models.Model):
    receipt = models.ForeignKey(Receipt, on_delete=models.CASCADE, related_name="items")
    product = models.ForeignKey("catalog.Product", on_delete=models.PROTECT)
    quantity = models.DecimalField(max_digits=12, decimal_places=3)
    purchase_price = models.DecimalField(max_digits=12, decimal_places=2)
    sale_price = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)

    class Meta:
        verbose_name = "Позиция прихода"
        verbose_name_plural = "Позиции прихода"

    @property
    def amount(self):
        return self.quantity * self.purchase_price


class Transfer(TimeStampedModel):
    class Status(models.TextChoices):
        DRAFT = "draft", "Черновик"
        POSTED = "posted", "Проведён"
        CANCELLED = "cancelled", "Отменён"

    number = models.CharField(max_length=32, unique=True, blank=True)
    date = models.DateField()
    from_warehouse = models.ForeignKey(Warehouse, on_delete=models.PROTECT, related_name="transfers_out")
    to_warehouse = models.ForeignKey(Warehouse, on_delete=models.PROTECT, related_name="transfers_in")
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.DRAFT)
    comment = models.TextField(blank=True)
    created_by = models.ForeignKey("accounts.User", null=True, on_delete=models.SET_NULL, related_name="+")
    posted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "Перемещение"
        verbose_name_plural = "Перемещения"
        ordering = ["-date", "-created_at"]

    def __str__(self):
        return self.number or f"Перемещение {self.id}"

    def save(self, *args, **kwargs):
        if not self.number:
            self.number = next_doc_number(Transfer, "TR")
        super().save(*args, **kwargs)


class TransferItem(models.Model):
    transfer = models.ForeignKey(Transfer, on_delete=models.CASCADE, related_name="items")
    product = models.ForeignKey("catalog.Product", on_delete=models.PROTECT)
    quantity = models.DecimalField(max_digits=12, decimal_places=3)

    class Meta:
        verbose_name = "Позиция перемещения"
        verbose_name_plural = "Позиции перемещения"


class Inventory(TimeStampedModel):
    class Status(models.TextChoices):
        DRAFT = "draft", "Черновик"
        POSTED = "posted", "Проведена"

    number = models.CharField(max_length=32, unique=True, blank=True)
    date = models.DateField()
    warehouse = models.ForeignKey(Warehouse, on_delete=models.PROTECT, related_name="inventories")
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.DRAFT)
    created_by = models.ForeignKey("accounts.User", null=True, on_delete=models.SET_NULL, related_name="+")
    posted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "Инвентаризация"
        verbose_name_plural = "Инвентаризации"
        ordering = ["-date"]

    def __str__(self):
        return self.number or f"Инвентаризация {self.id}"

    def save(self, *args, **kwargs):
        if not self.number:
            self.number = next_doc_number(Inventory, "INV")
        super().save(*args, **kwargs)


class InventoryItem(models.Model):
    inventory = models.ForeignKey(Inventory, on_delete=models.CASCADE, related_name="items")
    product = models.ForeignKey("catalog.Product", on_delete=models.PROTECT)
    qty_system = models.DecimalField(max_digits=12, decimal_places=3)
    qty_fact = models.DecimalField(max_digits=12, decimal_places=3)

    class Meta:
        verbose_name = "Позиция инвентаризации"
        verbose_name_plural = "Позиции инвентаризации"

    @property
    def diff(self):
        return self.qty_fact - self.qty_system


class WriteOff(TimeStampedModel):
    class Status(models.TextChoices):
        DRAFT = "draft", "Черновик"
        POSTED = "posted", "Проведено"

    number = models.CharField(max_length=32, unique=True, blank=True)
    date = models.DateField()
    warehouse = models.ForeignKey(Warehouse, on_delete=models.PROTECT, related_name="writeoffs")
    reason_text = models.CharField(max_length=255, blank=True)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.DRAFT)
    created_by = models.ForeignKey("accounts.User", null=True, on_delete=models.SET_NULL, related_name="+")
    posted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "Списание"
        verbose_name_plural = "Списания"
        ordering = ["-date"]

    def __str__(self):
        return self.number or f"Списание {self.id}"

    def save(self, *args, **kwargs):
        if not self.number:
            self.number = next_doc_number(WriteOff, "WO")
        super().save(*args, **kwargs)


class WriteOffItem(models.Model):
    writeoff = models.ForeignKey(WriteOff, on_delete=models.CASCADE, related_name="items")
    product = models.ForeignKey("catalog.Product", on_delete=models.PROTECT)
    quantity = models.DecimalField(max_digits=12, decimal_places=3)

    class Meta:
        verbose_name = "Позиция списания"
        verbose_name_plural = "Позиции списания"

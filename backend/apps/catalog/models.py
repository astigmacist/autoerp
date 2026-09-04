import re

from django.core.validators import MinValueValidator
from django.db import models
from simple_history.models import HistoricalRecords

from apps.core.models import AppSettings, TimeStampedModel


class Category(TimeStampedModel):
    name = models.CharField(max_length=150)
    parent = models.ForeignKey("self", null=True, blank=True, on_delete=models.SET_NULL, related_name="children")
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name = "Категория"
        verbose_name_plural = "Категории"
        ordering = ["name"]

    def __str__(self):
        return self.name


class Brand(TimeStampedModel):
    name = models.CharField(max_length=150, unique=True)
    country = models.CharField(max_length=100, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name = "Бренд"
        verbose_name_plural = "Бренды"
        ordering = ["name"]

    def __str__(self):
        return self.name


class Supplier(TimeStampedModel):
    name = models.CharField(max_length=200)
    phone = models.CharField(max_length=32, blank=True)
    note = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name = "Поставщик"
        verbose_name_plural = "Поставщики"
        ordering = ["name"]

    def __str__(self):
        return self.name


def normalize_code(value: str) -> str:
    """Lowercase, strip everything but alphanumerics - used for tolerant search."""
    return re.sub(r"[^a-z0-9а-я]", "", (value or "").lower())


class Product(TimeStampedModel):
    class Unit(models.TextChoices):
        PIECE = "pcs", "шт"
        SET = "set", "компл"
        LITER = "l", "л"
        KG = "kg", "кг"

    name = models.CharField(max_length=255)
    sku = models.CharField(max_length=64, unique=True)
    oem_code = models.CharField(max_length=64, blank=True, db_index=True)
    barcode = models.CharField(max_length=64, blank=True, null=True, unique=True)
    search_key = models.CharField(max_length=400, blank=True, db_index=True)

    brand = models.ForeignKey(Brand, null=True, blank=True, on_delete=models.SET_NULL, related_name="products")
    category = models.ForeignKey(Category, null=True, blank=True, on_delete=models.SET_NULL, related_name="products")
    unit = models.CharField(max_length=10, choices=Unit.choices, default=Unit.PIECE)

    purchase_price = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    avg_cost = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    sale_price = models.DecimalField(max_digits=12, decimal_places=2, default=0, validators=[MinValueValidator(0)])
    min_price = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    min_stock = models.PositiveIntegerField(default=5)

    applicability = models.TextField(blank=True, help_text="Применимость к авто, напр. Toyota Camry 40/50")
    analogs = models.ManyToManyField("self", blank=True, symmetrical=True)
    location = models.CharField(max_length=100, blank=True)
    note = models.TextField(blank=True)

    is_active = models.BooleanField(default=True)
    history = HistoricalRecords()

    class Meta:
        verbose_name = "Товар"
        verbose_name_plural = "Товары"
        ordering = ["name"]
        indexes = [
            models.Index(fields=["sku"]),
            models.Index(fields=["oem_code"]),
            models.Index(fields=["barcode"]),
        ]

    def __str__(self):
        return f"{self.name} ({self.sku})"

    def save(self, *args, **kwargs):
        if not self.min_stock:
            self.min_stock = AppSettings.load().default_min_stock
        parts = [self.name, self.sku, self.oem_code, self.barcode or ""]
        self.search_key = " ".join(normalize_code(p) for p in parts if p)
        super().save(*args, **kwargs)

    @property
    def effective_min_price(self):
        return self.min_price if self.min_price is not None else self.avg_cost

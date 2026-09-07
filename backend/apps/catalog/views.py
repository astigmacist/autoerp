from decimal import Decimal

from django.db.models import Case, DecimalField, IntegerField, OuterRef, Q, Subquery, Value, When
from django.db.models.functions import Coalesce
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import viewsets, filters
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.core.permissions import IsOwnerOrStock
from apps.inventory.models import Stock, Warehouse
from .models import Brand, Category, Product, Supplier, normalize_code
from .serializers import (
    BrandSerializer, CategorySerializer, ProductSearchResultSerializer,
    ProductSerializer, SupplierSerializer,
)


class CategoryViewSet(viewsets.ModelViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [IsOwnerOrStock]


class BrandViewSet(viewsets.ModelViewSet):
    queryset = Brand.objects.all()
    serializer_class = BrandSerializer
    permission_classes = [IsOwnerOrStock]


class SupplierViewSet(viewsets.ModelViewSet):
    queryset = Supplier.objects.all()
    serializer_class = SupplierSerializer
    permission_classes = [IsOwnerOrStock]


class ProductViewSet(viewsets.ModelViewSet):
    serializer_class = ProductSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ["category", "brand", "is_active"]
    ordering_fields = ["name", "sale_price", "created_at"]

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [IsOwnerOrStock()]
        return [IsAuthenticated()]

    def get_queryset(self):
        qs = Product.objects.select_related("brand", "category").prefetch_related("stocks__warehouse")
        search = self.request.query_params.get("search")
        if search:
            key = normalize_code(search)
            qs = qs.filter(
                Q(search_key__icontains=key) | Q(name__icontains=search) | Q(oem_code__icontains=search)
            )
        low_stock = self.request.query_params.get("low_stock")
        if low_stock == "true":
            shop = Warehouse.objects.filter(is_sellable=True).first()
            if shop:
                low_ids = [
                    s.product_id for s in Stock.objects.filter(warehouse=shop)
                    if s.quantity < s.product.min_stock
                ]
                qs = qs.filter(id__in=low_ids)
        return qs.order_by("name")

    @action(detail=False, methods=["get"])
    def search(self, request):
        """Товары для кассы: поиск по названию / коду / OEM / штрихкоду.

        Пустой запрос — не пустой ответ: касса показывает витрину сразу, чтобы
        продавцу не приходилось вспоминать название и печатать его вслепую.
        Первыми идут позиции, которые действительно есть в зале.
        """
        q = request.query_params.get("q", "").strip()
        shop = Warehouse.objects.filter(is_sellable=True).first()
        main = Warehouse.objects.filter(kind=Warehouse.Kind.MAIN).first()

        if len(q) == 1:
            return Response([])  # одна буква — это ещё не запрос

        if q:
            key = normalize_code(q)
            qs = (
                Product.objects.filter(is_active=True)
                .filter(Q(search_key__icontains=key) | Q(barcode=q))
                .select_related("brand")[:20]
            )
        else:
            qs = Product.objects.filter(is_active=True).select_related("brand")
            if shop:
                shop_qty = Stock.objects.filter(warehouse=shop, product=OuterRef("pk")).values("quantity")[:1]
                qs = qs.annotate(
                    _shop_qty=Coalesce(
                        Subquery(shop_qty, output_field=DecimalField(max_digits=12, decimal_places=3)),
                        Value(Decimal("0")),
                    ),
                ).annotate(
                    _sold_out=Case(
                        When(_shop_qty__gt=0, then=Value(0)),
                        default=Value(1),
                        output_field=IntegerField(),
                    ),
                ).order_by("_sold_out", "name")
            else:
                qs = qs.order_by("name")
            qs = qs[:60]

        ids = [p.id for p in qs]
        shop_map = {s.product_id: s.quantity for s in Stock.objects.filter(warehouse=shop, product_id__in=ids)} if shop else {}
        main_map = {s.product_id: s.quantity for s in Stock.objects.filter(warehouse=main, product_id__in=ids)} if main else {}
        serializer = ProductSearchResultSerializer(
            qs, many=True, context={"shop_qty_map": shop_map, "main_qty_map": main_map}
        )
        return Response(serializer.data)

    @action(detail=True, methods=["get"])
    def movements(self, request, pk=None):
        from apps.inventory.models import StockMovement

        product = self.get_object()
        moves = StockMovement.objects.filter(product=product).select_related("warehouse", "user")[:200]
        data = [
            {
                "created_at": m.created_at,
                "warehouse": m.warehouse.name,
                "qty_delta": m.qty_delta,
                "balance_after": m.balance_after,
                "reason": m.get_reason_display(),
                "user": str(m.user) if m.user else None,
                "note": m.note,
            }
            for m in moves
        ]
        return Response(data)

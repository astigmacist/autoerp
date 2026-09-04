from decimal import Decimal

from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.catalog.models import Product
from apps.core.exceptions import BusinessError
from apps.core.permissions import CanSell
from apps.inventory.models import Warehouse
from . import services
from .models import Sale, SaleItem, Shift
from .serializers import (
    ReturnCreateSerializer, ReturnSerializer, SaleCreateSerializer,
    SaleSerializer, ShiftSerializer,
)


class SaleViewSet(viewsets.ReadOnlyModelViewSet):
    """Sales are created via SaleCreateView (atomic business flow), not the generic viewset."""

    serializer_class = SaleSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["status", "seller", "warehouse"]

    def get_permissions(self):
        if self.action == "create_return":
            return [CanSell()]
        return [IsAuthenticated()]

    def get_queryset(self):
        qs = Sale.objects.select_related("seller", "warehouse").prefetch_related("items__product", "payments")
        date_from = self.request.query_params.get("date_from")
        date_to = self.request.query_params.get("date_to")
        if date_from:
            qs = qs.filter(created_at__date__gte=date_from)
        if date_to:
            qs = qs.filter(created_at__date__lte=date_to)
        return qs

    @action(detail=True, methods=["post"])
    def create_return(self, request, pk=None):
        sale = self.get_object()
        serializer = ReturnCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        items_data = []
        for row in data["items"]:
            sale_item = sale.items.filter(id=row["sale_item_id"]).first()
            if not sale_item:
                raise BusinessError("Позиция чека не найдена", code="sale_item_not_found")
            items_data.append({"sale_item": sale_item, "quantity": row["quantity"]})

        ret = services.create_return(
            sale=sale, items_data=items_data, user=request.user,
            reason=data.get("reason", ""), refund_method=data.get("refund_method"),
        )
        return Response(ReturnSerializer(ret).data, status=201)


class SaleCreateView(APIView):
    """POST /api/v1/sales/create/  — the POS checkout endpoint."""

    permission_classes = [CanSell]

    def post(self, request):
        serializer = SaleCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        warehouse = Warehouse.objects.filter(id=data["warehouse_id"]).first()
        if not warehouse:
            raise BusinessError("Склад не найден", code="warehouse_not_found")

        product_ids = [row["product_id"] for row in data["items"]]
        products = {p.id: p for p in Product.objects.filter(id__in=product_ids)}
        items_data = []
        for row in data["items"]:
            product = products.get(row["product_id"])
            if not product:
                raise BusinessError("Товар не найден", code="product_not_found")
            items_data.append({
                "product": product,
                "quantity": row["quantity"],
                "final_price": row["final_price"],
            })

        open_shift = Shift.objects.filter(status=Shift.Status.OPEN, warehouse=warehouse).order_by("-opened_at").first()

        sale, created = services.create_sale(
            warehouse=warehouse,
            seller=request.user,
            items_data=items_data,
            payments_data=data["payments"],
            idempotency_key=data.get("idempotency_key"),
            customer_name=data.get("customer_name", ""),
            customer_phone=data.get("customer_phone", ""),
            comment=data.get("comment", ""),
            shift=open_shift,
        )
        status_code = 201 if created else 200
        return Response(SaleSerializer(sale, context={"request": request}).data, status=status_code)


class ShiftViewSet(viewsets.ModelViewSet):
    serializer_class = ShiftSerializer
    permission_classes = [CanSell]

    def get_queryset(self):
        return Shift.objects.select_related("opened_by", "closed_by", "warehouse")

    def perform_create(self, serializer):
        serializer.save(opened_by=self.request.user, status=Shift.Status.OPEN)

    @action(detail=True, methods=["post"])
    def close(self, request, pk=None):
        shift = self.get_object()
        if shift.status != Shift.Status.OPEN:
            raise BusinessError("Смена уже закрыта", code="shift_closed")
        cash_end_fact = Decimal(str(request.data.get("cash_end_fact", 0)))

        cash_sales = shift.sales.prefetch_related("payments")
        cash_total = Decimal("0")
        for s in cash_sales:
            for p in s.payments.filter(method="cash"):
                cash_total += p.amount

        shift.cash_end_system = shift.cash_start + cash_total
        shift.cash_end_fact = cash_end_fact
        shift.closed_by = request.user
        shift.closed_at = timezone.now()
        shift.status = Shift.Status.CLOSED
        shift.save()
        return Response(ShiftSerializer(shift).data)

    @action(detail=False, methods=["get"])
    def current(self, request):
        shift = Shift.objects.filter(status=Shift.Status.OPEN).order_by("-opened_at").first()
        if not shift:
            return Response(None)
        return Response(ShiftSerializer(shift).data)

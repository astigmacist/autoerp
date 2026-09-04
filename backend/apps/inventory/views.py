from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.core.permissions import IsOwnerOrStock
from . import services
from .models import Inventory, Receipt, Stock, StockMovement, Transfer, Warehouse, WriteOff
from .serializers import (
    InventorySerializer, ReceiptSerializer, StockMovementSerializer,
    StockSerializer, TransferSerializer, WarehouseSerializer, WriteOffSerializer,
)


class WarehouseViewSet(viewsets.ModelViewSet):
    queryset = Warehouse.objects.all()
    serializer_class = WarehouseSerializer
    permission_classes = [IsAuthenticated]


class StockViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = StockSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["warehouse"]

    def get_queryset(self):
        qs = Stock.objects.select_related("product", "warehouse").filter(product__is_active=True)
        low_only = self.request.query_params.get("low_stock")
        if low_only == "true":
            qs = [s for s in qs if s.quantity < (s.product.min_stock or 5)]
            return qs
        return qs.order_by("product__name")

    @action(detail=False, methods=["get"])
    def deficit_count(self, request):
        shop = Warehouse.objects.filter(is_sellable=True).first()
        count = 0
        if shop:
            count = sum(
                1 for s in Stock.objects.filter(warehouse=shop).select_related("product")
                if s.quantity < (s.product.min_stock or 5)
            )
        return Response({"count": count})


class StockMovementViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = StockMovementSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["product", "warehouse", "reason"]

    def get_queryset(self):
        return StockMovement.objects.select_related("product", "warehouse", "user")


class ReceiptViewSet(viewsets.ModelViewSet):
    queryset = Receipt.objects.select_related("warehouse", "supplier", "created_by").prefetch_related("items__product")
    serializer_class = ReceiptSerializer
    permission_classes = [IsOwnerOrStock]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["status", "warehouse"]

    @action(detail=True, methods=["post"])
    def post_document(self, request, pk=None):
        receipt = self.get_object()
        services.post_receipt(receipt, request.user)
        return Response(self.get_serializer(receipt).data)


class TransferViewSet(viewsets.ModelViewSet):
    queryset = Transfer.objects.select_related("from_warehouse", "to_warehouse").prefetch_related("items__product")
    serializer_class = TransferSerializer
    permission_classes = [IsOwnerOrStock]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["status"]

    @action(detail=True, methods=["post"])
    def post_document(self, request, pk=None):
        transfer = self.get_object()
        services.post_transfer(transfer, request.user)
        return Response(self.get_serializer(transfer).data)

    @action(detail=False, methods=["get"])
    def suggest(self, request):
        to_wh = Warehouse.objects.filter(is_sellable=True).first()
        from_wh = Warehouse.objects.filter(kind=Warehouse.Kind.MAIN).first()
        if not to_wh or not from_wh:
            return Response([])
        return Response(services.suggest_transfer_items(to_wh, from_wh))


class InventoryViewSet(viewsets.ModelViewSet):
    queryset = Inventory.objects.select_related("warehouse").prefetch_related("items__product")
    serializer_class = InventorySerializer
    permission_classes = [IsOwnerOrStock]

    @action(detail=True, methods=["post"])
    def post_document(self, request, pk=None):
        inv = self.get_object()
        services.post_inventory(inv, request.user)
        return Response(self.get_serializer(inv).data)


class WriteOffViewSet(viewsets.ModelViewSet):
    queryset = WriteOff.objects.select_related("warehouse").prefetch_related("items__product")
    serializer_class = WriteOffSerializer
    permission_classes = [IsOwnerOrStock]

    @action(detail=True, methods=["post"])
    def post_document(self, request, pk=None):
        wo = self.get_object()
        services.post_writeoff(wo, request.user)
        return Response(self.get_serializer(wo).data)

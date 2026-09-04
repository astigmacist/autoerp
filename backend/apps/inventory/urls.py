from rest_framework.routers import DefaultRouter

from .views import (
    InventoryViewSet, ReceiptViewSet, StockMovementViewSet, StockViewSet,
    TransferViewSet, WarehouseViewSet, WriteOffViewSet,
)

router = DefaultRouter()
router.register("warehouses", WarehouseViewSet, basename="warehouse")
router.register("stock", StockViewSet, basename="stock")
router.register("movements", StockMovementViewSet, basename="movement")
router.register("receipts", ReceiptViewSet, basename="receipt")
router.register("transfers", TransferViewSet, basename="transfer")
router.register("inventories", InventoryViewSet, basename="inventory")
router.register("writeoffs", WriteOffViewSet, basename="writeoff")

urlpatterns = router.urls

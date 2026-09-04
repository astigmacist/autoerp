from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import SaleCreateView, SaleViewSet, ShiftViewSet

router = DefaultRouter()
router.register("sales", SaleViewSet, basename="sale")
router.register("shifts", ShiftViewSet, basename="shift")

urlpatterns = [
    path("sales/create/", SaleCreateView.as_view(), name="sale-create"),
] + router.urls

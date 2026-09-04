from django.urls import path

from .views import (
    DailyReportExcelView, DailyReportView, DashboardView, DeadStockReportView,
    DiscountsReportView, StockReportExcelView, StockReportView,
)

urlpatterns = [
    path("dashboard/", DashboardView.as_view(), name="report-dashboard"),
    path("daily/", DailyReportView.as_view(), name="report-daily"),
    path("daily/export/", DailyReportExcelView.as_view(), name="report-daily-export"),
    path("discounts/", DiscountsReportView.as_view(), name="report-discounts"),
    path("stock/", StockReportView.as_view(), name="report-stock"),
    path("stock/export/", StockReportExcelView.as_view(), name="report-stock-export"),
    path("dead-stock/", DeadStockReportView.as_view(), name="report-dead-stock"),
]

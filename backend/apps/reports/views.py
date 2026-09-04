from datetime import date as date_cls

from django.http import HttpResponse
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.inventory.models import Stock
from apps.inventory.serializers import StockSerializer
from . import exports, services


def _xlsx_response(workbook, filename):
    response = HttpResponse(
        content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )
    response["Content-Disposition"] = f'attachment; filename="{filename}"'
    workbook.save(response)
    return response


class DashboardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        period = request.query_params.get("period", "today")
        data = services.dashboard_data(period=period, can_see_cost=request.user.can_see_cost)
        return Response(data)


class DailyReportView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        date_str = request.query_params.get("date")
        d = date_cls.fromisoformat(date_str) if date_str else date_cls.today()
        data = services.daily_report(d, can_see_cost=request.user.can_see_cost)
        return Response(data)


class DailyReportExcelView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        date_str = request.query_params.get("date")
        d = date_cls.fromisoformat(date_str) if date_str else date_cls.today()
        data = services.daily_report(d, can_see_cost=request.user.can_see_cost)
        wb = exports.build_daily_report_workbook(data, can_see_cost=request.user.can_see_cost)
        return _xlsx_response(wb, f"AutoZap_otchet_{d.isoformat()}.xlsx")


class DiscountsReportView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        date_from = request.query_params.get("date_from")
        date_to = request.query_params.get("date_to")
        if not date_from or not date_to:
            today = date_cls.today()
            date_from = date_from or today.replace(day=1)
            date_to = date_to or today
        data = services.discounts_report(date_from, date_to)
        return Response(data)


class StockReportView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = Stock.objects.select_related("product", "warehouse").filter(product__is_active=True)
        warehouse = request.query_params.get("warehouse")
        if warehouse:
            qs = qs.filter(warehouse_id=warehouse)
        return Response(StockSerializer(qs, many=True).data)


class DeadStockReportView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        days = int(request.query_params.get("days", 90))
        return Response(services.dead_stock_report(days=days))


class StockReportExcelView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = Stock.objects.select_related("product", "warehouse").filter(product__is_active=True)
        warehouse = request.query_params.get("warehouse")
        if warehouse:
            qs = qs.filter(warehouse_id=warehouse)
        rows = StockSerializer(qs, many=True).data
        wb = exports.build_stock_workbook(rows)
        return _xlsx_response(wb, f"AutoZap_ostatki_{date_cls.today().isoformat()}.xlsx")

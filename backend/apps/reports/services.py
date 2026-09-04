from datetime import timedelta
from decimal import Decimal

from django.db.models import Sum, Count, F, DecimalField, ExpressionWrapper
from django.db.models.functions import TruncDate
from django.utils import timezone

from apps.inventory.models import Stock, Warehouse
from apps.sales.models import Payment, Sale, SaleItem

MONEY = DecimalField(max_digits=14, decimal_places=2)


def _today():
    return timezone.localdate()


def dashboard_data(period="today", can_see_cost=True):
    today = _today()
    if period == "7d":
        date_from = today - timedelta(days=6)
    elif period == "30d":
        date_from = today - timedelta(days=29)
    else:
        date_from = today

    sales = Sale.objects.filter(
        created_at__date__gte=date_from, created_at__date__lte=today,
        status__in=[Sale.Status.COMPLETED, Sale.Status.PARTIALLY_RETURNED],
    )
    yesterday = today - timedelta(days=1)
    sales_today = Sale.objects.filter(created_at__date=today, status__in=[Sale.Status.COMPLETED, Sale.Status.PARTIALLY_RETURNED])
    sales_yesterday = Sale.objects.filter(created_at__date=yesterday, status__in=[Sale.Status.COMPLETED, Sale.Status.PARTIALLY_RETURNED])

    def agg(qs):
        a = qs.aggregate(
            revenue=Sum("total"), count=Count("id"),
            discount=Sum("discount_total"), profit=Sum("profit"),
        )
        return {k: (v or Decimal("0")) for k, v in a.items()}

    today_agg = agg(sales_today)
    yesterday_agg = agg(sales_yesterday)

    def pct_change(cur, prev):
        if not prev:
            return None
        return round(float((cur - prev) / prev * 100), 1)

    avg_check = (today_agg["revenue"] / today_agg["count"]) if today_agg["count"] else Decimal("0")

    shop = Warehouse.objects.filter(is_sellable=True).first()
    deficit_count = 0
    if shop:
        deficit_count = sum(
            1 for s in Stock.objects.filter(warehouse=shop).select_related("product")
            if s.quantity < (s.product.min_stock or 5)
        )

    result = {
        "revenue": today_agg["revenue"],
        "revenue_change_pct": pct_change(today_agg["revenue"], yesterday_agg["revenue"]),
        "sales_count": today_agg["count"],
        "sales_count_change_pct": pct_change(today_agg["count"], yesterday_agg["count"]),
        "avg_check": avg_check,
        "discount_total": today_agg["discount"],
        "deficit_count": deficit_count,
        "period_revenue_by_day": list(
            sales.annotate(day=TruncDate("created_at"))
            .values("day").annotate(revenue=Sum("total"), count=Count("id"))
            .order_by("day")
        ),
        "payments_breakdown": list(
            Payment.objects.filter(sale__in=sales).values("method")
            .annotate(amount=Sum("amount")).order_by("-amount")
        ),
        "top_products": list(
            SaleItem.objects.filter(sale__in=sales).values("product__name", "product__sku")
            .annotate(qty=Sum("quantity"), revenue=Sum(F("final_price") * F("quantity"), output_field=MONEY))
            .order_by("-revenue")[:10]
        ),
        "recent_sales": list(
            sales.order_by("-created_at")[:10].values(
                "id", "number", "created_at", "total", "seller__first_name", "seller__last_name"
            )
        ),
    }
    if can_see_cost:
        result["profit"] = today_agg["profit"]
        result["profit_change_pct"] = pct_change(today_agg["profit"], yesterday_agg["profit"])
    return result


def daily_report(date, can_see_cost=True):
    sales = Sale.objects.filter(
        created_at__date=date, status__in=[Sale.Status.COMPLETED, Sale.Status.PARTIALLY_RETURNED],
    )
    returns_amount = Sale.objects.filter(created_at__date=date).aggregate(
        r=Sum("returns__total_amount")
    )["r"] or Decimal("0")

    finance = sales.aggregate(
        revenue=Sum("total"), discount=Sum("discount_total"),
        cost=Sum("cost_total"), profit=Sum("profit"), count=Count("id"),
    )
    finance = {k: (v or Decimal("0")) for k, v in finance.items()}
    avg_check = (finance["revenue"] / finance["count"]) if finance["count"] else Decimal("0")
    avg_discount_pct = (finance["discount"] / finance["revenue"] * 100) if finance["revenue"] else Decimal("0")

    payments = list(
        Payment.objects.filter(sale__in=sales).values("method").annotate(amount=Sum("amount")).order_by("-amount")
    )

    items_qs = (
        SaleItem.objects.filter(sale__in=sales)
        .values("product__name", "product__sku")
        .annotate(
            qty=Sum("quantity"),
            amount_base=Sum(F("base_price") * F("quantity"), output_field=MONEY),
            amount_fact=Sum(F("final_price") * F("quantity"), output_field=MONEY),
            cost=Sum(F("unit_cost") * F("quantity"), output_field=MONEY),
        )
        .order_by("-amount_fact")
    )
    items = []
    for row in items_qs:
        discount = row["amount_base"] - row["amount_fact"]
        profit = row["amount_fact"] - row["cost"]
        items.append({**row, "discount": discount, "profit": profit})

    sellers = list(
        sales.values("seller__id", "seller__first_name", "seller__last_name")
        .annotate(count=Count("id"), revenue=Sum("total"), discount=Sum("discount_total"), profit=Sum("profit"))
        .order_by("-revenue")
    )

    result = {
        "date": date,
        "finance": {
            "revenue": finance["revenue"],
            "revenue_by_payment": payments,
            "returns_amount": returns_amount,
            "net_revenue": finance["revenue"] - returns_amount,
            "discount_total": finance["discount"],
            "avg_discount_pct": round(avg_discount_pct, 1),
            "sales_count": finance["count"],
            "avg_check": avg_check,
        },
        "items": items,
        "sellers": sellers,
    }
    if can_see_cost:
        result["finance"]["cost_total"] = finance["cost"]
        result["finance"]["profit"] = finance["profit"]
        result["finance"]["margin_pct"] = round(
            (finance["profit"] / finance["revenue"] * 100) if finance["revenue"] else 0, 1
        )
    else:
        for i in items:
            i.pop("cost", None)
            i.pop("profit", None)
    return result


def discounts_report(date_from, date_to):
    sales = Sale.objects.filter(created_at__date__gte=date_from, created_at__date__lte=date_to)
    by_product = list(
        SaleItem.objects.filter(sale__in=sales)
        .annotate(discount=ExpressionWrapper((F("base_price") - F("final_price")) * F("quantity"), output_field=MONEY))
        .values("product__name", "product__sku")
        .annotate(total_discount=Sum("discount"), qty=Sum("quantity"))
        .filter(total_discount__gt=0)
        .order_by("-total_discount")
    )
    by_seller = list(
        sales.annotate().values("seller__first_name", "seller__last_name")
        .annotate(total_discount=Sum("discount_total"), sales_count=Count("id"))
        .filter(total_discount__gt=0)
        .order_by("-total_discount")
    )
    return {"by_product": by_product, "by_seller": by_seller}


def dead_stock_report(days=90):
    from apps.catalog.models import Product

    cutoff = timezone.now() - timedelta(days=days)
    recently_sold_ids = set(
        SaleItem.objects.filter(sale__created_at__gte=cutoff).values_list("product_id", flat=True)
    )
    result = []
    for stock in Stock.objects.select_related("product").filter(quantity__gt=0):
        if stock.product_id in recently_sold_ids:
            continue
        result.append({
            "product_id": stock.product_id,
            "product_name": stock.product.name,
            "sku": stock.product.sku,
            "quantity": stock.quantity,
            "frozen_amount": stock.quantity * stock.product.avg_cost,
        })
    result.sort(key=lambda r: r["frozen_amount"], reverse=True)
    return result

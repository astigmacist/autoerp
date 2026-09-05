from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path, re_path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

from config.spa import spa_index


def health(request):
    return JsonResponse({"status": "ok"})


urlpatterns = [
    path("api/health/", health, name="health"),
    path("admin/", admin.site.urls),
    path("api/v1/auth/", include("apps.accounts.urls")),
    path("api/v1/", include("apps.catalog.urls")),
    path("api/v1/", include("apps.inventory.urls")),
    path("api/v1/", include("apps.sales.urls")),
    path("api/v1/reports/", include("apps.reports.urls")),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
]

# Всё, что не API, не админка и не статика, отдаём собранному фронтенду —
# дальше маршрут разбирает React Router уже в браузере. Это правило обязано
# быть последним, иначе оно перехватит запросы к API.
urlpatterns += [
    re_path(r"^(?!api/|admin/|static/).*$", spa_index, name="spa"),
]

"""Отдача собранного фронтенда (SPA) тем же приложением, что и API.

Благодаря этому весь проект — один деплой: Django обслуживает /api/ и /admin/,
а всё остальное отдаёт index.html, дальше маршрутизацией занимается React Router.
Ассеты (js/css) сюда не попадают: они лежат в статике и раздаются с CDN.
"""

from __future__ import annotations

from django.conf import settings
from django.http import FileResponse, HttpResponse


def spa_index(request, *args, **kwargs):
    index_path = settings.SPA_DIR / "index.html"
    if not index_path.is_file():
        return HttpResponse(
            "Фронтенд не собран. Выполните в папке frontend: npm run build:demo",
            status=501,
            content_type="text/plain; charset=utf-8",
        )
    # index.html не кешируем: имена ассетов внутри него меняются при каждой
    # сборке, и закешированный старый index тянул бы за собой удалённые файлы.
    response = FileResponse(open(index_path, "rb"), content_type="text/html; charset=utf-8")
    response["Cache-Control"] = "no-store, must-revalidate"
    return response

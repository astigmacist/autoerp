"""Понятное сообщение вместо пустой 500-й, когда база недоступна.

Раньше сбой базы на хостинге выглядел так: приложение открывается, а каждый
запрос отвечает 500 без единой подсказки, что именно сломалось. Теперь и
интерфейс, и API получают текст с конкретным следующим шагом.
"""

from __future__ import annotations

from django.db import OperationalError
from django.http import HttpResponse, JsonResponse

_TITLE = "База данных недоступна"

_HINT = (
    "Демо работает на временной базе, и её не удалось подготовить. "
    "Самый надёжный способ починить — подключить постоянную базу: "
    "в проекте на Vercel откройте вкладку Storage → Create Database → "
    "Postgres (Neon) → Connect to Project, затем Deployments → ⋯ → Redeploy. "
    "Приложение подхватит её автоматически, менять код не нужно."
)

_HTML = """<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><title>{title}</title>
<style>
  body {{ margin:0; min-height:100vh; display:flex; align-items:center;
         justify-content:center; background:#f6f7f9; color:#16171d;
         font:15px/1.6 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }}
  .card {{ max-width:34rem; margin:2rem; padding:1.75rem 2rem; background:#fff;
          border:1px solid #e5e7eb; border-radius:1rem; }}
  h1 {{ margin:0 0 .75rem; font-size:1.15rem; }}
  code {{ background:#f3f4f6; padding:.15rem .4rem; border-radius:.35rem;
         font-size:.85em; word-break:break-all; }}
  @media (prefers-color-scheme: dark) {{
    body {{ background:#0f1115; color:#e5e7eb; }}
    .card {{ background:#151720; border-color:#2a2d38; }}
    code {{ background:#22252f; }}
  }}
</style></head>
<body><div class="card">
  <h1>{title}</h1>
  <p>{hint}</p>
  <p><code>{detail}</code></p>
</div></body></html>
"""


def _response(detail: str) -> HttpResponse:
    return HttpResponse(
        _HTML.format(title=_TITLE, hint=_HINT, detail=detail),
        status=503,
        content_type="text/html; charset=utf-8",
    )


class DatabaseUnavailableMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        from config.db_bootstrap import failure

        detail = failure()
        if detail is not None:
            return self._render(request, detail)
        return self.get_response(request)

    def process_exception(self, request, exception):
        if isinstance(exception, OperationalError):
            return self._render(request, f"OperationalError: {exception}")
        return None

    @staticmethod
    def _render(request, detail: str):
        if request.path.startswith("/api/"):
            return JsonResponse(
                {"code": "database_unavailable", "detail": f"{_TITLE}. {_HINT}", "errors": []},
                status=503,
            )
        return _response(detail)

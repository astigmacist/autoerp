"""
WSGI config for config project.

It exposes the WSGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/5.0/howto/deployment/wsgi/

Vercel находит этот модуль само — по `WSGI_APPLICATION` в настройках (см.
документацию «Deploy a Django app on Vercel»), поэтому никакой отдельный
entrypoint в конфиге не нужен.

Миграции здесь НЕ запускаются: они выполняются на этапе сборки в
`vercel_build.py`. Раньше `migrate` вызывался прямо отсюда, при холодном
старте, и это молча ломало демо — на read-only файловой системе Vercel
миграции падали, ошибка уходила в лог, а приложение продолжало работать
с нерабочей базой и отвечало 500 на каждый запрос.
"""

import os

from django.core.wsgi import get_wsgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

application = get_wsgi_application()

# Демо-режим без внешней базы: развернуть SQLite во временном каталоге.
# Если подключена настоящая база, вызов ничего не делает.
from config.db_bootstrap import ensure_database  # noqa: E402  (после настройки Django)

ensure_database()

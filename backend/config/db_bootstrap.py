"""Подготовка базы данных при старте.

Два разных случая:

* **Подключена настоящая база** (DATABASE_URL / POSTGRES_URL). Обычно схему
  накатывает сборка (`vercel_build.py`), но полагаться только на неё нельзя:
  базу часто подключают уже после деплоя, и тогда сборка её просто не видела.
  Поэтому при первом запросе приложение проверяет, есть ли таблицы, и если
  нет — выполняет миграции само. Параллельные экземпляры функции при этом не
  мешают друг другу: на время миграции берётся блокировка в самой базе.

* **Внешней базы нет** — работаем на SQLite. На хостинге каталог с кодом
  доступен только на чтение, поэтому файл базы кладётся во временный каталог:
  он появляется копированием готового `db_seed.sqlite3` (быстро, обычный путь)
  либо выполнением миграций на месте. Такая база живёт ровно столько, сколько
  живёт экземпляр функции, — это демо-режим, и интерфейс о нём предупреждает.

Любая ошибка здесь не роняет процесс, а запоминается: `DatabaseUnavailableMiddleware`
покажет её человеку понятным текстом вместо пустой 500-й страницы.
"""

from __future__ import annotations

import logging
import shutil
import time
from pathlib import Path

from django.conf import settings

logger = logging.getLogger("autozap.startup")

_failure: str | None = None
_ready = False
_last_attempt = 0.0

# Если база не поднялась (сеть моргнула, Neon просыпался из сна), нет смысла
# хоронить весь экземпляр: пробуем снова, но не чаще раза в полминуты.
_RETRY_AFTER_SECONDS = 30.0

# Ключ блокировки в Postgres: произвольное, но постоянное число. Два
# экземпляра функции, стартовавшие одновременно, не станут накатывать
# миграции одновременно на одну базу.
_ADVISORY_LOCK_KEY = 4_120_577_301


def failure() -> str | None:
    """Текст ошибки подготовки базы, если она не удалась."""
    return _failure


def ensure_database() -> None:
    """Довести базу до рабочего состояния. Безопасно вызывать много раз."""
    global _failure, _ready, _last_attempt

    if _ready:
        return
    now = time.monotonic()
    if _failure is not None and now - _last_attempt < _RETRY_AFTER_SECONDS:
        return
    _last_attempt = now

    try:
        if getattr(settings, "SQLITE_RUNTIME_PATH", None) is None:
            _ensure_external_schema()
        else:
            _ensure_sqlite_file()
    except Exception as exc:  # noqa: BLE001 — сообщение показываем пользователю
        _failure = f"{type(exc).__name__}: {exc}"
        logger.exception("Не удалось подготовить базу данных")
    else:
        _ready = True
        _failure = None


def _schema_is_ready() -> bool:
    """Есть ли в базе таблицы приложения."""
    from django.db import connection

    with connection.cursor():
        tables = set(connection.introspection.table_names())
    # django_migrations появляется первой же миграцией, accounts_user — нашей.
    return "django_migrations" in tables and "accounts_user" in tables


def _ensure_external_schema() -> None:
    """Накатить миграции на внешнюю базу, если её схема ещё пуста."""
    from django.core.management import call_command
    from django.db import connection

    if _schema_is_ready():
        return

    logger.info("Внешняя база пустая — накатываю миграции при старте")

    is_postgres = connection.vendor == "postgresql"
    if is_postgres:
        with connection.cursor() as cursor:
            cursor.execute("SELECT pg_advisory_lock(%s)", [_ADVISORY_LOCK_KEY])
    try:
        # Пока ждали блокировку, схему мог накатить соседний экземпляр.
        if _schema_is_ready():
            return
        call_command("migrate", interactive=False, verbosity=0)
        if getattr(settings, "SEED_DEMO_ON_EMPTY", True):
            call_command("seed_demo", verbosity=0)
        logger.info("Схема внешней базы готова")
    finally:
        if is_postgres:
            with connection.cursor() as cursor:
                cursor.execute("SELECT pg_advisory_unlock(%s)", [_ADVISORY_LOCK_KEY])


def _ensure_sqlite_file() -> None:
    """Развернуть файл SQLite во временном каталоге (демо-режим)."""
    from django.core.management import call_command

    runtime_path = Path(settings.SQLITE_RUNTIME_PATH)
    if runtime_path.exists() and runtime_path.stat().st_size > 0:
        return

    runtime_path.parent.mkdir(parents=True, exist_ok=True)

    seed_path = Path(getattr(settings, "SQLITE_SEED_PATH", ""))
    if seed_path.is_file():
        shutil.copyfile(seed_path, runtime_path)
        logger.info("База демо развёрнута из %s в %s", seed_path, runtime_path)
        return

    logger.info("Готового файла базы нет — выполняю миграции в %s", runtime_path)
    call_command("migrate", interactive=False, verbosity=0)
    call_command("seed_demo", verbosity=0)

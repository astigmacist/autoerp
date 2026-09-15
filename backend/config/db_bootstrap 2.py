"""Подготовка базы данных при старте (демо-режим без внешней БД).

Если подключена внешняя база (DATABASE_URL / POSTGRES_URL), здесь ничего не
происходит — миграции в этом случае выполняются на этапе сборки.

Если внешней базы нет, приложение работает на SQLite во временном каталоге:
на хостинге каталог с кодом доступен только на чтение, и временный каталог —
единственное место, куда можно писать. Файл базы там появляется одним из двух
способов: копированием готового `db_seed.sqlite3`, собранного во время сборки
(быстро, обычный путь), либо, если его нет, выполнением миграций на месте.

Любая ошибка здесь не роняет процесс, а запоминается: `DatabaseUnavailableMiddleware`
покажет её человеку понятным текстом вместо пустой 500-й страницы.
"""

from __future__ import annotations

import logging
import shutil
from pathlib import Path

from django.conf import settings

logger = logging.getLogger("autozap.startup")

_failure: str | None = None


def failure() -> str | None:
    """Текст ошибки подготовки базы, если она не удалась."""
    return _failure


def ensure_database() -> None:
    global _failure

    runtime_path = getattr(settings, "SQLITE_RUNTIME_PATH", None)
    if runtime_path is None:
        return  # работаем на внешней базе — готовить нечего

    runtime_path = Path(runtime_path)
    try:
        if runtime_path.exists() and runtime_path.stat().st_size > 0:
            return

        runtime_path.parent.mkdir(parents=True, exist_ok=True)

        seed_path = Path(getattr(settings, "SQLITE_SEED_PATH", ""))
        if seed_path.is_file():
            shutil.copyfile(seed_path, runtime_path)
            logger.info("База демо развёрнута из %s в %s", seed_path, runtime_path)
            return

        from django.core.management import call_command

        logger.info("Готового файла базы нет — выполняю миграции в %s", runtime_path)
        call_command("migrate", interactive=False, verbosity=0)
        call_command("seed_demo", verbosity=0)
    except Exception as exc:  # noqa: BLE001 — сообщение показываем пользователю
        _failure = f"{type(exc).__name__}: {exc}"
        logger.exception("Не удалось подготовить базу данных")

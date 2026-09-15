"""Шаг сборки на хостинге (Vercel запускает его через buildCommand).

Задача — сделать так, чтобы первый же запрос к приложению отвечал сразу, а не
тратил время на миграции:

* если подключена внешняя база (DATABASE_URL / POSTGRES_URL) — накатываем на
  неё миграции и демо-данные прямо здесь, во время сборки. Это единственный
  момент, когда на serverless-хостинге вообще можно выполнить миграции;
* если внешней базы нет — собираем готовый файл SQLite (`db_seed.sqlite3`),
  который при старте копируется во временный каталог.

collectstatic вызывать не нужно: Vercel запускает его сам и раздаёт статику
(включая собранный фронтенд из backend/spa/) со своего CDN.
"""

import os
import subprocess
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
SEED_PATH = BASE_DIR / "db_seed.sqlite3"

def _first_env(*names: str) -> str:
    for name in names:
        value = (os.environ.get(name) or "").strip()
        if value:
            return value
    return ""


# Интеграция Postgres на Vercel создаёт сразу несколько переменных с разными
# именами — проверяем все, иначе «база подключена, а сборка её не видит».
external_db = _first_env("DATABASE_URL", "POSTGRES_URL", "POSTGRES_PRISMA_URL", "NEON_DATABASE_URL")

# Миграции катаем по прямому адресу: через пул в transaction-режиме они рвутся.
migration_db = _first_env("DATABASE_URL_UNPOOLED", "POSTGRES_URL_NON_POOLING", "DIRECT_URL") or external_db


def run(*args: str, env: dict | None = None) -> None:
    print(f"$ python manage.py {' '.join(args)}", flush=True)
    subprocess.run([sys.executable, "manage.py", *args], check=True, env=env)


if external_db:
    print("Найдена внешняя база — накатываю миграции на неё.", flush=True)
    db_env = {**os.environ, "DATABASE_URL": migration_db}
    run("migrate", "--noinput", env=db_env)
    if os.environ.get("AUTOZAP_SEED_DEMO", "1") == "1":
        run("seed_demo", env=db_env)
else:
    print(
        "Внешняя база не подключена — собираю готовый файл демо-базы.\n"
        "Данные в таком режиме живут до перезапуска экземпляра. Чтобы они\n"
        "сохранялись постоянно, подключите Postgres: вкладка Storage →\n"
        "Create Database → Postgres (Neon) → Connect to Project, затем Redeploy.",
        flush=True,
    )
    if SEED_PATH.exists():
        SEED_PATH.unlink()
    # Сборка идёт на записываемой файловой системе, поэтому файл базы можно
    # создать прямо здесь и положить рядом с кодом — read-only он станет уже
    # в задеплоенном приложении, откуда его и копируют во временный каталог.
    seed_env = {**os.environ, "DATABASE_URL": f"sqlite:///{SEED_PATH}"}
    run("migrate", "--noinput", env=seed_env)
    if os.environ.get("AUTOZAP_SEED_DEMO", "1") == "1":
        run("seed_demo", env=seed_env)
    print(f"Готово: {SEED_PATH.name} ({SEED_PATH.stat().st_size // 1024} КБ)", flush=True)

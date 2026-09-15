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

external_db = os.environ.get("DATABASE_URL") or os.environ.get("POSTGRES_URL")


def run(*args: str, env: dict | None = None) -> None:
    print(f"$ python manage.py {' '.join(args)}", flush=True)
    subprocess.run([sys.executable, "manage.py", *args], check=True, env=env)


if external_db:
    print("Найдена внешняя база — накатываю миграции на неё.", flush=True)
    run("migrate", "--noinput")
    if os.environ.get("AUTOZAP_SEED_DEMO", "1") == "1":
        run("seed_demo")
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

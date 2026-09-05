"""Шаг сборки бэкенда на Vercel.

Vercel запускает этот файл через "buildCommand" из vercel.json — после
установки requirements.txt и до того, как приложение упакуется в Vercel
Function.

Это единственное место в деплое на Vercel, где можно выполнить миграции:
во время обработки запросов файловая система функции доступна только на
чтение, а «зайти на сервер и выполнить manage.py migrate» здесь негде.
collectstatic вызывать не нужно — Vercel делает это сам (см. документацию
«Deploy a Django app on Vercel» → Serving static assets).
"""

import os
import subprocess
import sys

BOLD = "\033[1m"
RESET = "\033[0m"

if not (os.environ.get("DATABASE_URL") or os.environ.get("POSTGRES_URL")):
    sys.exit(
        f"\n{BOLD}Сборка остановлена: не подключена база данных "
        f"(нет переменной DATABASE_URL).{RESET}\n\n"
        "Vercel Functions работают на файловой системе только для чтения, поэтому\n"
        "SQLite здесь не годится — данные будет некуда записывать, и приложение\n"
        "будет выглядеть работающим, но любая продажа или приход будут падать.\n\n"
        "Что сделать:\n"
        "  1. Откройте проект на Vercel → вкладка Storage → Create Database\n"
        "     → Postgres (Neon) → Connect to Project.\n"
        "  2. Vercel сам добавит переменную DATABASE_URL в проект.\n"
        "  3. Deployments → последний деплой → ⋯ → Redeploy.\n"
    )


def run(*args: str) -> None:
    print(f"\n$ python manage.py {' '.join(args)}", flush=True)
    subprocess.run([sys.executable, "manage.py", *args], check=True)


run("migrate", "--noinput")

if os.environ.get("AUTOZAP_SEED_DEMO", "1") == "1":
    run("seed_demo")

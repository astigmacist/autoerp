#!/bin/bash
# Запуск AutoZap на своём компьютере. Файл можно просто открыть двойным
# щелчком в Finder — Terminal откроется сам.
#
# Что делает: готовит окружение Python (один раз), создаёт локальную базу,
# поднимает сервер и открывает браузер. Node.js и Docker не нужны: собранный
# интерфейс лежит в репозитории, Django отдаёт его сам.

set -e
cd "$(dirname "$0")"

BLUE=$'\033[1;34m'; GREEN=$'\033[1;32m'; RED=$'\033[1;31m'; DIM=$'\033[2m'; OFF=$'\033[0m'
say()  { printf '%s\n' "${BLUE}▸ $1${OFF}"; }
ok()   { printf '%s\n' "${GREEN}✓ $1${OFF}"; }
fail() { printf '%s\n' "${RED}✗ $1${OFF}"; exit 1; }

PORT="${PORT:-8000}"

printf '\n%s\n\n' "${BLUE}AutoZap ERP — локальный запуск${OFF}"

# ── 1. Python ────────────────────────────────────────────────────────────────
command -v python3 >/dev/null 2>&1 || fail "Не найден python3.
Установите инструменты разработчика — в Терминале:
  xcode-select --install"

cd backend

# ── 2. Окружение Python (создаётся один раз) ─────────────────────────────────
if [ ! -x venv/bin/python ]; then
  say "Первый запуск: готовлю окружение Python (займёт минуту)"
  python3 -m venv venv
fi

# shellcheck disable=SC1091
source venv/bin/activate

if [ ! -f venv/.deps-installed ] || [ requirements.txt -nt venv/.deps-installed ]; then
  say "Устанавливаю библиотеки"
  pip install --quiet --upgrade pip
  pip install --quiet -r requirements.txt || fail "Не удалось установить библиотеки.
Проверьте интернет и запустите файл снова."
  touch venv/.deps-installed
fi
ok "Окружение готово"

# ── 3. Настройки ─────────────────────────────────────────────────────────────
if [ ! -f .env ]; then
  say "Создаю backend/.env"
  {
    echo "DEBUG=True"
    echo "SECRET_KEY=$(python -c 'import secrets; print(secrets.token_urlsafe(64))')"
    echo "# Чтобы работать на PostgreSQL вместо файла SQLite, раскомментируйте:"
    echo "# DATABASE_URL=postgres://autozap:autozap@127.0.0.1:5432/autozap"
  } > .env
fi

# ── 4. База ──────────────────────────────────────────────────────────────────
say "Обновляю базу"
python manage.py migrate --noinput >/dev/null
python manage.py seed_demo >/dev/null
if python -c "import environ,os; e=environ.Env(); environ.Env.read_env('.env'); raise SystemExit(0 if (e('DATABASE_URL', default='') or e('POSTGRES_URL', default='')) else 1)" 2>/dev/null; then
  ok "База: PostgreSQL"
else
  ok "База: файл backend/db.sqlite3 (данные сохраняются между запусками)"
fi

# ── 5. Запуск ────────────────────────────────────────────────────────────────
URL="http://127.0.0.1:${PORT}"
printf '\n'
ok "Запускаю: ${URL}"
printf '%s\n' "${DIM}Логины: owner / owner12345 · stock / stock12345 · seller / seller12345"
printf '%s\n\n' "Остановить — Ctrl+C или просто закрыть это окно.${OFF}"

( sleep 2; command -v open >/dev/null && open "$URL" >/dev/null 2>&1 || true ) &

exec python manage.py runserver "127.0.0.1:${PORT}"

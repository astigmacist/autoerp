#!/bin/sh
set -e

echo "Waiting for database..."
python - <<'PY'
import os, time, sys
import psycopg2
from urllib.parse import urlparse

url = os.environ.get("DATABASE_URL", "")
if url.startswith("postgres"):
    parsed = urlparse(url)
    for _ in range(30):
        try:
            psycopg2.connect(
                dbname=parsed.path.lstrip("/"),
                user=parsed.username,
                password=parsed.password,
                host=parsed.hostname,
                port=parsed.port or 5432,
            ).close()
            break
        except Exception:
            time.sleep(1)
    else:
        sys.exit("Database not reachable")
PY

echo "Applying migrations..."
python manage.py migrate --noinput

echo "Collecting static files..."
python manage.py collectstatic --noinput

exec "$@"

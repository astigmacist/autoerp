"""
Django settings for AutoZap ERP.
"""

import os
import sys
import tempfile
import warnings
from datetime import timedelta
from pathlib import Path

import environ
from django.core.exceptions import ImproperlyConfigured

BASE_DIR = Path(__file__).resolve().parent.parent

env = environ.Env(
    DEBUG=(bool, False),
)
environ.Env.read_env(BASE_DIR / ".env")

ON_VERCEL = bool(os.environ.get("VERCEL"))

# DEBUG выключен по умолчанию. Раньше он включался везде, где нет признака
# Vercel, — то есть на обычном сервере без явной настройки приложение
# показывало бы посетителю трассировки со всеми настройками. Для локальной
# разработки достаточно один раз положить DEBUG=True в backend/.env.
DEBUG = env.bool("DEBUG", default=False)

_FALLBACK_SECRET_KEY = "django-insecure-change-me-in-prod"
# `or` (не только `default=`): значение по умолчанию у django-environ
# срабатывает лишь когда переменной нет совсем. Если она есть, но пустая
# (так вело себя окружение сборки на Vercel), env() вернёт "", а
# rest_framework_simplejwt читает SECRET_KEY при импорте — и приложение
# падает ещё до старта.
SECRET_KEY = env("SECRET_KEY", default=_FALLBACK_SECRET_KEY) or _FALLBACK_SECRET_KEY

# Этим ключом подписываются токены входа. Если он останется значением по
# умолчанию (оно лежит в открытом репозитории), любой сможет подделать токен
# и войти владельцем. На демо-стенде это допустимо, в бою — нет, поэтому
# приложение не запустится молча с чужим ключом.
# Прогон тестов идёт с DEBUG=False (так делает сам Django), и требовать там
# боевой ключ незачем — проверка касается только запуска приложения.
_RUNNING_TESTS = "test" in sys.argv

if not DEBUG and not ON_VERCEL and not _RUNNING_TESTS and SECRET_KEY == _FALLBACK_SECRET_KEY:
    raise ImproperlyConfigured(
        "SECRET_KEY не задан. Этим ключом подписываются токены входа, и значение "
        "по умолчанию известно всем, кто видел репозиторий — с ним можно подделать "
        "вход под любым пользователем.\n\n"
        "Сгенерируйте ключ и положите в backend/.env (или в переменные окружения):\n"
        "  python -c \"import secrets; print(secrets.token_urlsafe(64))\"\n"
        "  SECRET_KEY=<полученная строка>"
    )

ALLOWED_HOSTS = env.list("ALLOWED_HOSTS", default=["*"])

if not DEBUG and not ON_VERCEL and not _RUNNING_TESTS and ALLOWED_HOSTS == ["*"]:
    # Не блокируем запуск (за nginx это не критично), но так предупреждение
    # видно в логах контейнера, а не теряется.
    warnings.warn(
        "ALLOWED_HOSTS не задан — приложение принимает запросы с любым доменом. "
        "Укажите свой домен в backend/.env: ALLOWED_HOSTS=erp.ваш-домен.kz",
        RuntimeWarning,
    )

# --- HTTPS на своём сервере ---
# Включается одной переменной USE_HTTPS=True, когда перед приложением уже
# стоит nginx/Caddy с сертификатом. Отдельный флаг нужен потому, что включить
# это заранее — значит закрыть себе доступ: браузер будет отправлять cookie
# только по https, а редирект уведёт на адрес, которого ещё нет.
if env.bool("USE_HTTPS", default=False):
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    SECURE_SSL_REDIRECT = True
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_HSTS_SECONDS = 31536000
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True

# --- Vercel (demo hosting) ---
# Vercel terminates TLS in front of the app and proxies over HTTP, and sets
# VERCEL_URL (current deployment) / VERCEL_PROJECT_PRODUCTION_URL (stable
# production domain) automatically. Django 4+ requires an exact-origin
# allowlist for CSRF (separate from ALLOWED_HOSTS), so without this, POSTing
# to /admin/login/ (or any session-authenticated form) on a *.vercel.app
# domain fails with "CSRF verification failed".
if ON_VERCEL:
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    # Belt-and-suspenders against DisallowedHost (django's generic, message-less
    # "Bad Request (400)" for EVERY request, including /api/health/, with
    # DEBUG=False — easy to mistake for an app bug). If the ALLOWED_HOSTS env
    # var on Vercel ends up wrong (e.g. someone bulk-copied .env.example,
    # whose ALLOWED_HOSTS is the placeholder "erp.your-domain.kz,localhost,
    # 127.0.0.1" — none of which match "<project>.vercel.app"), the demo
    # would 400 on literally everything with no clue why. Always accept the
    # actual Vercel hostname regardless of what ALLOWED_HOSTS is set to.
    ALLOWED_HOSTS.append(".vercel.app")

CSRF_TRUSTED_ORIGINS = env.list("CSRF_TRUSTED_ORIGINS", default=[])
CSRF_TRUSTED_ORIGINS.append("https://*.vercel.app")
_vercel_url = env("VERCEL_URL", default="")
if _vercel_url:
    CSRF_TRUSTED_ORIGINS.append(f"https://{_vercel_url}")
_vercel_prod_url = env("VERCEL_PROJECT_PRODUCTION_URL", default="")
if _vercel_prod_url:
    CSRF_TRUSTED_ORIGINS.append(f"https://{_vercel_prod_url}")

# Application definition

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # third-party
    "rest_framework",
    "rest_framework_simplejwt",
    "corsheaders",
    "django_filters",
    "drf_spectacular",
    "simple_history",
    # local apps
    "apps.core",
    "apps.accounts",
    "apps.catalog",
    "apps.inventory",
    "apps.sales",
    "apps.reports",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "simple_history.middleware.HistoryRequestMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    # Показывает внятную страницу вместо голого 500, если база недоступна.
    "apps.core.middleware.DatabaseUnavailableMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

# Database
#
# Приоритет — внешняя база: хостинг-интеграции (Postgres/Neon на Vercel)
# кладут строку подключения в DATABASE_URL, некоторые — ещё и в POSTGRES_URL.
# Подключили базу в панели — приложение само её подхватит, менять код не нужно.
#
# Если внешней базы нет, работает SQLite. На Vercel каталог с кодом доступен
# только на чтение, поэтому файл базы кладётся во временный каталог (TMPDIR,
# обычно /tmp) — единственное место, куда функции разрешено писать. Такая база
# живёт до перезапуска экземпляра: для показа демо этого достаточно, для
# постоянного хранения — подключите Postgres (см. README).
_database_url = env("DATABASE_URL", default="") or env("POSTGRES_URL", default="")

# Готовый файл базы, который собирается на этапе сборки (vercel_build.py):
# при старте он копируется во временный каталог, чтобы не выполнять миграции
# на первом запросе.
SQLITE_SEED_PATH = BASE_DIR / "db_seed.sqlite3"

if _database_url:
    DATABASES = {"default": env.db_url_config(_database_url)}
    SQLITE_RUNTIME_PATH = None
else:
    if ON_VERCEL:
        SQLITE_RUNTIME_PATH = Path(tempfile.gettempdir()) / "autozap.sqlite3"
    else:
        SQLITE_RUNTIME_PATH = BASE_DIR / "db.sqlite3"
    DATABASES = {"default": env.db_url_config(f"sqlite:///{SQLITE_RUNTIME_PATH}")}

AUTH_USER_MODEL = "accounts.User"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator", "OPTIONS": {"min_length": 6}},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# Internationalization
LANGUAGE_CODE = "ru"
TIME_ZONE = "Asia/Almaty"
USE_I18N = True
USE_TZ = True

# Static files
# Note: no user-uploaded media (product photos etc.) by design — keeps the
# server's disk footprint small for a boutique-size shop. If that changes
# later, add MEDIA_URL/MEDIA_ROOT back and an ImageField/FileField on the model.
STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

# Собранный фронтенд лежит в backend/spa/ (папка коммитится в репозиторий,
# пересобирается командой `npm run build:demo`). Он попадает в статику обычным
# collectstatic, поэтому на хостинге раздаётся с CDN, а не через Python.
# Именно это позволяет держать весь проект одним деплоем: Django отдаёт и API,
# и интерфейс.
SPA_DIR = BASE_DIR / "spa"
STATICFILES_DIRS = [SPA_DIR] if SPA_DIR.exists() else []

STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    # Без «манифестного» варианта: Vite уже добавляет хеш в имена файлов, а
    # ManifestStaticFilesStorage при любой недостающей ссылке внутри CSS/JS
    # роняет collectstatic целиком — лишний способ сломать деплой на ровном месте.
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedStaticFilesStorage"},
}

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# --- DRF ---
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
    "DEFAULT_FILTER_BACKENDS": (
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ),
    "DEFAULT_PAGINATION_CLASS": "apps.core.pagination.DefaultPagination",
    "PAGE_SIZE": 50,
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "EXCEPTION_HANDLER": "apps.core.exceptions.custom_exception_handler",
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=30),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=14),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "AUTH_HEADER_TYPES": ("Bearer",),
}

SPECTACULAR_SETTINGS = {
    "TITLE": "AutoZap ERP API",
    "DESCRIPTION": "Учёт склада и продаж для магазина автозапчастей",
    "VERSION": "1.0.0",
}

CORS_ALLOWED_ORIGINS = env.list(
    "CORS_ALLOWED_ORIGINS",
    default=["http://localhost:5173", "http://127.0.0.1:5173"],
)
# Фронтенд и бэкенд деплоятся как два отдельных проекта Vercel, поэтому в
# продакшене SPA обращается к API с другого домена. Точный список доменов вести
# бессмысленно: каждый preview-деплой получает новый поддомен *.vercel.app, и
# любой из них должен работать. Для демо разрешаем любой поддомен vercel.app —
# на реальном домене оставьте только его (переменная CORS_ALLOWED_ORIGINS).
# Только на Vercel: там фронтенд может жить на соседнем поддомене, и список
# точных адресов пришлось бы обновлять на каждый preview-деплой. На своём
# сервере фронтенд и API на одном домене, и лишних разрешений быть не должно.
if ON_VERCEL:
    CORS_ALLOWED_ORIGIN_REGEXES = [r"^https://[A-Za-z0-9-]+\.vercel\.app$"]
CORS_ALLOW_CREDENTIALS = True

# --- AutoZap business settings (defaults, overridable in Settings model) ---
AUTOZAP_DEFAULT_MIN_STOCK = 5
AUTOZAP_SELLER_DISCOUNT_LIMIT_PERCENT = 10
AUTOZAP_CURRENCY = "KZT"

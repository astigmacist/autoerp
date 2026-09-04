"""
Django settings for AutoZap ERP.
"""

import os
from datetime import timedelta
from pathlib import Path

import environ

BASE_DIR = Path(__file__).resolve().parent.parent

env = environ.Env(
    DEBUG=(bool, False),
)
environ.Env.read_env(BASE_DIR / ".env")

_FALLBACK_SECRET_KEY = "django-insecure-change-me-in-prod"
# `or` (not just `default=`) because django-environ's default only kicks in
# when the var is entirely absent — if it's present but blank (e.g. a
# platform's build step scopes/strips it differently from the runtime, as
# seen on Vercel: collectstatic ran during build with SECRET_KEY="" even
# though it's set for the project), env() happily returns "", and
# rest_framework_simplejwt reads settings.SECRET_KEY at import time, so an
# empty value crashes the entire build before it even gets to run.
SECRET_KEY = env("SECRET_KEY", default=_FALLBACK_SECRET_KEY) or _FALLBACK_SECRET_KEY
DEBUG = env.bool("DEBUG", default=True)
ALLOWED_HOSTS = env.list("ALLOWED_HOSTS", default=["*"])

# --- Vercel (demo hosting) ---
# Vercel terminates TLS in front of the app and proxies over HTTP, and sets
# VERCEL_URL (current deployment) / VERCEL_PROJECT_PRODUCTION_URL (stable
# production domain) automatically. Django 4+ requires an exact-origin
# allowlist for CSRF (separate from ALLOWED_HOSTS), so without this, POSTing
# to /admin/login/ (or any session-authenticated form) on a *.vercel.app
# domain fails with "CSRF verification failed".
if os.environ.get("VERCEL"):
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
DATABASES = {
    "default": env.db(
        "DATABASE_URL",
        default=f"sqlite:///{BASE_DIR / 'db.sqlite3'}",
    )
}

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
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"},
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
CORS_ALLOW_CREDENTIALS = True

# --- AutoZap business settings (defaults, overridable in Settings model) ---
AUTOZAP_DEFAULT_MIN_STOCK = 5
AUTOZAP_SELLER_DISCOUNT_LIMIT_PERCENT = 10
AUTOZAP_CURRENCY = "KZT"

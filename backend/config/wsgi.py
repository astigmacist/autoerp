"""
WSGI config for config project.

It exposes the WSGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/5.0/howto/deployment/wsgi/
"""

import os

from django.core.wsgi import get_wsgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

application = get_wsgi_application()

# On Vercel there is no build-time hook to run `migrate` (and no persistent
# disk / server to SSH into and run it by hand), so we run it once per cold
# start here instead. Both `migrate` and `seed_demo` are idempotent, so this
# is a cheap no-op on every warm/subsequent instance. Wrapped defensively so
# a migration hiccup logs instead of taking the whole app down.
if os.environ.get("VERCEL"):
    import logging

    from django.core.management import call_command

    logger = logging.getLogger("autozap.startup")
    try:
        call_command("migrate", interactive=False, verbosity=0)
        if os.environ.get("AUTOZAP_SEED_DEMO", "1") == "1":
            call_command("seed_demo", verbosity=0)
    except Exception:
        logger.exception("Startup migrate/seed_demo failed")

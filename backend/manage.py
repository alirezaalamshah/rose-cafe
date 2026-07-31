#!/usr/bin/env python
"""Django's command-line utility for administrative tasks."""
import os
import sys


def main():
    """Run administrative tasks."""
    # os.environ به‌تنهایی فایل .env را نمی‌بیند (آن فقط داخل settings از طریق
    # decouple خوانده می‌شود) — برای دستورات دستی (migrate/collectstatic/...) روی
    # هاست باید همین‌جا هم صریح از .env بخوانیم، وگرنه همیشه dev پیش‌فرض لود می‌شود.
    try:
        from decouple import config
        default_settings = config('DJANGO_SETTINGS_MODULE', default='config.settings.dev')
    except ImportError:
        default_settings = 'config.settings.dev'
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', default_settings)
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Couldn't import Django. Are you sure it's installed and "
            "available on your PYTHONPATH environment variable? Did you "
            "forget to activate a virtual environment?"
        ) from exc
    execute_from_command_line(sys.argv)


if __name__ == '__main__':
    main()

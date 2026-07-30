"""
نقطه‌ی ورود WSGI مخصوص cPanel (Phusion Passenger) — هنگام «Setup Python App»
مسیر این فایل را به‌عنوان Application startup file معرفی کن.
"""
import os

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.prod')

from config.wsgi import application  # noqa: E402

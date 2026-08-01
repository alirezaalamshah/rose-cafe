"""
نقطه‌ی ورود WSGI مخصوص cPanel (Phusion Passenger) — هنگام «Setup Python App»
مسیر این فایل را به‌عنوان Application startup file معرفی کن.
"""
import os

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.prod')

from config.wsgi import application as _django_application  # noqa: E402


def application(environ, start_response):
    # PassengerBaseURI "/api" این اپ را روی /api مونت می‌کند و همان پیشوند را
    # از PATH_INFO حذف می‌کند؛ ولی urls.py خودمان با پیشوند api/ نوشته شده
    # (تا در دولوپمنت لوکال بدون Passenger هم همان‌طور کار کند). این تابع
    # پیشوند حذف‌شده را قبل از رسیدن به جنگو برمی‌گرداند.
    environ['SCRIPT_NAME'] = ''
    path_info = environ.get('PATH_INFO', '')
    if not path_info.startswith('/api'):
        environ['PATH_INFO'] = '/api' + path_info
    return _django_application(environ, start_response)

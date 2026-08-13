from .base import *
from typing import cast

DEBUG = False
# روی هاست باید در .env مقداردهی شود؛ مثال: ALLOWED_HOSTS=example.com,www.example.com
ALLOWED_HOSTS = [h for h in cast(str, config('ALLOWED_HOSTS', default='')).split(',') if h]

# مسیرهای media/static از base.py (نسبت به BASE_DIR) استفاده می‌شوند — مسیر کانتینری
# مخصوص Liara قبلاً این‌جا override شده بود که روی هاست اشتراکی معنا نداشت.

# برخلاف mysqlclient، PyMySQL برای HOST='localhost' خودکار سراغ Unix socket نمی‌رود
# و واقعاً TCP امتحان می‌کند — روی هاست‌های اشتراکی که فقط socket فعال است باید صریح بدهیم
_mysql_options = {'charset': 'utf8mb4', 'init_command': "SET sql_mode='STRICT_TRANS_TABLES'"}
_db_socket = config('DB_SOCKET', default='')
if _db_socket:
    _mysql_options['unix_socket'] = _db_socket

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.mysql',
        'NAME': config('DB_NAME', default=''),
        'USER': config('DB_USER', default=''),
        'PASSWORD': config('DB_PASSWORD', default=''),
        'HOST': config('DB_HOST', default='localhost'),
        'PORT': config('DB_PORT', default='3306'),
        'OPTIONS': _mysql_options,
        'CONN_MAX_AGE': config('CONN_MAX_AGE', default=60, cast=int),
    }
}

# روی هاست باید در .env مقداردهی شود؛ مثال: CORS_ALLOWED_ORIGINS=https://example.com,https://www.example.com
CORS_ALLOWED_ORIGINS = [o for o in cast(str, config('CORS_ALLOWED_ORIGINS', default='')).split(',') if o]
CORS_ALLOW_CREDENTIALS = True

# WhiteNoise برای static files ادمین Django
MIDDLEWARE.insert(2, 'whitenoise.middleware.WhiteNoiseMiddleware')

# Cache: اگر REDIS_URL تنظیم نشده باشد از DatabaseCache استفاده می‌کند.
# LocMemCache عمداً استفاده نمی‌شود — Passenger چند پردازش (worker) جدا اجرا می‌کند
# و LocMemCache فقط داخل حافظه‌ی همان یک پردازش معتبر است، پس مثلاً کد OTP که در یک
# پردازش ذخیره شده، در پردازشی که درخواست تایید را می‌گیرد اصلاً دیده نمی‌شود.
# DatabaseCache روی جدولی در همان MySQL مشترک بین همه‌ی پردازش‌ها کار می‌کند.
REDIS_URL = config('REDIS_URL', default='')
if REDIS_URL:
    CACHES = {
        'default': {
            'BACKEND': 'django.core.cache.backends.redis.RedisCache',
            'LOCATION': REDIS_URL,
        }
    }
else:
    CACHES = {
        'default': {
            'BACKEND': 'django.core.cache.backends.db.DatabaseCache',
            'LOCATION': 'django_cache_table',
        }
    }

SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = 'DENY'

# پیش‌فرض True (چون هاست‌های cPanel معمولاً SSL رایگان AutoSSL دارند)؛ اگر گواهی SSL
# هنوز صادر نشده، موقتاً در .env مقدار SECURE_SSL_REDIRECT=False بگذار
SECURE_SSL_REDIRECT = config('SECURE_SSL_REDIRECT', default=True, cast=bool)
SESSION_COOKIE_SECURE = config('SECURE_SSL_REDIRECT', default=True, cast=bool)
CSRF_COOKIE_SECURE = config('SECURE_SSL_REDIRECT', default=True, cast=bool)

# لاگ‌های خود اپ (apps.*) — قبلاً هیچ‌جا ذخیره نمی‌شدند چون root/django روی سطح ERROR
# بودند و پیام‌های logger.info() (مثل پاسخ زرین‌پال یا وضعیت پیامک) کلاً حذف می‌شدند.
# این فایل توسط .htaccess (بلاک کردن پسوند .log) از دسترسی عمومی محفوظ است.
LOG_DIR = BASE_DIR / 'logs'
LOG_DIR.mkdir(parents=True, exist_ok=True)

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '{asctime} {levelname} {name}: {message}',
            'style': '{',
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',
        },
        'app_file': {
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': str(LOG_DIR / 'app.log'),
            'maxBytes': 5 * 1024 * 1024,
            'backupCount': 3,
            'formatter': 'verbose',
        },
    },
    'root': {
        'handlers': ['console'],
        'level': 'ERROR',
    },
    'loggers': {
        'django': {
            'handlers': ['console'],
            'level': 'ERROR',
            'propagate': False,
        },
        'apps': {
            'handlers': ['console', 'app_file'],
            'level': 'INFO',
            'propagate': False,
        },
    },
}

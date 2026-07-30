from .base import *
from typing import cast

DEBUG = False
# روی هاست باید در .env مقداردهی شود؛ مثال: ALLOWED_HOSTS=example.com,www.example.com
ALLOWED_HOSTS = [h for h in cast(str, config('ALLOWED_HOSTS', default='')).split(',') if h]

# مسیرهای media/static از base.py (نسبت به BASE_DIR) استفاده می‌شوند — مسیر کانتینری
# مخصوص Liara قبلاً این‌جا override شده بود که روی هاست اشتراکی معنا نداشت.

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.mysql',
        'NAME': config('DB_NAME', default=''),
        'USER': config('DB_USER', default=''),
        'PASSWORD': config('DB_PASSWORD', default=''),
        'HOST': config('DB_HOST', default='localhost'),
        'PORT': config('DB_PORT', default='3306'),
        'OPTIONS': {'charset': 'utf8mb4'},
        'CONN_MAX_AGE': config('CONN_MAX_AGE', default=60, cast=int),
    }
}

# روی هاست باید در .env مقداردهی شود؛ مثال: CORS_ALLOWED_ORIGINS=https://example.com,https://www.example.com
CORS_ALLOWED_ORIGINS = [o for o in cast(str, config('CORS_ALLOWED_ORIGINS', default='')).split(',') if o]
CORS_ALLOW_CREDENTIALS = True

# WhiteNoise برای static files ادمین Django
MIDDLEWARE.insert(2, 'whitenoise.middleware.WhiteNoiseMiddleware')

# Cache: اگر REDIS_URL تنظیم نشده باشد از memory cache استفاده می‌کند
REDIS_URL = config('REDIS_URL', default='')
if REDIS_URL:
    CACHES = {
        'default': {
            'BACKEND': 'django.core.cache.backends.redis.RedisCache',
            'LOCATION': REDIS_URL,
        }
    }
    CELERY_BROKER_URL = REDIS_URL
else:
    CACHES = {
        'default': {
            'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
        }
    }
    CELERY_BROKER_URL = 'memory://'

SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = 'DENY'

# پیش‌فرض True (چون هاست‌های cPanel معمولاً SSL رایگان AutoSSL دارند)؛ اگر گواهی SSL
# هنوز صادر نشده، موقتاً در .env مقدار SECURE_SSL_REDIRECT=False بگذار
SECURE_SSL_REDIRECT = config('SECURE_SSL_REDIRECT', default=True, cast=bool)
SESSION_COOKIE_SECURE = config('SECURE_SSL_REDIRECT', default=True, cast=bool)
CSRF_COOKIE_SECURE = config('SECURE_SSL_REDIRECT', default=True, cast=bool)

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
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
    },
}

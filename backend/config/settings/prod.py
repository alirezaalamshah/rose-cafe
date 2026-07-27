from .base import *
from typing import cast

DEBUG = False
ALLOWED_HOSTS = cast(str, config('ALLOWED_HOSTS', default='api.rccoffee.ir')).split(',')

MEDIA_ROOT = '/app/media'
MEDIA_URL = '/media/'

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': config('DB_NAME', default=''),
        'USER': config('DB_USER', default=''),
        'PASSWORD': config('DB_PASSWORD', default=''),
        'HOST': config('DB_HOST', default=''),
        'PORT': config('DB_PORT', default='5432'),
        'CONN_MAX_AGE': config('CONN_MAX_AGE', default=60, cast=int),
    }
}

CORS_ALLOWED_ORIGINS = [
    'https://rccoffee.ir',
    'https://www.rccoffee.ir',
    'https://rccoffee.liara.run',
]
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

# C:\Users\hp\Desktop\Web App\cafe-project\backend\config\settings\dev.py

from .base import *

DEBUG = True
ALLOWED_HOSTS = ['*']

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': 'cafe_db',
        'USER': 'cafe_user',
        'PASSWORD': 'cafe_pass',
        'HOST': 'localhost',
        'PORT': '5432',
    }
}

CORS_ALLOW_ALL_ORIGINS = True

# ایمیل در ترمینال نشون میده (برای تست)
EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'

CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
    }
}
# C:\Users\hp\Desktop\Web App\cafe-project\backend\config\settings\prod.py

from .base import *
import os
from typing import cast

DEBUG = False
ALLOWED_HOSTS = cast(str, config('ALLOWED_HOSTS', default='')).split(',')

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': config('DB_NAME'),
        'USER': config('DB_USER'),
        'PASSWORD': config('DB_PASSWORD'),
        'HOST': config('DB_HOST'),
        'PORT': config('DB_PORT', default='5432'),
    }
}

CORS_ALLOWED_ORIGINS = cast(str, config('CORS_ORIGINS', default='')).split(',')

SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = 'DENY'
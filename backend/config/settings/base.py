# C:\Users\hp\Desktop\Web App\cafe-project\backend\config\settings\base.py

from decouple import config
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent.parent

SECRET_KEY = config('SECRET_KEY', default='django-insecure-build-phase-placeholder-override-in-production')

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    # Third party
    'rest_framework',
    'rest_framework_simplejwt',
    'corsheaders',
    'drf_spectacular',
    'phonenumber_field',
    'django_filters',
    'dbbackup',
    # Local apps
    'apps.accounts.apps.AccountsConfig',
    'apps.menu.apps.MenuConfig',
    'apps.orders.apps.OrdersConfig',
    'apps.payments.apps.PaymentsConfig',
    'apps.reservations.apps.ReservationsConfig',
    'apps.reviews.apps.ReviewsConfig',
    'apps.discounts.apps.DiscountsConfig',
    'apps.notifications.apps.NotificationsConfig',
    'apps.business.apps.BusinessConfig',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.middleware.gzip.GZipMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'

AUTH_USER_MODEL = 'accounts.User'

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LANGUAGE_CODE = 'fa-ir'
TIME_ZONE = 'Asia/Tehran'
USE_I18N = True
USE_TZ = True

STATIC_URL = '/api/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
MEDIA_URL = '/api/media/'
MEDIA_ROOT = BASE_DIR / 'media'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# DRF
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticatedOrReadOnly',
    ),
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
    # محدودیت نرخ روی OTP/ورود — جلوگیری از اسپم پیامکی (هزینه‌ی مالی مستقیم روی ملی‌پیامک)
    # و brute-force رمز عبور/کد OTP. کلید هر throttle در throttles.py مشخص شده.
    'DEFAULT_THROTTLE_RATES': {
        'otp_send': '3/hour',
        'otp_send_ip': '10/hour',
        'otp_verify': '5/min',
        'login': '5/min',
    },
}

# JWT
from datetime import timedelta
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(days=1),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=30),
    'ROTATE_REFRESH_TOKENS': True,
}

# Spectacular (Swagger)
SPECTACULAR_SETTINGS = {
    'TITLE': 'Cafe API',
    'DESCRIPTION': 'API مدیریت کافه',
    'VERSION': '1.0.0',
}

# Cache (Redis)
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.redis.RedisCache',
        'LOCATION': config('REDIS_URL', default='redis://localhost:6379/0'),
    }
}

# OTP Settings
OTP_EXPIRY_SECONDS = 120
OTP_LENGTH = 6
# کد ثابت تست — فقط در DEBUG کار می‌کند، در production خالی بگذارید
OTP_TEST_CODE = config('OTP_TEST_CODE', default='')

# Melipayamak — Console API (توکن جدید)
MELIPAYAMAK_API_TOKEN = config('MELIPAYAMAK_API_TOKEN', default='')
MELIPAYAMAK_FROM = config('MELIPAYAMAK_FROM', default='')
# اعتبارات قدیمی (فقط fallback)
MELIPAYAMAK_USERNAME = config('MELIPAYAMAK_USERNAME', default='')
MELIPAYAMAK_PASSWORD = config('MELIPAYAMAK_PASSWORD', default='')

# پیامک‌های غیر-OTP (تغییر وضعیت سفارش، تایید رزرو و ...) موقتاً خاموش هستند
# تا نقشه‌ی درست محتوا/زمان ارسالشان طراحی شود. OTP از این فلگ تأثیر نمی‌گیرد.
SMS_NOTIFICATIONS_ENABLED = config('SMS_NOTIFICATIONS_ENABLED', default=False, cast=bool)

# Zarinpal
ZARINPAL_MERCHANT = config('ZARINPAL_MERCHANT', default='')
ZARINPAL_SANDBOX = config('ZARINPAL_SANDBOX', default=True, cast=bool)
ZARINPAL_CALLBACK_URL = config('ZARINPAL_CALLBACK_URL', default='http://localhost:5173/payment/callback')

# بک‌آپ خودکار دیتابیس (django-dbbackup) — فایل‌سیستم محلی به‌عنوان مقصد پیش‌فرض
# (روی هاست اشتراکی هدف هم دیسک معمولی است، نه سرویس خارجی). با pg_dump/mysqldump کار می‌کند
# و بین دو موتور دیتابیس (Postgres فعلی، MySQL بعد از مهاجرت) بدون تغییر کد قابل استفاده است.
# چون STORAGES را صریح تعریف می‌کنیم، باید default/staticfiles پیش‌فرض جنگو را هم این‌جا نگه داریم.
STORAGES = {
    'default': {'BACKEND': 'django.core.files.storage.FileSystemStorage'},
    'staticfiles': {'BACKEND': 'django.contrib.staticfiles.storage.StaticFilesStorage'},
    'dbbackup': {
        'BACKEND': 'django.core.files.storage.FileSystemStorage',
        'OPTIONS': {'location': config('DBBACKUP_LOCATION', default=str(BASE_DIR / 'backups'))},
    },
}
# نگه‌داشتن ۱۴ بک‌آپ آخر (با اجرای روزانه یعنی ~۲ هفته) — قدیمی‌تر با --clean پاک می‌شود
DBBACKUP_CLEANUP_KEEP = config('DBBACKUP_CLEANUP_KEEP', default=14, cast=int)
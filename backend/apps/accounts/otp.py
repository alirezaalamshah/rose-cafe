import random
import string
from django.core.cache import cache
from django.conf import settings


def generate_otp(length: int | None = None) -> str:
    length = length or settings.OTP_LENGTH
    return ''.join(random.choices(string.digits, k=length))


def save_otp(phone: str, otp: str) -> None:
    key = f'otp_{phone}'
    expiry = getattr(settings, 'OTP_EXPIRY_SECONDS', 120)
    cache.set(key, otp, timeout=expiry)


def verify_otp(phone: str, otp: str) -> bool:
    # کد ثابت تست — فقط در حالت DEBUG و اگر OTP_TEST_CODE تنظیم شده باشد
    test_code = getattr(settings, 'OTP_TEST_CODE', '')
    if settings.DEBUG and test_code and otp == test_code:
        return True

    key = f'otp_{phone}'
    cached = cache.get(key)
    if cached and cached == otp:
        cache.delete(key)
        return True
    return False


def get_otp_ttl(phone: str) -> int:
    key = f'otp_{phone}'
    # از get_or_set استفاده نمیکنیم، فقط ttl رو چک میکنیم
    try:
        from django.core.cache.backends.redis import RedisCache
        if isinstance(cache, RedisCache):
            return cache.get_backend_timeout(key) or 0  # type: ignore[attr-defined]
    except Exception:
        pass
    return 0
"""
کمک‌کننده‌های عمومی مشترک بین اپ‌ها.
"""
import datetime
import math
from django.utils import timezone

EARTH_RADIUS_KM = 6371.0


def haversine_distance_km(lat1, lng1, lat2, lng2) -> float:
    """فاصله‌ی خط مستقیم (نه فاصله‌ی واقعی مسیر) بین دو مختصات جغرافیایی، به کیلومتر —
    برای چک محدوده‌ی مجاز ثبت آدرس (تا کاربر از شهر/منطقه‌ای خیلی دور سفارش ثبت نکند)."""
    lat1, lng1, lat2, lng2 = map(float, (lat1, lng1, lat2, lng2))
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lng2 - lng1)
    a = math.sin(d_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return EARTH_RADIUS_KM * c


def local_day_range(date_value):
    """
    بازه‌ی UTC معادل یک «روز کامل» به‌وقت محلی (settings.TIME_ZONE) را برمی‌گرداند:
    (start_utc_inclusive, end_utc_exclusive).

    برای فیلتر بر اساس روز، این را به‌جای lookup مستقیم `created_at__date=X` استفاده کن.
    آن lookup روی MySQL به `CONVERT_TZ(created_at, 'UTC', 'Asia/Tehran')` ترجمه می‌شود
    که به جدول‌های tzinfo سمت سرور نیاز دارد؛ روی هاست‌هایی که این جدول‌ها بارگذاری
    نشده‌اند (خیلی از هاست‌های اشتراکی، و نصب‌های محلی/پرتابل) CONVERT_TZ همیشه NULL
    برمی‌گرداند و فیلتر هیچ ردیفی را match نمی‌کند — صرف‌نظر از تاریخ درخواستی.
    محاسبه‌ی بازه در پایتون (نه در SQL) این وابستگی را کاملاً حذف می‌کند.

    date_value: رشته‌ی 'YYYY-MM-DD' یا datetime.date
    """
    if isinstance(date_value, str):
        date_value = datetime.date.fromisoformat(date_value)
    start = timezone.make_aware(datetime.datetime.combine(date_value, datetime.time.min))
    end = start + datetime.timedelta(days=1)
    return start, end

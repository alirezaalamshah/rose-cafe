"""
کمک‌کننده‌های عمومی مشترک بین اپ‌ها.
"""
import datetime
from django.utils import timezone


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

"""
پردازش عکس‌های آپلودی: چرخش صحیح بر اساس EXIF، حذف EXIF، تغییر اندازه و تبدیل به WebP.
همه‌جا که مدل‌ها عکس دارند (منو، دسته‌بندی، بنر، آواتار) از همین توابع استفاده می‌شود
تا این پردازش یک‌بار و یکسان انجام شود.
"""
import os
from io import BytesIO

from django.core.files.base import ContentFile
from rest_framework import serializers
from PIL import Image, ImageOps

MAIN_MAX_DIMENSION = 1600
THUMB_MAX_DIMENSION = 300
QUALITY = 80
MAX_UPLOAD_SIZE = 5 * 1024 * 1024  # ۵ مگابایت — هم‌راستا با محدودیت فرانت


def validate_image_size(uploaded_file):
    """اعتبارسنجی حجم آپلود سمت سرور — چون محدودیت فرانت به‌تنهایی قابل دور زدن است."""
    if uploaded_file and uploaded_file.size > MAX_UPLOAD_SIZE:
        raise serializers.ValidationError('حجم تصویر نباید بیشتر از ۵ مگابایت باشد')
    return uploaded_file


def _load_image(uploaded_file, draft_size=MAIN_MAX_DIMENSION):
    image = Image.open(uploaded_file)
    # draft: به Pillow اجازه می‌دهد JPEGهای خیلی بزرگ (مثلاً عکس ۴۸ مگاپیکسلی گوشی) را در حین
    # دیکود خود (نه بعدش) تقریبی کوچک کند — چون هدف نهایی resize است، این کار دیکود را چند برابر
    # سریع‌تر می‌کند بدون افت کیفیت محسوس در خروجی نهایی که خودش resize می‌شود.
    if hasattr(image, 'draft'):
        image.draft('RGB', (draft_size, draft_size))
    # چرخش واقعی بر اساس تگ Orientation در EXIF — باید قبل از حذف EXIF انجام شود
    # وگرنه عکس‌های عمودی گرفته‌شده با گوشی کج/افقی ذخیره می‌شوند
    image = ImageOps.exif_transpose(image)
    if image.mode == 'P':
        image = image.convert('RGBA' if 'transparency' in image.info else 'RGB')
    elif image.mode not in ('RGB', 'RGBA'):
        image = image.convert('RGB')
    return image


def _encode_webp(image, max_dimension, quality=QUALITY):
    resized = image.copy()
    resized.thumbnail((max_dimension, max_dimension), Image.LANCZOS)
    buffer = BytesIO()
    # method=4 (نه ۶): چند برابر سریع‌تر برای انکود روی هاست اشتراکی کم‌منبع، با افت کیفیت/حجم ناچیز
    # (روی هاست فعلی Celery/background worker نیست، پس این پردازش سینک روی خود ریکوئست ادمین اجرا می‌شود)
    resized.save(buffer, format='WEBP', quality=quality, method=4)
    buffer.seek(0)
    return buffer


def process_image(uploaded_file, *, max_dimension=MAIN_MAX_DIMENSION, quality=QUALITY, base_name=None):
    """
    عکس آپلودشده را چرخش صحیح، فشرده‌سازی و به WebP تبدیل می‌کند.
    خروجی: (ContentFile آماده برای انتساب به ImageField, تصویر PIL پردازش‌شده برای استفاده مجدد)
    """
    image = _load_image(uploaded_file)
    buffer = _encode_webp(image, max_dimension, quality)
    name = os.path.splitext(base_name or getattr(uploaded_file, 'name', 'image'))[0] + '.webp'
    return ContentFile(buffer.read(), name=name), image


def process_image_with_thumbnail(
    uploaded_file, *, max_dimension=MAIN_MAX_DIMENSION,
    thumb_dimension=THUMB_MAX_DIMENSION, quality=QUALITY, base_name=None,
):
    """مثل process_image ولی یک نسخه‌ی کوچک (thumbnail) هم برمی‌گرداند."""
    main_file, image = process_image(
        uploaded_file, max_dimension=max_dimension, quality=quality, base_name=base_name,
    )
    thumb_buffer = _encode_webp(image, thumb_dimension, quality)
    thumb_name = os.path.splitext(base_name or getattr(uploaded_file, 'name', 'image'))[0] + '_thumb.webp'
    thumb_file = ContentFile(thumb_buffer.read(), name=thumb_name)
    return main_file, thumb_file

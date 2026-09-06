"""منطق سطح‌بالای ارسال سفارش به پیک — لایه‌ی بین view های سفارش (دستی/خودکار) و
کلاینت خام API (client.py). idempotent: اگر سفارش از قبل SnappCourierOrder موفق
دارد (وضعیتی غیر از CANCELLED/FAILED)، دوباره ارسال نمی‌شود.
"""
import logging
from datetime import timedelta
from django.utils import timezone

from .models import SnappSettings, SnappCourierOrder, SnappFailureLog
from . import client

logger = logging.getLogger(__name__)


class DispatchError(Exception):
    def __init__(self, message):
        self.message = message
        super().__init__(message)


def _record_failure(message: str) -> None:
    """هر خطای واقعی ارسال را ثبت می‌کند و اگر تعداد خطاهای پیاپی در بازه‌ی زمانی
    تنظیم‌شده از سقف مجاز گذشت، یکپارچه‌سازی را خودکار موقتاً غیرفعال می‌کند
    (circuit breaker) — تا از تلاش‌های ناموفق پیاپی (مثلاً وقتی API اسنپ‌باکس یا
    توکن مشکل دارد) به کاربر واقعی آسیب نرسد."""
    SnappFailureLog.objects.create(message=message[:255])

    settings_obj = SnappSettings.get_settings()
    if settings_obj.circuit_breaker_tripped:
        return

    window_start = timezone.now() - timedelta(minutes=settings_obj.circuit_breaker_window_minutes)
    recent_failures = SnappFailureLog.objects.filter(created_at__gte=window_start).count()
    if recent_failures >= settings_obj.circuit_breaker_max_failures:
        settings_obj.trip_circuit_breaker()
        logger.error(
            'یکپارچه‌سازی اسنپ‌باکس به‌خاطر %s خطای پیاپی در %s دقیقه‌ی اخیر خودکار غیرفعال شد',
            recent_failures, settings_obj.circuit_breaker_window_minutes,
        )


def dispatch_order(order) -> SnappCourierOrder:
    """سفارش را به اسنپ‌باکس می‌فرستد و رکورد SnappCourierOrder را می‌سازد/آپدیت می‌کند.
    خطا: DispatchError با پیام قابل‌نمایش به ادمین."""
    from apps.orders.models import Order

    settings_obj = SnappSettings.get_settings()
    if not settings_obj.is_enabled:
        raise DispatchError('یکپارچه‌سازی با اسنپ‌باکس غیرفعال است')
    if settings_obj.circuit_breaker_tripped:
        raise DispatchError(
            'یکپارچه‌سازی با اسنپ‌باکس به‌خاطر چند خطای پیاپی موقتاً غیرفعال شده — '
            'از تنظیمات، وضعیت اتصال را بررسی و در صورت رفع مشکل دوباره فعال کنید'
        )
    if not settings_obj.store_ready:
        raise DispatchError('آدرس/مختصات مبدا (کافه) در تنظیمات اسنپ‌باکس تکمیل نشده است')
    if order.delivery_type != Order.DeliveryType.DELIVERY:
        raise DispatchError('این سفارش از نوع ارسال با پیک نیست')
    if not order.address:
        raise DispatchError('سفارش آدرس تحویل ندارد')
    if not order.address.latitude or not order.address.longitude:
        raise DispatchError('آدرس این سفارش روی نقشه مشخص نشده — مشتری باید موقعیت را از پروفایل خود انتخاب کند')

    existing = getattr(order, 'snapp_courier', None)
    if existing and existing.status not in SnappCourierOrder.RETRYABLE_STATUSES:
        raise DispatchError('این سفارش قبلاً به پیک ارسال شده است')

    result = client.create_order(order, settings_obj)
    if not result['success']:
        _record_failure(result['message'])
        raise DispatchError(result['message'])

    data = result['data']
    defaults = {
        'snapp_order_id': str(data.get('id', '')),
        'status': data.get('status') or SnappCourierOrder.Status.PENDING,
        'tracking_url': data.get('trackingUrl') or '',
        'raw_last_response': data,
        'dispatched_at': timezone.now(),
        # این فیلدها فقط با یک ارسال تازه پاک می‌شوند — نتیجه‌ی تلاش قبلی روی رکورد نماند
        'cancel_reason': '',
        'current_latitude': '', 'current_longitude': '', 'location_updated_at': None,
    }
    if existing:
        defaults['retry_count'] = existing.retry_count + 1
        for key, value in defaults.items():
            setattr(existing, key, value)
        existing.save()
        return existing
    return SnappCourierOrder.objects.create(order=order, **defaults)


def cancel_courier_order(courier_order: SnappCourierOrder, reason: str = '') -> None:
    if not courier_order.snapp_order_id:
        raise DispatchError('این سفارش هنوز شناسه‌ی اسنپ‌باکس ندارد')
    result = client.cancel_order(courier_order.snapp_order_id)
    if not result['success']:
        raise DispatchError(result.get('message', 'لغو ناموفق بود'))
    courier_order.status = SnappCourierOrder.Status.CANCELLED
    if reason:
        courier_order.cancel_reason = reason
    courier_order.save(update_fields=['status', 'cancel_reason'])


def maybe_cancel_on_order_termination(order) -> None:
    """وقتی خود سفارش کافه لغو/رد می‌شود، اگر پیک فعالی برایش ثبت شده، آن هم خودکار
    لغو می‌شود — بدون این، پیک همچنان در حال حرکت به سمت سفارشی است که دیگر وجود
    خارجی ندارد. خطا را می‌بلعد (فقط لاگ) چون این تابع از فلوی تغییر وضعیت سفارش
    صدا زده می‌شود و نباید آن را fail کند."""
    courier_order = getattr(order, 'snapp_courier', None)
    if not courier_order or courier_order.is_terminal:
        return
    try:
        cancel_courier_order(courier_order, reason='سفارش کافه لغو/رد شد')
        logger.info('پیک سفارش #%s به‌خاطر لغو/رد خود سفارش، خودکار لغو شد', order.order_number)
    except DispatchError as e:
        logger.warning('لغو خودکار پیک سفارش #%s ناموفق بود: %s', order.order_number, e.message)


def maybe_auto_dispatch(order, trigger: str) -> None:
    """trigger یکی از 'confirm' یا 'ready' است — فقط اگر dispatch_mode با trigger فعلی
    مطابقت داشته باشد، ارسال خودکار انجام می‌شود. خطاها فقط لاگ می‌شوند (لاگ‌شده نه
    raise) چون این تابع از داخل فلوی تغییر وضعیت سفارش صدا زده می‌شود و نباید کل
    درخواست تغییر وضعیت را به‌خاطر خطای اسنپ‌باکس fail کند."""
    settings_obj = SnappSettings.get_settings()
    if not settings_obj.is_enabled:
        return
    from apps.orders.models import Order
    if order.delivery_type != Order.DeliveryType.DELIVERY:
        return

    wants_confirm = settings_obj.dispatch_mode == SnappSettings.DispatchMode.AUTO_ON_CONFIRM and trigger == 'confirm'
    wants_ready = settings_obj.dispatch_mode == SnappSettings.DispatchMode.AUTO_ON_READY and trigger == 'ready'
    if not (wants_confirm or wants_ready):
        return

    try:
        dispatch_order(order)
    except DispatchError as e:
        logger.warning('ارسال خودکار سفارش #%s به پیک ناموفق بود: %s', order.order_number, e.message)
    except Exception:
        logger.exception('خطای غیرمنتظره در ارسال خودکار سفارش #%s به پیک', order.order_number)


def refresh_current_location(courier_order: SnappCourierOrder) -> SnappCourierOrder:
    """موقعیت لحظه‌ای پیک را از اسنپ‌باکس می‌گیرد و روی رکورد ذخیره می‌کند — فقط
    برای وضعیت‌های قابل‌رهگیری (ACCEPTED/PICKED_UP) صدا زده شود؛ فراخوان (view)
    مسئول این چک است تا این تابع صرفاً یک عملیات خام بماند."""
    result = client.get_current_location(courier_order.snapp_order_id)
    if result['success']:
        courier_order.current_latitude = str(result['latitude'])
        courier_order.current_longitude = str(result['longitude'])
        courier_order.location_updated_at = timezone.now()
        courier_order.save(update_fields=['current_latitude', 'current_longitude', 'location_updated_at'])
    return courier_order


def list_delivery_categories(settings_obj: SnappSettings) -> dict:
    """دسته‌بندی‌های واقعاً فعال برای مبدای کافه — برای پر کردن یک لیست انتخابی
    (نه متن آزاد) در تنظیمات ادمین."""
    if not settings_obj.store_latitude or not settings_obj.store_longitude:
        return {'success': False, 'message': 'ابتدا موقعیت مبدا (کافه) را روی نقشه مشخص کنید'}
    return client.get_delivery_categories(settings_obj.store_latitude, settings_obj.store_longitude)

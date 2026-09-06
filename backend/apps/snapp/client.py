"""کلاینت API اسنپ‌باکس (B2B) — ثبت/لغو سفارش پیک و گرفتن توکن.
مستندات: https://docs.snapp-box.com — همان الگوی apps/payments/zarinpal.py
(تابع‌های ساده، بدون کلاس، خطاها به‌صورت dict خوانا برگردانده می‌شوند، نه exception).
"""
import time
import logging
import requests
from django.conf import settings
from django.core.cache import cache

logger = logging.getLogger(__name__)

TOKEN_CACHE_KEY = 'snapp:access_token'


def _base_url() -> str:
    return settings.SNAPP_BOX_BASE_URL


def get_access_token() -> str | None:
    """توکن را کش می‌کند (کمی کوتاه‌تر از expires_in واقعی، برای اطمینان از تازه بودن)."""
    cached = cache.get(TOKEN_CACHE_KEY)
    if cached:
        return cached

    if not settings.SNAPP_BOX_CLIENT_ID or not settings.SNAPP_BOX_CLIENT_SECRET:
        logger.error('SNAPP_BOX_CLIENT_ID/SECRET تنظیم نشده است')
        return None

    try:
        response = requests.post(
            f'{_base_url()}/v1/oauth2/token',
            json={
                'client_id': settings.SNAPP_BOX_CLIENT_ID,
                'client_secret': settings.SNAPP_BOX_CLIENT_SECRET,
            },
            headers={'Accept': 'application/json', 'Content-Type': 'application/json'},
            timeout=15,
        )
        data = response.json()
        token = data.get('access_token')
        if not token:
            logger.error('دریافت توکن اسنپ‌باکس ناموفق بود: %s', data)
            return None

        expires_in = data.get('expires_in', 3600)
        cache.set(TOKEN_CACHE_KEY, token, max(int(expires_in) - 60, 60))
        return token
    except requests.exceptions.Timeout:
        logger.error('زمان اتصال به اسنپ‌باکس (oauth2/token) به پایان رسید')
        return None
    except Exception:
        logger.exception('خطا در دریافت توکن اسنپ‌باکس')
        return None


def _headers() -> dict | None:
    token = get_access_token()
    if not token:
        return None
    return {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {token}',
    }


def build_order_payload(order, settings_obj) -> dict:
    """Order مدل داخلی ما را به بدنه‌ی POST /v1/orders اسنپ‌باکس تبدیل می‌کند."""
    address = order.address
    items = []
    for item in order.items.all():
        items.append({
            'name': item.menu_item.name + (f' ({item.variant_name})' if item.variant_name else ''),
            'packageValue': item.subtotal,
            'quantity': item.quantity,
            'quantityMeasuringUnit': 'عدد',
        })

    return {
        'city': settings_obj.store_city,
        'deliveryCategory': settings_obj.default_delivery_category,
        'paymentType': 'prepaid',
        'refId': order.order_number,
        'podEnabled': False,
        'popEnabled': False,
        'terminals': [
            {
                'type': 'pickup',
                'reference': '1',
                'address': settings_obj.store_address,
                'latitude': settings_obj.store_latitude,
                'longitude': settings_obj.store_longitude,
                'contactName': settings_obj.store_contact_name,
                'phoneNumber': settings_obj.store_contact_phone,
            },
            {
                'type': 'dropoff',
                'reference': '2',
                'address': address.detail or f'{address.city}, {address.street}' if address else '',
                'latitude': getattr(address, 'latitude', '') or '',
                'longitude': getattr(address, 'longitude', '') or '',
                'contactName': order.user.full_name or str(order.user.phone),
                'phoneNumber': str(order.user.phone),
                'customerRefId': order.order_number,
            },
        ],
        'packages': [{
            'pickupReference': '1',
            'dropoffReference': '2',
            'items': items,
        }],
    }


def create_order(order, settings_obj) -> dict:
    """سفارش پیک جدید می‌سازد. موفق: {'success': True, 'data': {...}}."""
    headers = _headers()
    if not headers:
        return {'success': False, 'message': 'اتصال به اسنپ‌باکس برقرار نشد (توکن نامعتبر)'}

    payload = build_order_payload(order, settings_obj)
    try:
        response = requests.post(f'{_base_url()}/v1/orders', json=payload, headers=headers, timeout=20)
        data = response.json()
        logger.info('Snapp create_order response: %s', data)

        if response.status_code == 201 and data.get('id'):
            return {'success': True, 'data': data}
        return {'success': False, 'message': data.get('message') or 'ثبت سفارش پیک ناموفق بود', 'data': data}
    except requests.exceptions.Timeout:
        return {'success': False, 'message': 'زمان اتصال به اسنپ‌باکس به پایان رسید'}
    except Exception:
        logger.exception('خطا در ثبت سفارش پیک اسنپ‌باکس')
        return {'success': False, 'message': 'خطا در ارتباط با اسنپ‌باکس'}


def cancel_order(snapp_order_id: str) -> dict:
    headers = _headers()
    if not headers:
        return {'success': False, 'message': 'اتصال به اسنپ‌باکس برقرار نشد (توکن نامعتبر)'}

    try:
        response = requests.delete(
            f'{_base_url()}/v1/orders/{snapp_order_id}',
            headers={'Authorization': headers['Authorization']},
            timeout=15,
        )
        if response.status_code in (200, 204):
            return {'success': True}
        return {'success': False, 'message': 'لغو سفارش پیک ناموفق بود'}
    except requests.exceptions.Timeout:
        return {'success': False, 'message': 'زمان اتصال به اسنپ‌باکس به پایان رسید'}
    except Exception:
        logger.exception('خطا در لغو سفارش پیک اسنپ‌باکس')
        return {'success': False, 'message': 'خطا در ارتباط با اسنپ‌باکس'}


def get_current_location(snapp_order_id: str) -> dict:
    """موقعیت لحظه‌ای پیک را برمی‌گرداند — فقط برای سفارش‌هایی که پیک تخصیص یافته
    و در حال حمل است معنی دارد (ACCEPTED/PICKED_UP)."""
    headers = _headers()
    if not headers:
        return {'success': False, 'message': 'اتصال به اسنپ‌باکس برقرار نشد (توکن نامعتبر)'}

    try:
        response = requests.get(
            f'{_base_url()}/v1/orders/{snapp_order_id}/current-location',
            headers={'Accept': 'application/json', 'Authorization': headers['Authorization']},
            timeout=10,
        )
        data = response.json()
        if response.status_code == 200 and data.get('latitude') is not None:
            return {'success': True, 'latitude': data['latitude'], 'longitude': data['longitude']}
        return {'success': False, 'message': 'موقعیت لحظه‌ای در دسترس نیست'}
    except requests.exceptions.Timeout:
        return {'success': False, 'message': 'زمان اتصال به اسنپ‌باکس به پایان رسید'}
    except Exception:
        logger.exception('خطا در دریافت موقعیت لحظه‌ای پیک')
        return {'success': False, 'message': 'خطا در ارتباط با اسنپ‌باکس'}


def get_delivery_categories(latitude: str, longitude: str) -> dict:
    """لیست دسته‌بندی‌های پیک واقعاً فعال برای یک موقعیت جغرافیایی (مثلاً مبدای کافه) —
    برای جلوگیری از تایپ دستی/اشتباه در تنظیمات ادمین استفاده می‌شود."""
    headers = _headers()
    if not headers:
        return {'success': False, 'message': 'اتصال به اسنپ‌باکس برقرار نشد (توکن نامعتبر)'}

    try:
        response = requests.get(
            f'{_base_url()}/v1/orders/delivery-categories',
            params={'latitude': latitude, 'longitude': longitude},
            headers={'Accept': 'application/json', 'Authorization': headers['Authorization']},
            timeout=10,
        )
        data = response.json()
        if response.status_code == 200 and data.get('deliveryCategories') is not None:
            return {'success': True, 'categories': data['deliveryCategories']}
        return {'success': False, 'message': 'دریافت دسته‌بندی‌های ارسال ناموفق بود'}
    except requests.exceptions.Timeout:
        return {'success': False, 'message': 'زمان اتصال به اسنپ‌باکس به پایان رسید'}
    except Exception:
        logger.exception('خطا در دریافت دسته‌بندی‌های ارسال')
        return {'success': False, 'message': 'خطا در ارتباط با اسنپ‌باکس'}

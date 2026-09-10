"""پروکسی سبک به Nominatim (سرویس geocoding رایگان OpenStreetMap) — برای جست‌وجوی
آدرس با متن (forward) و تبدیل مختصات به آدرس خوانا (reverse) در فرم آدرس مشتری.

چرا پروکسی سمت سرور (نه تماس مستقیم فرانت با Nominatim)؟
۱. Nominatim مرورگر را با CORS مسدود می‌کند برای درخواست‌های بدون هدر Referer/Origin مجاز
۲. Usage Policy رسمی Nominatim الزام می‌کند هر کلاینت یک User-Agent شناسه‌دار بفرستد
   (https://operations.osmfoundation.org/policies/nominatim/) — این‌جا یک‌جا کنترل می‌شود
۳. سقف واقعی نرخ آن‌ها ۱ درخواست در ثانیه است؛ کنترل این‌جا (نه در جاوااسکریپت قابل‌دورزدن
   فرانت) امن‌تر است. به همین دلیل عمداً suggestion زنده (autocomplete) پیاده نشده —
   فقط با کلیک صریح دکمه‌ی «جستجو» یک درخواست ارسال می‌شود.
"""
import logging
import requests

logger = logging.getLogger(__name__)

NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org'
# طبق Usage Policy، باید یک User-Agent معرف واقعی برنامه باشد (نه پیش‌فرض requests)
USER_AGENT = 'RoseCafeApp/1.0 (rccoffee.ir)'


def search_address(query: str, viewbox: str | None = None, bounded: bool = False) -> dict:
    """جست‌وجوی متنی آدرس -> لیست نتایج با مختصات. viewbox (اختیاری، فرمت
    'min_lng,min_lat,max_lng,max_lat'). bounded=True یعنی محدودسازی سخت به همین
    کادر (نتایج بیرون کادر اصلاً برنمی‌گردند)؛ False یعنی فقط اولویت‌بندی نتایج نزدیک‌تر."""
    params = {
        'q': query,
        'format': 'jsonv2',
        'accept-language': 'fa',
        'limit': 5,
    }
    if viewbox:
        params['viewbox'] = viewbox
        params['bounded'] = 1 if bounded else 0

    try:
        response = requests.get(
            f'{NOMINATIM_BASE_URL}/search', params=params,
            headers={'User-Agent': USER_AGENT}, timeout=8,
        )
        results = response.json()
        return {
            'success': True,
            'results': [
                {
                    'display_name': r.get('display_name', ''),
                    'latitude': float(r['lat']),
                    'longitude': float(r['lon']),
                }
                for r in results
            ],
        }
    except requests.exceptions.Timeout:
        return {'success': False, 'message': 'زمان جست‌وجوی آدرس به پایان رسید'}
    except Exception:
        logger.exception('خطا در جست‌وجوی آدرس (Nominatim)')
        return {'success': False, 'message': 'خطا در جست‌وجوی آدرس'}


def reverse_geocode(latitude, longitude) -> dict:
    """مختصات -> آدرس خوانا (برای پر کردن خودکار فیلدهای فرم بعد از پین‌کردن روی نقشه)."""
    params = {
        'lat': latitude, 'lon': longitude,
        'format': 'jsonv2', 'accept-language': 'fa', 'zoom': 18,
    }
    try:
        response = requests.get(
            f'{NOMINATIM_BASE_URL}/reverse', params=params,
            headers={'User-Agent': USER_AGENT}, timeout=8,
        )
        data = response.json()
        if 'error' in data:
            return {'success': False, 'message': 'آدرسی برای این موقعیت یافت نشد'}

        address = data.get('address', {})
        # نگاشت فیلدهای Nominatim (که برای هر کشور/منطقه متفاوت‌اند) به فیلدهای فرم ما
        city = (
            address.get('city') or address.get('town') or address.get('village')
            or address.get('county') or ''
        )
        province = address.get('state', '')
        street = ', '.join(filter(None, [address.get('road'), address.get('suburb')]))

        return {
            'success': True,
            'display_name': data.get('display_name', ''),
            'city': city,
            'province': province,
            'street': street,
        }
    except requests.exceptions.Timeout:
        return {'success': False, 'message': 'زمان دریافت آدرس به پایان رسید'}
    except Exception:
        logger.exception('خطا در reverse geocoding (Nominatim)')
        return {'success': False, 'message': 'خطا در دریافت آدرس از روی نقشه'}

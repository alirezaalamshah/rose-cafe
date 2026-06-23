import requests
import logging
from django.conf import settings

logger = logging.getLogger(__name__)

# RetStatus error codes from Melipayamak REST API
MELIPAYAMAK_ERRORS = {
    '0':    'نام کاربری یا رمز عبور اشتباه است',
    '2':    'اعتبار کافی نیست',
    '3':    'محدودیت ارسال روزانه',
    '5':    'شماره فرستنده معتبر نیست',
    '7':    'متن پیام دارای کلمات فیلتر شده است',
    '10':   'حساب کاربری غیرفعال است',
    '16':   'شماره گیرنده یافت نشد',
    '17':   'متن پیام خالی است',
    '18':   'فرمت شماره گیرنده اشتباه است',
    '35':   'شماره گیرنده در لیست سیاه است',
    '-109': 'IP شما در whitelist نیست — از پنل ملی‌پیامک IP سرور را اضافه کنید',
    '-110': 'باید از ApiKey به جای رمز عبور استفاده کنید',
    '-108': 'IP شما به دلیل تلاش‌های ناموفق مسدود شده است',
}


def _normalize_phone(phone: str) -> str:
    phone = phone.strip()
    if phone.startswith('+98'):
        phone = '0' + phone[3:]
    elif phone.startswith('98') and len(phone) == 12:
        phone = '0' + phone[2:]
    return phone


def send_sms(phone: str, message: str) -> bool:
    username = getattr(settings, 'MELIPAYAMAK_USERNAME', '')

    # حالت توسعه — اگر username تنظیم نشده فقط log می‌کنیم
    if settings.DEBUG and not username:
        logger.info(f'[DEV SMS] به {phone}: {message}')
        _save_log(phone, message, True)
        return True

    phone = _normalize_phone(phone)

    try:
        # مستندات: https://www.melipayamak.com/api/sendsimplesms2/
        # Content-Type باید application/x-www-form-urlencoded باشد (نه JSON)
        payload = {
            'username': username,
            'password': settings.MELIPAYAMAK_PASSWORD,
            'to': phone,
            'from': settings.MELIPAYAMAK_FROM,
            'text': message,
            'isflash': 'false',
        }
        response = requests.post(
            'https://rest.payamak-panel.com/api/SendSMS/SendSMS',
            data=payload,           # form-encoded، نه json=
            timeout=10,
        )
        response.raise_for_status()

        success = _parse_response(response)
        _save_log(phone, message, success)
        return success

    except requests.exceptions.Timeout:
        logger.error('Melipayamak timeout')
        _save_log(phone, message, False)
        return False
    except Exception as e:
        logger.exception(f'SMS send failed: {e}')
        _save_log(phone, message, False)
        return False


def send_otp_sms(phone: str, otp: str) -> bool:
    phone = _normalize_phone(phone)
    username = getattr(settings, 'MELIPAYAMAK_USERNAME', '')

    # حالت توسعه
    if settings.DEBUG and not username:
        logger.info(f'[DEV OTP] به {phone}: {otp}')
        _save_log(phone, f'OTP: {otp}', True)
        return True

    try:
        # endpoint اختصاصی OTP ملی‌پیامک
        # مستندات: https://www.melipayamak.com/api/sendotp/
        payload = {
            'username': username,
            'password': settings.MELIPAYAMAK_PASSWORD,
            'from': settings.MELIPAYAMAK_FROM,
            'to': phone,
            'code': int(otp),
        }
        response = requests.post(
            'https://rest.payamak-panel.com/api/SendSMS/SendOtp',
            data=payload,
            timeout=10,
        )
        response.raise_for_status()
        success = _parse_response(response)

        if success:
            _save_log(phone, f'OTP: {otp}', True)
            return True

        # fallback — اگر SendOtp کار نکرد از SendSMS معمولی استفاده کن
        logger.warning('SendOtp failed, falling back to SendSMS')
        message = f'کد تایید شما: {otp}\nاین کد ۲ دقیقه معتبر است.\nکافه ما'
        return send_sms(phone, message)

    except Exception as e:
        logger.exception(f'OTP SMS failed: {e}')
        # fallback
        message = f'کد تایید شما: {otp}\nاین کد ۲ دقیقه معتبر است.\nکافه ما'
        return send_sms(phone, message)


def _parse_response(response: requests.Response) -> bool:
    """
    پاسخ API ملی‌پیامک:
    - عدد مثبت = RecId (موفق)
    - 0 = نام کاربری / رمز اشتباه
    - اعداد منفی یا خاص = خطا
    پاسخ ممکن است JSON یا plain text باشد.
    """
    try:
        data = response.json()
        if isinstance(data, dict):
            ret_status = data.get('RetStatus', 0)
            value = str(data.get('Value', '0'))
            if ret_status == 1:
                return True
            rec_id = _extract_rec_id(value)
            if rec_id and rec_id > 0:
                return True
            _log_error(value)
            return False
        elif isinstance(data, (int, float)):
            return int(data) > 0
    except ValueError:
        pass

    # plain text response
    text = response.text.strip().strip('"')
    rec_id = _extract_rec_id(text)
    if rec_id is not None:
        if rec_id > 0:
            return True
        _log_error(text)
        return False

    return False


def _extract_rec_id(value: str) -> int | None:
    try:
        return int(float(str(value).strip()))
    except (ValueError, TypeError):
        return None


def _log_error(code: str) -> None:
    msg = MELIPAYAMAK_ERRORS.get(str(code).strip(), f'خطای ناشناخته: {code}')
    logger.error(f'Melipayamak error — {msg}')


def _save_log(phone: str, message: str, success: bool) -> None:
    try:
        from .models import SMSLog
        SMSLog.objects.create(
            phone=phone,
            message=message,
            status=SMSLog.Status.SENT if success else SMSLog.Status.FAILED,
        )
    except Exception:
        pass


def send_order_status_sms(phone: str, order_id: int, status: str) -> bool:
    status_map = {
        'confirmed': 'تایید شد',
        'preparing': 'در حال آماده‌سازی است',
        'ready': 'آماده تحویل است',
        'delivered': 'تحویل داده شد',
        'cancelled': 'لغو شد',
    }
    status_fa = status_map.get(status, status)
    message = f'کافه ما\nسفارش #{order_id} شما {status_fa}.'
    return send_sms(phone, message)


def send_reservation_confirmation_sms(phone: str, reservation_id: int, date: str, time: str) -> bool:
    message = f'کافه ما\nرزرو #{reservation_id} شما برای {date} ساعت {time} تایید شد.'
    return send_sms(phone, message)

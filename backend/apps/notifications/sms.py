import requests
import logging
from django.conf import settings

logger = logging.getLogger(__name__)

# ─── Console API (توکن‌محور — روش اصلی) ────────────────────────────────────
CONSOLE_BASE = 'https://console.melipayamak.com/api/send'

# bodyId الگوی OTP در پنل ملی‌پیامک (480231 = الگوی تایید شده)
MELIPAYAMAK_OTP_BODY_ID = 480231

# ─── Legacy API (username/password — fallback) ───────────────────────────────
LEGACY_BASE = 'https://rest.payamak-panel.com/api/SendSMS'

# کدهای خطای API قدیمی
LEGACY_ERRORS = {
    '0':    'نام کاربری یا رمز عبور اشتباه است',
    '2':    'اعتبار کافی نیست',
    '3':    'محدودیت ارسال روزانه',
    '5':    'شماره فرستنده معتبر نیست',
    '7':    'پیام دارای کلمات فیلتر شده است',
    '10':   'حساب کاربری غیرفعال است',
    '11':   'شماره گیرنده در لیست سیاه مخابرات است',
    '16':   'شماره گیرنده یافت نشد',
    '17':   'متن پیام خالی است',
    '18':   'فرمت شماره گیرنده اشتباه است',
    '35':   'شماره گیرنده در لیست سیاه پنل است',
    '-108': 'IP به دلیل تلاش‌های ناموفق مسدود شده',
    '-109': 'IP سرور در whitelist پنل تنظیم نشده',
    '-110': 'این حساب نیاز به ApiKey دارد — از Console API استفاده کنید',
}


def _normalize_phone(phone: str) -> str:
    phone = str(phone).strip()
    if phone.startswith('+98'):
        phone = '0' + phone[3:]
    elif phone.startswith('98') and len(phone) == 12:
        phone = '0' + phone[2:]
    return phone


# ═══════════════════════════════════════════════════════════════════
#  Console API  (روش اصلی — توکن در URL)
# ═══════════════════════════════════════════════════════════════════

def _console_send_otp(phone: str, otp: str) -> bool:
    """
    Console API — ارسال OTP از طریق پترن shared
    POST https://console.melipayamak.com/api/send/shared/{token}
    Body JSON: { "bodyId": 480231, "to": "09...", "args": ["123456"] }
    """
    token = getattr(settings, 'MELIPAYAMAK_API_TOKEN', '')
    if not token:
        return False

    try:
        response = requests.post(
            f'{CONSOLE_BASE}/shared/{token}',
            json={
                'bodyId': MELIPAYAMAK_OTP_BODY_ID,
                'to': phone,
                'args': [str(otp)],
            },
            headers={'Content-Type': 'application/json'},
            timeout=10,
        )
        response.raise_for_status()
        return _parse_console_response(response, 'OTP')
    except requests.exceptions.Timeout:
        logger.error('Console API OTP timeout')
        return False
    except Exception as e:
        logger.error(f'Console API OTP error: {e}')
        return False


def _console_send_simple(phone: str, message: str) -> bool:
    """
    Console API — ارسال پیامک ساده
    POST https://console.melipayamak.com/api/send/simple/{token}
    Body JSON: { "from": "5000...", "to": "09...", "text": "..." }
    """
    token = getattr(settings, 'MELIPAYAMAK_API_TOKEN', '')
    if not token:
        return False

    try:
        response = requests.post(
            f'{CONSOLE_BASE}/simple/{token}',
            json={
                'from': settings.MELIPAYAMAK_FROM,
                'to': phone,
                'text': message,
            },
            headers={'Content-Type': 'application/json'},
            timeout=10,
        )
        response.raise_for_status()
        return _parse_console_response(response, 'SMS')
    except requests.exceptions.Timeout:
        logger.error('Console API SMS timeout')
        return False
    except Exception as e:
        logger.error(f'Console API SMS error: {e}')
        return False


def _parse_console_response(response: requests.Response, label: str) -> bool:
    """
    پاسخ Console API:
    موفق: {"recId": "12345...", ...} یا {"status": 1, ...}
    خطا:  {"recId": "0", ...} یا کد منفی
    """
    try:
        data = response.json()
        logger.debug(f'Console API {label} response: {data}')

        if isinstance(data, dict):
            rec_id = data.get('recId') or data.get('RecId') or data.get('value') or data.get('Value')
            ret_status = data.get('retStatus') or data.get('RetStatus') or data.get('status')

            if rec_id is not None:
                try:
                    rec_id_int = int(float(str(rec_id)))
                    if rec_id_int > 0:
                        logger.info(f'Console API {label} sent OK — recId={rec_id_int}')
                        return True
                    logger.error(f'Console API {label} failed — recId={rec_id_int}')
                    return False
                except (ValueError, TypeError):
                    pass

            if ret_status == 1 or ret_status == '1':
                logger.info(f'Console API {label} sent OK — status=1')
                return True

        # اگر مستقیماً عدد برگرداند
        if isinstance(data, (int, float)):
            return int(data) > 0

    except ValueError:
        pass

    # plain text
    text = response.text.strip().strip('"')
    try:
        val = int(float(text))
        if val > 0:
            logger.info(f'Console API {label} sent OK — recId={val}')
            return True
        logger.error(f'Console API {label} failed — code={val}')
    except (ValueError, TypeError):
        logger.warning(f'Console API {label} unexpected response: {response.text[:200]}')

    return False


# ═══════════════════════════════════════════════════════════════════
#  Legacy API  (fallback — username/password)
# ═══════════════════════════════════════════════════════════════════

def _legacy_send_sms(phone: str, message: str) -> bool:
    username = getattr(settings, 'MELIPAYAMAK_USERNAME', '')
    password = getattr(settings, 'MELIPAYAMAK_PASSWORD', '')
    sender = getattr(settings, 'MELIPAYAMAK_FROM', '')
    if not username:
        return False

    try:
        response = requests.post(
            f'{LEGACY_BASE}/SendSMS',
            data={
                'username': username,
                'password': password,
                'to': phone,
                'from': sender,
                'text': message,
                'isflash': 'false',
            },
            timeout=10,
        )
        response.raise_for_status()
        return _parse_legacy_response(response)
    except Exception as e:
        logger.error(f'Legacy SMS error: {e}')
        return False


def _legacy_send_otp(phone: str, otp: str) -> bool:
    username = getattr(settings, 'MELIPAYAMAK_USERNAME', '')
    password = getattr(settings, 'MELIPAYAMAK_PASSWORD', '')
    sender = getattr(settings, 'MELIPAYAMAK_FROM', '')
    if not username:
        return False

    try:
        response = requests.post(
            f'{LEGACY_BASE}/SendOtp',
            data={
                'username': username,
                'password': password,
                'from': sender,
                'to': phone,
                'code': int(otp),
            },
            timeout=10,
        )
        response.raise_for_status()
        return _parse_legacy_response(response)
    except Exception as e:
        logger.error(f'Legacy OTP error: {e}')
        return False


def _parse_legacy_response(response: requests.Response) -> bool:
    try:
        data = response.json()
        if isinstance(data, dict):
            ret_status = data.get('RetStatus', 0)
            value = str(data.get('Value', '0'))
            if ret_status == 1:
                return True
            code = str(value).strip()
            try:
                val = int(float(code))
                if val > 0:
                    return True
                err = LEGACY_ERRORS.get(code, f'خطای ناشناخته: {code}')
                logger.error(f'Legacy SMS error — {err}')
                return False
            except (ValueError, TypeError):
                pass
        elif isinstance(data, (int, float)):
            return int(data) > 0
    except ValueError:
        pass

    text = response.text.strip().strip('"')
    try:
        val = int(float(text))
        if val > 0:
            return True
        err = LEGACY_ERRORS.get(text, f'خطای ناشناخته: {text}')
        logger.error(f'Legacy SMS error — {err}')
    except (ValueError, TypeError):
        logger.warning(f'Legacy SMS unexpected response: {response.text[:200]}')

    return False


# ═══════════════════════════════════════════════════════════════════
#  Public Interface
# ═══════════════════════════════════════════════════════════════════

def send_otp_sms(phone: str, otp: str) -> bool:
    phone = _normalize_phone(phone)

    if settings.DEBUG and not getattr(settings, 'MELIPAYAMAK_API_TOKEN', ''):
        logger.info(f'[DEV OTP] {phone}: {otp}')
        _save_log(phone, f'OTP:{otp}', True)
        return True

    # ۱. Console API (روش اصلی)
    success = _console_send_otp(phone, otp)

    # ۲. Legacy API (fallback)
    if not success:
        logger.warning('Console OTP failed — trying legacy SendOtp')
        success = _legacy_send_otp(phone, otp)

    # ۳. Legacy SMS متنی (آخرین راه)
    if not success:
        logger.warning('Legacy OTP failed — sending as plain SMS')
        msg = f'کد تایید شما: {otp}\nاین کد ۲ دقیقه معتبر است.'
        success = _legacy_send_sms(phone, msg)

    _save_log(phone, f'OTP:{otp}', success)
    return success


def send_sms(phone: str, message: str) -> bool:
    phone = _normalize_phone(phone)

    if not getattr(settings, 'SMS_NOTIFICATIONS_ENABLED', False):
        logger.info(f'[SMS DISABLED] {phone}: {message}')
        _save_log(phone, message, success=False, skipped=True)
        return False

    if settings.DEBUG and not getattr(settings, 'MELIPAYAMAK_API_TOKEN', ''):
        logger.info(f'[DEV SMS] {phone}: {message}')
        _save_log(phone, message, True)
        return True

    # ۱. Console API
    success = _console_send_simple(phone, message)

    # ۲. Legacy fallback
    if not success:
        logger.warning('Console SMS failed — trying legacy')
        success = _legacy_send_sms(phone, message)

    _save_log(phone, message, success)
    return success


def send_order_status_sms(phone: str, order_number: str, status: str) -> bool:
    status_map = {
        'confirmed': 'تایید شد ✓',
        'preparing': 'در حال آماده‌سازی است',
        'ready':     'آماده تحویل است ✓',
        'delivered': 'تحویل داده شد',
        'cancelled': 'لغو شد',
    }
    label = status_map.get(status, status)
    message = f'سفارش #{order_number} شما {label}.'
    return send_sms(phone, message)


def send_order_rejected_sms(phone: str, order_number: str, reason: str) -> bool:
    message = (
        f'متأسفانه سفارش #{order_number} شما توسط کافه رد شد.\n'
        f'دلیل: {reason}\n'
        'به زودی وجه شما عودت داده خواهد شد.'
    )
    return send_sms(phone, message)


def send_reservation_confirmation_sms(phone: str, reservation_id: int, date: str, time: str) -> bool:
    message = f'رزرو #{reservation_id} برای {date} ساعت {time} تایید شد ✓'
    return send_sms(phone, message)


def _save_log(phone: str, message: str, success: bool, skipped: bool = False) -> None:
    try:
        from .models import SMSLog
        if skipped:
            status = SMSLog.Status.SKIPPED
        else:
            status = SMSLog.Status.SENT if success else SMSLog.Status.FAILED
        SMSLog.objects.create(phone=phone, message=message, status=status)
    except Exception:
        pass

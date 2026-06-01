import requests
import logging
from django.conf import settings

logger = logging.getLogger(__name__)


def send_sms(phone: str, message: str) -> bool:
    if settings.DEBUG and not getattr(settings, 'MELIPAYAMAK_USERNAME', ''):
        logger.info(f'[DEV SMS] به {phone}: {message}')
        _save_log(phone, message, True)
        return True

    try:
        url = 'https://rest.payamak-panel.com/api/SendSMS/SendSMS'
        if phone.startswith('+98'):
            phone = '0' + phone[3:]

        payload = {
            'username': settings.MELIPAYAMAK_USERNAME,
            'password': settings.MELIPAYAMAK_PASSWORD,
            'to': phone,
            'from': settings.MELIPAYAMAK_FROM,
            'text': message,
            'isFlash': False,
        }
        response = requests.post(url, json=payload, timeout=10)
        data = response.json()

        success = data.get('RetStatus') == 1
        _save_log(phone, message, success)
        return success

    except Exception as e:
        logger.exception(f'SMS send failed: {e}')
        _save_log(phone, message, False)
        return False


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


def send_otp_sms(phone: str, otp: str) -> bool:
    message = f'کافه آرام\nکد تایید شما: {otp}\nاین کد ۲ دقیقه معتبر است.'
    return send_sms(phone, message)


def send_order_status_sms(phone: str, order_id: int, status: str) -> bool:
    status_map = {
        'confirmed': 'تایید شد',
        'preparing': 'در حال آماده‌سازی است',
        'ready': 'آماده تحویل است',
        'delivered': 'تحویل داده شد',
        'cancelled': 'لغو شد',
    }
    status_fa = status_map.get(status, status)
    message = f'کافه آرام\nسفارش #{order_id} شما {status_fa}.'
    return send_sms(phone, message)


def send_reservation_confirmation_sms(phone: str, reservation_id: int, date: str, time: str) -> bool:
    message = f'کافه آرام\nرزرو #{reservation_id} شما برای {date} ساعت {time} تایید شد.'
    return send_sms(phone, message)
import requests
import logging
from django.conf import settings

logger = logging.getLogger(__name__)

# مستندات: https://payment.zarinpal.com (نه api.zarinpal.com)
SANDBOX_REQUEST_URL = 'https://sandbox.zarinpal.com/pg/v4/payment/request.json'
SANDBOX_VERIFY_URL  = 'https://sandbox.zarinpal.com/pg/v4/payment/verify.json'
SANDBOX_PAYMENT_URL = 'https://sandbox.zarinpal.com/pg/StartPay/{authority}'

REAL_REQUEST_URL = 'https://payment.zarinpal.com/pg/v4/payment/request.json'
REAL_VERIFY_URL  = 'https://payment.zarinpal.com/pg/v4/payment/verify.json'
REAL_PAYMENT_URL = 'https://payment.zarinpal.com/pg/StartPay/{authority}'

# کدهای خطای زرین‌پال
ERROR_MESSAGES = {
    -9:  'خطای اعتبارسنجی — اطلاعات ارسالی ناقص است',
    -10: 'مرچنت کد یا IP سرور معتبر نیست',
    -11: 'مرچنت کد فعال نیست',
    -12: 'تعداد درخواست‌ها بیش از حد مجاز است',
    -13: 'محدودیت تراکنش — مدارک را تکمیل کنید',
    -14: 'دامنه callback با دامنه ثبت‌شده مطابقت ندارد',
    -15: 'درگاه پرداخت به حالت تعلیق درآمده است',
    -16: 'سطح تأیید پذیرنده پایین‌تر از سطح نقره‌ای است',
    -50: 'مبلغ verify با مبلغ اولیه متفاوت است',
    -51: 'پرداخت ناموفق بوده است',
    -52: 'خطای غیرمنتظره — با پشتیبانی تماس بگیرید',
    -53: 'این تراکنش متعلق به این مرچنت کد نیست',
    -54: 'authority نامعتبر است',
    -55: 'تراکنش یافت نشد',
}


def get_urls():
    if settings.ZARINPAL_SANDBOX:
        return SANDBOX_REQUEST_URL, SANDBOX_VERIFY_URL, SANDBOX_PAYMENT_URL
    return REAL_REQUEST_URL, REAL_VERIFY_URL, REAL_PAYMENT_URL


def _error_message(data: dict) -> str:
    errors = data.get('errors', {})
    if isinstance(errors, dict):
        code = errors.get('code')
        if code and code in ERROR_MESSAGES:
            return ERROR_MESSAGES[code]
        return errors.get('message', 'خطای نامشخص از زرین‌پال')
    return 'خطای نامشخص از زرین‌پال'


def request_payment(
    amount_toman: int,
    description: str,
    callback_url: str,
    mobile: str = '',
    order_id: str = '',
) -> dict:
    request_url, _, _ = get_urls()

    metadata: dict = {}
    if mobile:
        metadata['mobile'] = mobile
    if order_id:
        metadata['order_id'] = str(order_id)

    payload = {
        'merchant_id': settings.ZARINPAL_MERCHANT,
        'amount': amount_toman,
        'currency': 'IRT',          # تومان — نیازی به ×10 نیست
        'description': description,
        'callback_url': callback_url,
    }
    if metadata:
        payload['metadata'] = metadata

    try:
        response = requests.post(
            request_url,
            json=payload,
            headers={'Accept': 'application/json', 'Content-Type': 'application/json'},
            timeout=15,
        )
        data = response.json()
        logger.info('Zarinpal request response: %s', data)

        if data.get('data', {}).get('code') == 100:
            authority = data['data']['authority']
            _, _, payment_url_tpl = get_urls()
            return {
                'success': True,
                'authority': authority,
                'payment_url': payment_url_tpl.format(authority=authority),
            }

        return {'success': False, 'message': _error_message(data)}

    except requests.exceptions.Timeout:
        return {'success': False, 'message': 'زمان اتصال به درگاه پرداخت به پایان رسید'}
    except Exception as e:
        logger.exception('Zarinpal request failed: %s', e)
        return {'success': False, 'message': 'خطا در اتصال به درگاه پرداخت'}


def verify_payment(amount_toman: int, authority: str) -> dict:
    _, verify_url, _ = get_urls()

    payload = {
        'merchant_id': settings.ZARINPAL_MERCHANT,
        'amount': amount_toman,
        'currency': 'IRT',          # تومان — هماهنگ با request
        'authority': authority,
    }

    try:
        response = requests.post(
            verify_url,
            json=payload,
            headers={'Accept': 'application/json', 'Content-Type': 'application/json'},
            timeout=15,
        )
        data = response.json()
        logger.info('Zarinpal verify response: %s', data)

        code = data.get('data', {}).get('code')

        if code in (100, 101):
            return {
                'success': True,
                'already_verified': code == 101,
                'ref_id': str(data['data'].get('ref_id', '')),
                'card_pan': data['data'].get('card_pan', ''),
                'card_hash': data['data'].get('card_hash', ''),
                'fee': data['data'].get('fee', 0),
                'message': 'پرداخت با موفقیت تأیید شد' if code == 100 else 'پرداخت قبلاً تأیید شده است',
            }

        return {'success': False, 'message': _error_message(data), 'code': code}

    except requests.exceptions.Timeout:
        return {'success': False, 'message': 'زمان اتصال به درگاه پرداخت به پایان رسید'}
    except Exception as e:
        logger.exception('Zarinpal verify failed: %s', e)
        return {'success': False, 'message': 'خطا در تأیید پرداخت'}

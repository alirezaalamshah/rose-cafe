import requests
import logging
from django.conf import settings

logger = logging.getLogger(__name__)

SANDBOX_REQUEST_URL = 'https://sandbox.zarinpal.com/pg/v4/payment/request.json'
SANDBOX_VERIFY_URL = 'https://sandbox.zarinpal.com/pg/v4/payment/verify.json'
SANDBOX_PAYMENT_URL = 'https://sandbox.zarinpal.com/pg/StartPay/{authority}'

REAL_REQUEST_URL = 'https://api.zarinpal.com/pg/v4/payment/request.json'
REAL_VERIFY_URL = 'https://api.zarinpal.com/pg/v4/payment/verify.json'
REAL_PAYMENT_URL = 'https://www.zarinpal.com/pg/StartPay/{authority}'


def get_urls():
    if settings.ZARINPAL_SANDBOX:
        return SANDBOX_REQUEST_URL, SANDBOX_VERIFY_URL, SANDBOX_PAYMENT_URL
    return REAL_REQUEST_URL, REAL_VERIFY_URL, REAL_PAYMENT_URL


def request_payment(amount_toman: int, description: str, callback_url: str, mobile: str = '') -> dict:
    request_url, _, _ = get_urls()

    # زرین‌پال مبلغ رو به ریال میخواد
    amount_rial = amount_toman * 10

    payload = {
        'merchant_id': settings.ZARINPAL_MERCHANT,
        'amount': amount_rial,
        'description': description,
        'callback_url': callback_url,
    }
    if mobile:
        payload['metadata'] = {'mobile': mobile}

    try:
        response = requests.post(request_url, json=payload, timeout=15)
        data = response.json()
        logger.info(f'Zarinpal request response: {data}')

        if data.get('data', {}).get('code') == 100:
            authority = data['data']['authority']
            _, _, payment_url_template = get_urls()
            payment_url = payment_url_template.format(authority=authority)
            return {
                'success': True,
                'authority': authority,
                'payment_url': payment_url,
            }
        else:
            errors = data.get('errors', {})
            return {
                'success': False,
                'message': f"خطای زرین‌پال: {errors.get('message', 'خطای نامشخص')}",
            }

    except requests.exceptions.Timeout:
        return {'success': False, 'message': 'زمان اتصال به درگاه پرداخت به پایان رسید'}
    except Exception as e:
        logger.exception(f'Zarinpal request failed: {e}')
        return {'success': False, 'message': 'خطا در اتصال به درگاه پرداخت'}


def verify_payment(amount_toman: int, authority: str) -> dict:
    _, verify_url, _ = get_urls()

    amount_rial = amount_toman * 10

    payload = {
        'merchant_id': settings.ZARINPAL_MERCHANT,
        'amount': amount_rial,
        'authority': authority,
    }

    try:
        response = requests.post(verify_url, json=payload, timeout=15)
        data = response.json()
        logger.info(f'Zarinpal verify response: {data}')

        code = data.get('data', {}).get('code')

        if code == 100:
            return {
                'success': True,
                'ref_id': str(data['data']['ref_id']),
                'message': 'پرداخت با موفقیت انجام شد',
            }
        elif code == 101:
            return {
                'success': True,
                'ref_id': str(data['data'].get('ref_id', '')),
                'message': 'پرداخت قبلاً تایید شده است',
            }
        else:
            errors = data.get('errors', {})
            return {
                'success': False,
                'message': f"پرداخت ناموفق: {errors.get('message', 'خطای نامشخص')}",
                'code': code,
            }

    except requests.exceptions.Timeout:
        return {'success': False, 'message': 'زمان اتصال به درگاه پرداخت به پایان رسید'}
    except Exception as e:
        logger.exception(f'Zarinpal verify failed: {e}')
        return {'success': False, 'message': 'خطا در تایید پرداخت'}
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from .sms import send_otp_sms, send_sms


@api_view(['POST'])
@permission_classes([IsAdminUser])
def test_sms(request):
    """
    تست ارسال SMS — فقط ادمین
    Body: { "phone": "09...", "type": "otp" | "sms", "message": "..." }
    """
    phone = request.data.get('phone', '')
    sms_type = request.data.get('type', 'sms')
    message = request.data.get('message', 'پیام تست از کافه')

    if not phone:
        return Response({'detail': 'شماره تلفن الزامی است'}, status=400)

    if sms_type == 'otp':
        success = send_otp_sms(phone, '123456')
        label = 'OTP (کد: ۱۲۳۴۵۶)'
    else:
        success = send_sms(phone, message)
        label = 'پیامک معمولی'

    return Response({
        'success': success,
        'type': label,
        'phone': phone,
        'detail': 'ارسال شد' if success else 'ارسال ناموفق — لاگ سرور را بررسی کنید',
    })

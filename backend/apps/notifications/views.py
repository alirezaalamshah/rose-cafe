import hashlib

from django.conf import settings
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAdminUser, IsAuthenticated
from rest_framework.response import Response
from .sms import send_otp_sms, send_sms
from .models import PushSubscription


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


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def vapid_public_key(request):
    return Response({'publicKey': settings.VAPID_PUBLIC_KEY})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def push_subscribe(request):
    """
    Body: خروجی مستقیم PushSubscription.toJSON() مرورگر
    { endpoint, keys: { p256dh, auth } }
    """
    data = request.data
    endpoint = data.get('endpoint')
    keys = data.get('keys') or {}
    p256dh = keys.get('p256dh')
    auth = keys.get('auth')
    if not endpoint or not p256dh or not auth:
        return Response({'detail': 'اطلاعات اشتراک ناقص است'}, status=400)

    PushSubscription.objects.update_or_create(
        endpoint_hash=hashlib.sha256(endpoint.encode()).hexdigest(),
        defaults={
            'user': request.user,
            'endpoint': endpoint,
            'p256dh': p256dh,
            'auth': auth,
            'user_agent': request.META.get('HTTP_USER_AGENT', '')[:255],
        },
    )
    return Response({'detail': 'اشتراک نوتیفیکیشن ثبت شد'})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def push_unsubscribe(request):
    endpoint = request.data.get('endpoint')
    if endpoint:
        endpoint_hash = hashlib.sha256(endpoint.encode()).hexdigest()
        PushSubscription.objects.filter(endpoint_hash=endpoint_hash, user=request.user).delete()
    return Response({'detail': 'اشتراک نوتیفیکیشن لغو شد'})

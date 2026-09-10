import logging
from django.conf import settings as django_settings
from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.orders.models import Order
from apps.accounts.permissions import IsWaiter
from apps.staff_activity.models import StaffActionLog, log_staff_action
from apps.notifications.push import notify_courier_issue, notify_courier_delivered

from .models import SnappSettings, SnappCourierOrder
from .serializers import SnappSettingsSerializer, SnappCourierOrderSerializer
from . import services

logger = logging.getLogger(__name__)


class AdminSnappSettingsView(generics.RetrieveUpdateAPIView):
    permission_classes = [permissions.IsAdminUser]
    serializer_class = SnappSettingsSerializer

    def get_object(self):
        return SnappSettings.get_settings()


class DeliveryZoneInfoView(APIView):
    """مبدا و شعاع مجاز ارسال — عمومی (بدون احراز هویت ادمین)، چون فرم آدرس مشتری
    برای نمایش «فاصله‌ی زنده تا کافه» قبل از ذخیره به آن نیاز دارد. فقط همین سه
    مقدار غیرحساس افشا می‌شود، نه بقیه‌ی تنظیمات (client_id/secret و غیره)."""
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        settings_obj = SnappSettings.get_settings()
        return Response({
            'store_latitude': settings_obj.store_latitude,
            'store_longitude': settings_obj.store_longitude,
            'max_delivery_radius_km': settings_obj.max_delivery_radius_km,
        })


class ResetSnappCircuitBreakerView(APIView):
    """ادمین بعد از رفع مشکل (مثلاً تمدید اعتبار/بررسی توکن)، دستی حالت اضطراری را
    خاموش می‌کند — چون فعال‌شدنش خودکار است ولی خاموش‌کردنش عمداً دستی مانده تا
    ادمین قبل از فعال‌سازی مجدد مطمئن شود مشکل واقعاً رفع شده."""
    permission_classes = [permissions.IsAdminUser]

    def post(self, request):
        settings_obj = SnappSettings.get_settings()
        settings_obj.reset_circuit_breaker()
        log_staff_action(
            request.user, StaffActionLog.Action.SNAPP_CIRCUIT_BREAKER_RESET,
            'یکپارچه‌سازی اسنپ‌باکس را بعد از حالت اضطراری دوباره فعال کرد',
        )
        return Response(SnappSettingsSerializer(settings_obj).data)


class SnappDeliveryCategoriesView(APIView):
    """لیست دسته‌بندی‌های واقعاً فعال پیک برای مبدای کافه — برای پر کردن یک لیست
    انتخابی (نه متن آزاد) در تنظیمات ادمین."""
    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        settings_obj = SnappSettings.get_settings()
        result = services.list_delivery_categories(settings_obj)
        if not result['success']:
            return Response({'detail': result['message']}, status=status.HTTP_400_BAD_REQUEST)
        return Response({'categories': result['categories']})


def _dispatch_common(request, pk, retry=False):
    """منطق مشترک ارسال دستی/ارسال مجدد — فقط پیام موفقیت لاگ متفاوت است."""
    if not request.user.is_staff:
        perm = getattr(request.user, 'waiter_permissions', None)
        if not perm or not perm.can_manage_orders:
            return None, Response({'detail': 'دسترسی به مدیریت سفارشات ندارید'}, status=status.HTTP_403_FORBIDDEN)

    try:
        order = Order.objects.get(pk=pk)
    except Order.DoesNotExist:
        return None, Response({'detail': 'سفارش یافت نشد'}, status=status.HTTP_404_NOT_FOUND)

    try:
        courier_order = services.dispatch_order(order)
    except services.DispatchError as e:
        return None, Response({'detail': e.message}, status=status.HTTP_400_BAD_REQUEST)

    verb = 'دوباره' if retry else ''
    log_staff_action(
        request.user, StaffActionLog.Action.ORDER_STATUS_CHANGED,
        f'سفارش #{order.order_number} را {verb} به پیک اسنپ‌باکس ارسال کرد'.replace('  ', ' '),
        order=order,
    )
    return courier_order, None


class DispatchToSnappView(APIView):
    """ارسال دستی سفارش به پیک — هم ادمین هم سرپرست سالن (با همان دسترسی مدیریت سفارشات)."""

    def get_permissions(self):
        if self.request.user and self.request.user.is_staff:
            return [permissions.IsAdminUser()]
        return [IsWaiter()]

    def post(self, request, pk):
        courier_order, error_response = _dispatch_common(request, pk)
        if error_response:
            return error_response
        return Response(SnappCourierOrderSerializer(courier_order).data, status=status.HTTP_201_CREATED)


class RetryDispatchToSnappView(APIView):
    """ارسال مجدد سفارش به پیک — وقتی ارسال قبلی لغو/ناموفق شده (مثلاً هیچ پیکی قبول
    نکرد). فقط از نظر لاگ با ارسال دستی اول فرق دارد؛ منطق idempotent خودِ
    dispatch_order (بر اساس RETRYABLE_STATUSES) از ارسال روی پیک فعال جلوگیری می‌کند."""

    def get_permissions(self):
        if self.request.user and self.request.user.is_staff:
            return [permissions.IsAdminUser()]
        return [IsWaiter()]

    def post(self, request, pk):
        courier_order, error_response = _dispatch_common(request, pk, retry=True)
        if error_response:
            return error_response
        return Response(SnappCourierOrderSerializer(courier_order).data, status=status.HTTP_201_CREATED)


class CancelSnappCourierView(APIView):
    def get_permissions(self):
        if self.request.user and self.request.user.is_staff:
            return [permissions.IsAdminUser()]
        return [IsWaiter()]

    def post(self, request, pk):
        try:
            courier_order = SnappCourierOrder.objects.select_related('order').get(order_id=pk)
        except SnappCourierOrder.DoesNotExist:
            return Response({'detail': 'این سفارش به پیک ارسال نشده است'}, status=status.HTTP_404_NOT_FOUND)

        try:
            services.cancel_courier_order(courier_order)
        except services.DispatchError as e:
            return Response({'detail': e.message}, status=status.HTTP_400_BAD_REQUEST)

        log_staff_action(
            request.user, StaffActionLog.Action.ORDER_STATUS_CHANGED,
            f'ارسال پیک سفارش #{courier_order.order.order_number} را لغو کرد',
            order=courier_order.order,
        )
        return Response(SnappCourierOrderSerializer(courier_order).data)


class SnappCourierLocationView(APIView):
    """موقعیت لحظه‌ای پیک — هم ادمین/سرپرست سالن (پنل) هم خود مشتری (صفحه‌ی سفارشاتش)
    صدا می‌زنند؛ برای مشتری فقط اجازه‌ی دیدن سفارش خودش را دارد."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        try:
            courier_order = SnappCourierOrder.objects.select_related('order').get(order_id=pk)
        except SnappCourierOrder.DoesNotExist:
            return Response({'detail': 'این سفارش به پیک ارسال نشده است'}, status=status.HTTP_404_NOT_FOUND)

        if not request.user.is_staff and courier_order.order.user_id != request.user.id:
            return Response({'detail': 'دسترسی ندارید'}, status=status.HTTP_403_FORBIDDEN)

        if not courier_order.is_trackable:
            return Response(SnappCourierOrderSerializer(courier_order).data)

        services.refresh_current_location(courier_order)
        return Response(SnappCourierOrderSerializer(courier_order).data)


# نگاشت وضعیت وبهوک اسنپ‌باکس -> SnappCourierOrder.Status. برخی رویدادها (مثلاً
# ORDER_ACCEPTED) خودشان orderStatus صریح می‌فرستند؛ بقیه (لغو/ناموفق) را دستی نگاشت می‌کنیم.
_WEBHOOK_TYPE_STATUS = {
    'ORDER_CANCELLED': SnappCourierOrder.Status.CANCELLED,
    'CANCEL_ALLOCATION': SnappCourierOrder.Status.PENDING,  # به صف تخصیص برمی‌گردد
    'FAILED_DELIVERY': SnappCourierOrder.Status.FAILED,
}

# رویدادهایی که یعنی نیاز به توجه/اقدام ادمین دارد — نوتیف Push برایشان ارسال می‌شود
_CONCERNING_WEBHOOK_TYPES = {
    'CANCEL_ALLOCATION': 'پیک قبلی سفارش را لغو کرد و به صف تخصیص برگشت',
    'FAILED_DELIVERY': 'تحویل به مشتری ناموفق بود',
    'FAILED_DELIVER_RETURN_TO_SOURCE': 'بسته به کافه بازگردانده می‌شود',
}


class SnappWebhookView(APIView):
    """
    اسنپ‌باکس برای هر تغییر وضعیت سفارش پیک، POST به این آدرس می‌زند (بدون هدر
    Authorization استاندارد جنگو — پس AllowAny، مثل PaymentVerifyView). صحت درخواست
    با یک توکن مخفی در querystring تأیید می‌شود (?token=...، تنظیم‌شده هنگام واردکردن
    این آدرس در پنل اسنپ‌باکس) — چون مستندات اسنپ امضای اختصاصی وبهوک ارائه نکرده.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        token = request.query_params.get('token', '')
        if not django_settings.SNAPP_BOX_WEBHOOK_TOKEN or token != django_settings.SNAPP_BOX_WEBHOOK_TOKEN:
            logger.warning('درخواست وبهوک اسنپ‌باکس با توکن نامعتبر رد شد')
            return Response(status=status.HTTP_403_FORBIDDEN)

        data = request.data
        logger.info('Snapp webhook received: %s', data)

        customer_ref_id = data.get('customerRefId', '')
        snapp_order_id = str(data.get('orderId', ''))
        if not customer_ref_id and not snapp_order_id:
            return Response(status=status.HTTP_200_OK)

        courier_order = (
            SnappCourierOrder.objects.filter(order__order_number=customer_ref_id).first()
            if customer_ref_id else None
        ) or (
            SnappCourierOrder.objects.filter(snapp_order_id=snapp_order_id).first()
            if snapp_order_id else None
        )
        if not courier_order:
            logger.warning('وبهوک اسنپ‌باکس برای سفارشی نامعلوم رسید: refId=%s orderId=%s', customer_ref_id, snapp_order_id)
            return Response(status=status.HTTP_200_OK)

        webhook_type = data.get('webhookType', '')
        new_status = data.get('orderStatus') or _WEBHOOK_TYPE_STATUS.get(webhook_type)
        just_delivered = new_status == SnappCourierOrder.Status.DELIVERED and courier_order.status != new_status
        if new_status:
            courier_order.status = new_status

        if data.get('bikerName'):
            courier_order.biker_name = data['bikerName']
        if data.get('bikerPhone'):
            courier_order.biker_phone = data['bikerPhone']
        if data.get('bikerPhotoUrl'):
            courier_order.biker_photo_url = data['bikerPhotoUrl']
        if data.get('totalFare'):
            courier_order.delivery_fare = int(data['totalFare'])
        # ORDER_STATUS_UPDATE (رسیدن به کافه/تحویل‌گرفتن بسته/رسیدن به مقصد) همراه خودش
        # مختصات لحظه‌ای پیک را هم می‌فرستد — برای زنده‌نگه‌داشتن نقشه‌ی رهگیری بدون
        # نیاز به پول جداگانه در همان لحظه‌ای که وضعیت عوض می‌شود
        if data.get('latitude') is not None and data.get('longitude') is not None:
            courier_order.current_latitude = str(data['latitude'])
            courier_order.current_longitude = str(data['longitude'])
            courier_order.location_updated_at = timezone.now()
        if webhook_type in ('ORDER_CANCELLED', 'CANCEL_ALLOCATION', 'FAILED_DELIVERY'):
            courier_order.cancel_reason = webhook_type

        courier_order.raw_last_response = data
        courier_order.last_webhook_at = timezone.now()
        courier_order.save()

        concerning_message = _CONCERNING_WEBHOOK_TYPES.get(webhook_type)
        if concerning_message:
            notify_courier_issue(courier_order.order, concerning_message)
        elif just_delivered:
            notify_courier_delivered(courier_order.order)

        return Response(status=status.HTTP_200_OK)

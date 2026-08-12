import logging
from django.conf import settings
from django.db import transaction
from rest_framework import permissions, generics, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Payment
from .serializers import PaymentRequestSerializer, PaymentSerializer
from .zarinpal import request_payment, verify_payment
from apps.orders.models import Order
from apps.common.pagination import StandardPagination
from apps.notifications.sms import send_order_placed_sms

logger = logging.getLogger(__name__)


class PaymentRequestView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @transaction.atomic
    def post(self, request):
        serializer = PaymentRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        order_id = serializer.validated_data['order_id']
        callback_url = serializer.validated_data.get('callback_url') or settings.ZARINPAL_CALLBACK_URL

        try:
            order = Order.objects.select_for_update().get(id=order_id, user=request.user)
        except Order.DoesNotExist:
            return Response({'detail': 'سفارش یافت نشد'}, status=status.HTTP_404_NOT_FOUND)

        if order.status != Order.Status.WAITING_PAYMENT:
            return Response(
                {'detail': 'این سفارش قابل پرداخت نیست'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # اگه قبلاً پرداخت موفق داشته
        if hasattr(order, 'payment') and order.payment.status == Payment.Status.SUCCESS:
            return Response(
                {'detail': 'این سفارش قبلاً پرداخت شده است'},
                status=status.HTTP_400_BAD_REQUEST
            )

        phone = str(request.user.phone).replace('+98', '0')
        description = f'پرداخت سفارش #{order.id} - کافه آرام'

        # ایجاد رکورد Payment با وضعیت INIT قبل از تماس با درگاه
        payment, _ = Payment.objects.update_or_create(
            order=order,
            defaults={
                'user': request.user,
                'amount': order.final_price,
                'authority': '',
                'status': Payment.Status.INIT,
                'description': description,
            }
        )

        # درخواست از زرین‌پال
        result = request_payment(
            amount_toman=order.final_price,
            description=description,
            callback_url=callback_url,
            mobile=phone,
            order_id=str(order.id),
        )

        if not result['success']:
            payment.status = Payment.Status.FAILED
            payment.save(update_fields=['status'])
            return Response({'detail': result['message']}, status=status.HTTP_502_BAD_GATEWAY)

        # Authority دریافت شد — به PENDING تبدیل می‌شود
        payment.authority = result['authority']
        payment.status = Payment.Status.PENDING
        payment.save(update_fields=['authority', 'status'])

        return Response({
            'payment_url': result['payment_url'],
            'authority': result['authority'],
        })


class PaymentVerifyView(APIView):
    permission_classes = [permissions.AllowAny]

    @transaction.atomic
    def get(self, request):
        authority = request.query_params.get('Authority', '')
        status_param = request.query_params.get('Status', '')

        if not authority:
            return Response({'detail': 'پارامترهای نامعتبر'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            payment = Payment.objects.select_for_update().get(authority=authority)
        except Payment.DoesNotExist:
            return Response({'detail': 'پرداخت یافت نشد'}, status=status.HTTP_404_NOT_FOUND)

        if payment.status == Payment.Status.SUCCESS:
            return Response({
                'success': True,
                'ref_id': payment.ref_id,
                'order_id': payment.order_id,
                'message': 'پرداخت قبلاً تایید شده است',
            })

        # کاربر پرداخت را لغو کرد یا ناموفق بود
        # سفارش در WAITING_PAYMENT باقی می‌ماند — کاربر می‌تواند مجدداً پرداخت کند
        if status_param != 'OK':
            payment.status = Payment.Status.CANCELLED
            payment.save(update_fields=['status'])
            return Response(
                {'success': False, 'message': 'پرداخت توسط کاربر لغو شد'},
                status=status.HTTP_200_OK
            )

        result = verify_payment(
            amount_toman=payment.amount,
            authority=authority,
        )

        if result['success']:
            payment.status = Payment.Status.SUCCESS
            payment.ref_id = result['ref_id']
            payment.card_pan = result.get('card_pan', '')
            payment.card_hash = result.get('card_hash', '')
            payment.save()

            # پرداخت واقعاً موفق بوده (is_paid=True)، ولی پیش از صف آماده‌سازی
            # باید گارسون/ادمین تأیید کند که کافه امکان آماده کردنش را دارد
            order = payment.order
            order.status = Order.Status.PENDING_CONFIRMATION
            order.is_paid = True
            order.save(update_fields=['status', 'is_paid'])

            # پیامک «ثبت سفارش» فقط برای ارسال با پیک — بقیه‌ی انواع تحویل نیازی ندارند
            if order.delivery_type == Order.DeliveryType.DELIVERY:
                send_order_placed_sms(str(order.user.phone), order.order_number, order.final_price)

            return Response({
                'success': True,
                'ref_id': result['ref_id'],
                'card_pan': result.get('card_pan', ''),
                'order_id': order.id,
                'message': 'پرداخت با موفقیت انجام شد',
            })
        else:
            payment.status = Payment.Status.FAILED
            payment.save(update_fields=['status'])
            return Response(
                {'success': False, 'message': result['message']},
                status=status.HTTP_200_OK
            )


class FreeOrderConfirmView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @transaction.atomic
    def post(self, request):
        order_id = request.data.get('order_id')
        if not order_id:
            return Response({'detail': 'شناسه سفارش الزامی است'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            order = Order.objects.select_for_update().get(id=order_id, user=request.user)
        except Order.DoesNotExist:
            return Response({'detail': 'سفارش یافت نشد'}, status=status.HTTP_404_NOT_FOUND)

        if order.final_price != 0:
            return Response(
                {'detail': 'این سفارش مبلغ قابل پرداخت دارد و نیاز به پرداخت آنلاین دارد'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if order.status != Order.Status.WAITING_PAYMENT:
            return Response(
                {'detail': 'این سفارش قبلاً پردازش شده است'},
                status=status.HTTP_400_BAD_REQUEST
            )

        Payment.objects.update_or_create(
            order=order,
            defaults={
                'user': request.user,
                'amount': 0,
                'authority': f'FREE-{order.id}',
                'status': Payment.Status.SUCCESS,
                'ref_id': 'FREE',
                'description': f'سفارش رایگان #{order.id} - تخفیف ۱۰۰٪',
            }
        )

        order.status = Order.Status.PENDING_CONFIRMATION
        order.is_paid = True
        order.save(update_fields=['status', 'is_paid'])

        if order.delivery_type == Order.DeliveryType.DELIVERY:
            send_order_placed_sms(str(order.user.phone), order.order_number, order.final_price)

        return Response({'success': True, 'order_id': order.id})


class PaymentHistoryView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = PaymentSerializer
    pagination_class = StandardPagination

    def get_queryset(self):  # type: ignore[override]
        return Payment.objects.filter(
            user=self.request.user
        ).select_related('order')


class AdminPaymentListView(generics.ListAPIView):
    permission_classes = [permissions.IsAdminUser]
    serializer_class = PaymentSerializer
    pagination_class = StandardPagination

    def get_queryset(self):  # type: ignore[override]
        return Payment.objects.all().select_related('order', 'user')

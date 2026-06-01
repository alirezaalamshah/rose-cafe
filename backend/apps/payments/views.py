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
from apps.discounts.models import DiscountUsage

logger = logging.getLogger(__name__)

DEFAULT_CALLBACK = 'http://localhost:3000/payment/verify'


class PaymentRequestView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = PaymentRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        order_id = serializer.validated_data['order_id']
        callback_url = serializer.validated_data.get('callback_url', DEFAULT_CALLBACK)

        try:
            order = Order.objects.get(id=order_id, user=request.user)
        except Order.DoesNotExist:
            return Response({'detail': 'سفارش یافت نشد'}, status=status.HTTP_404_NOT_FOUND)

        if order.status != Order.Status.PENDING:
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

        result = request_payment(
            amount_toman=order.final_price,
            description=description,
            callback_url=callback_url,
            mobile=phone,
        )

        if not result['success']:
            return Response({'detail': result['message']}, status=status.HTTP_502_BAD_GATEWAY)

        # ذخیره payment
        Payment.objects.update_or_create(
            order=order,
            defaults={
                'user': request.user,
                'amount': order.final_price,
                'authority': result['authority'],
                'status': Payment.Status.PENDING,
                'description': description,
            }
        )

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

        # کاربر پرداخت رو لغو کرده
        if status_param != 'OK':
            payment.status = Payment.Status.CANCELLED
            payment.save()
            payment.order.status = Order.Status.CANCELLED
            payment.order.save()
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
            payment.save()

            order = payment.order
            order.status = Order.Status.CONFIRMED
            order.save()

            # ثبت استفاده از کد تخفیف
            if order.discount_code:
                try:
                    from apps.discounts.models import Discount
                    discount = Discount.objects.get(code=order.discount_code)
                    DiscountUsage.objects.get_or_create(
                        discount=discount,
                        user=order.user,
                        defaults={'order_id': order.id}
                    )
                    discount.used_count += 1
                    discount.save(update_fields=['used_count'])
                except Exception:
                    pass

            return Response({
                'success': True,
                'ref_id': result['ref_id'],
                'order_id': order.id,
                'message': 'پرداخت با موفقیت انجام شد',
            })
        else:
            payment.status = Payment.Status.FAILED
            payment.save()
            return Response(
                {'success': False, 'message': result['message']},
                status=status.HTTP_200_OK
            )


class PaymentHistoryView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = PaymentSerializer

    def get_queryset(self):  # type: ignore[override]
        return Payment.objects.filter(
            user=self.request.user
        ).select_related('order')


class AdminPaymentListView(generics.ListAPIView):
    permission_classes = [permissions.IsAdminUser]
    serializer_class = PaymentSerializer

    def get_queryset(self):  # type: ignore[override]
        return Payment.objects.all().select_related('order', 'user')
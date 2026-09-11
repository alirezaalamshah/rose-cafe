import logging
from django.conf import settings as django_settings
from django.db import transaction
from rest_framework import permissions, generics, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.common.pagination import StandardPagination
from apps.payments.zarinpal import request_payment, verify_payment
from .models import Wallet, WalletTransaction, WalletTopup, LoyaltySettings
from .serializers import (
    WalletSerializer, WalletTransactionSerializer,
    WalletTopupRequestSerializer, WalletTopupSerializer,
    LoyaltySettingsSerializer,
)
from .services import get_or_create_wallet, credit
from apps.notifications.sms import send_wallet_topup_sms

logger = logging.getLogger(__name__)


class MyWalletView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        wallet = get_or_create_wallet(request.user)
        return Response(WalletSerializer(wallet).data)


class WalletTransactionListView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = WalletTransactionSerializer
    pagination_class = StandardPagination

    def get_queryset(self):  # type: ignore[override]
        wallet = get_or_create_wallet(self.request.user)
        return wallet.transactions.select_related('order').all()


class WalletTopupRequestView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @transaction.atomic
    def post(self, request):
        serializer = WalletTopupRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        amount = serializer.validated_data['amount']
        callback_url = serializer.validated_data.get('callback_url') or django_settings.WALLET_TOPUP_CALLBACK_URL

        phone = str(request.user.phone).replace('+98', '0')
        description = 'شارژ کیف پول - رز کافه'

        topup = WalletTopup.objects.create(
            user=request.user, amount=amount, status=WalletTopup.Status.INIT,
        )

        result = request_payment(
            amount_toman=amount,
            description=description,
            callback_url=callback_url,
            mobile=phone,
            order_id=f'topup-{topup.id}',
        )

        if not result['success']:
            topup.status = WalletTopup.Status.FAILED
            topup.save(update_fields=['status'])
            return Response({'detail': result['message']}, status=status.HTTP_502_BAD_GATEWAY)

        topup.authority = result['authority']
        topup.status = WalletTopup.Status.PENDING
        topup.save(update_fields=['authority', 'status'])

        return Response({
            'payment_url': result['payment_url'],
            'authority': result['authority'],
        })


class WalletTopupVerifyView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @transaction.atomic
    def get(self, request):
        authority = request.query_params.get('Authority', '')
        status_param = request.query_params.get('Status', '')

        if not authority:
            return Response({'detail': 'پارامترهای نامعتبر'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            topup = WalletTopup.objects.select_for_update().get(authority=authority, user=request.user)
        except WalletTopup.DoesNotExist:
            return Response({'detail': 'شارژ کیف‌پول یافت نشد'}, status=status.HTTP_404_NOT_FOUND)

        if topup.status == WalletTopup.Status.SUCCESS:
            wallet = get_or_create_wallet(request.user)
            return Response({
                'success': True, 'ref_id': topup.ref_id, 'balance': wallet.balance,
                'message': 'این شارژ قبلاً تأیید شده است',
            })

        if status_param != 'OK':
            topup.status = WalletTopup.Status.CANCELLED
            topup.save(update_fields=['status'])
            return Response({'success': False, 'message': 'شارژ توسط شما لغو شد'})

        result = verify_payment(amount_toman=topup.amount, authority=authority)

        if result['success']:
            topup.status = WalletTopup.Status.SUCCESS
            topup.ref_id = result['ref_id']
            topup.save(update_fields=['status', 'ref_id', 'updated_at'])

            wallet = credit(
                request.user, topup.amount, WalletTransaction.Type.TOPUP,
                description=f'شارژ کیف‌پول از درگاه — کد پیگیری {result["ref_id"]}',
            )
            send_wallet_topup_sms(str(request.user.phone), topup.amount, wallet.balance)

            return Response({
                'success': True, 'ref_id': result['ref_id'], 'balance': wallet.balance,
                'message': 'کیف‌پول با موفقیت شارژ شد',
            })

        topup.status = WalletTopup.Status.FAILED
        topup.save(update_fields=['status'])
        return Response({'success': False, 'message': result['message']})


class LoyaltySettingsView(APIView):
    """تنظیمات باشگاه مشتریان — عمومی (فقط خواندنی، برای نمایش به مشتری در چک‌اوت مثلاً)"""
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        settings_obj = LoyaltySettings.get_settings()
        return Response(LoyaltySettingsSerializer(settings_obj).data)


class AdminLoyaltySettingsView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        settings_obj = LoyaltySettings.get_settings()
        return Response(LoyaltySettingsSerializer(settings_obj).data)

    def patch(self, request):
        settings_obj = LoyaltySettings.get_settings()
        ser = LoyaltySettingsSerializer(settings_obj, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(ser.data)

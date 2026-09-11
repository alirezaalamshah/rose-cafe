import random
import string
from django.utils import timezone
from datetime import timedelta
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions, generics, status

from .models import Discount, DiscountUsage, WinBackSettings
from .serializers import (
    DiscountCheckSerializer, DiscountSerializer, WinBackSettingsSerializer, UserAssignedDiscountSerializer,
)
from .utils import apply_discount
from apps.common.pagination import StandardPagination
from apps.notifications.sms import send_win_back_discount_sms


class CheckDiscountView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = DiscountCheckSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        result = apply_discount(
            serializer.validated_data['code'],
            serializer.validated_data['order_total'],
            request.user,
        )

        if result['valid']:
            return Response({
                'valid': True,
                'discount_amount': result['discount_amount'],
                'message': result['message'],
            })
        return Response({'valid': False, 'message': result['message']})


class MyActiveDiscountsView(APIView):
    """صفحه‌ی سبد خرید مشتری — کدهای تخفیفی که مستقیماً به خود او اختصاص یافته و هنوز
    فعال/بدون‌استفاده‌اند (مثلاً کد دلتنگی که پیامک شده) را نشان می‌دهد، تا کاربر مجبور
    نباشد کد را از متن پیامک کپی کند؛ فقط با یک دکمه می‌تواند مستقیماً اعمالش کند."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        now = timezone.now()
        used_ids = DiscountUsage.objects.filter(user=request.user).values_list('discount_id', flat=True)
        codes = Discount.objects.filter(
            users=request.user, is_active=True, valid_from__lte=now, valid_until__gt=now,
        ).exclude(id__in=used_ids).order_by('-created_at')

        return Response([
            {
                'code': d.code,
                'discount_type': d.discount_type,
                'value': d.value,
                'valid_until': d.valid_until,
            }
            for d in codes
        ])


class AdminDiscountListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAdminUser]
    serializer_class = DiscountSerializer
    queryset = Discount.objects.all().order_by('-created_at')
    pagination_class = StandardPagination


class AdminDiscountDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [permissions.IsAdminUser]
    serializer_class = DiscountSerializer

    def get_queryset(self):  # type: ignore[override]
        return Discount.objects.all()


class BirthdayOfferView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        discount = Discount.objects.filter(is_birthday_type=True, is_active=True).first()
        if not discount:
            return Response({'available': False})
        return Response({
            'available': True,
            'value': discount.value,
            'discount_type': discount.discount_type,
            'min_order_amount': discount.min_order_amount,
        })


class AdminWinBackSettingsView(APIView):
    """تنظیمات پیامک/تخفیف «دلتنگی» — نوع/مقدار/مدت اعتبار، از پنل مشتریان
    در معرض ریزش صدا زده می‌شود، مقدار پیش از هر ارسال از همین‌جا خوانده می‌شود."""
    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        settings_obj = WinBackSettings.get_settings()
        return Response(WinBackSettingsSerializer(settings_obj).data)

    def patch(self, request):
        settings_obj = WinBackSettings.get_settings()
        ser = WinBackSettingsSerializer(settings_obj, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(ser.data)


def _generate_win_back_code(user) -> str:
    """کد کوتاه و خوانا — مثلاً WB-A1B2C3؛ با تکرار تا زمانی که یکتا شود
    (برخورد عملاً تقریباً غیرممکن است، این فقط یک محافظ است)."""
    while True:
        suffix = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
        code = f'WB-{suffix}'
        if not Discount.objects.filter(code=code).exists():
            return code


def _find_active_win_back_code(user):
    """اگر کاربر از قبل یک کد دلتنگی فعال (نه استفاده‌شده، نه منقضی) دارد، همان
    را برمی‌گرداند — تا به‌جای انبار شدن چندین کد بلااستفاده، همان کد دوباره
    پیامک شود. کد قدیمی‌تر (غیر دلتنگی، مثلاً از AdminDiscountListCreateView)
    عمداً لحاظ نمی‌شود، چون فقط کدهای این کمپین را کنترل می‌کنیم."""
    now = timezone.now()
    candidates = Discount.objects.filter(
        users=user, code__startswith='WB-', is_active=True, valid_until__gt=now,
    ).order_by('-created_at')
    used_ids = set(DiscountUsage.objects.filter(user=user, discount__in=candidates).values_list('discount_id', flat=True))
    for discount in candidates:
        if discount.id not in used_ids:
            return discount
    return None


class AdminSendWinBackSMSView(APIView):
    """دکمه‌ی «ارسال پیام دلتنگی» در صفحه‌ی مشتریان در معرض ریزش. اگر کاربر از
    قبل یک کد دلتنگی فعال و بدون‌استفاده دارد، کد تازه نمی‌سازد — همان کد را
    دوباره پیامک می‌کند (جلوگیری از انبار شدن چند کد بلااستفاده برای یک نفر).
    فقط وقتی کد قبلی استفاده/منقضی شده، کد تک‌مصرف جدیدی (طبق تنظیمات فعلی
    WinBackSettings) ساخته می‌شود."""
    permission_classes = [permissions.IsAdminUser]

    def post(self, request, pk):
        from django.contrib.auth import get_user_model

        User = get_user_model()
        try:
            user = User.objects.get(pk=pk, role=User.Role.CUSTOMER)
        except User.DoesNotExist:
            return Response({'detail': 'مشتری یافت نشد'}, status=status.HTTP_404_NOT_FOUND)

        settings_obj = WinBackSettings.get_settings()
        existing = _find_active_win_back_code(user)
        reused = existing is not None

        if existing:
            discount = existing
        else:
            now = timezone.now()
            code = _generate_win_back_code(user)
            discount = Discount.objects.create(
                code=code,
                discount_type=settings_obj.discount_type,
                value=settings_obj.value,
                max_discount_amount=settings_obj.max_discount_amount,
                usage_limit=1,
                valid_from=now,
                valid_until=now + timedelta(days=settings_obj.valid_days),
            )
            discount.users.add(user)

        sent = send_win_back_discount_sms(
            str(user.phone), discount.code, discount.discount_type, discount.value,
        )

        from apps.staff_activity.models import StaffActionLog, log_staff_action
        verb = 'دوباره' if reused else ''
        log_staff_action(
            request.user, StaffActionLog.Action.WIN_BACK_SMS_SENT,
            f'پیام دلتنگی برای {user.full_name or user.phone} {verb} با کد {discount.code} ارسال شد'.replace('  ', ' '),
        )

        return Response({
            'sent': sent,
            'reused': reused,
            'code': discount.code,
            'discount_type': discount.discount_type,
            'value': discount.value,
            'valid_until': discount.valid_until,
        })


class AdminUserAssignedDiscountsView(generics.ListAPIView):
    """دکمه‌ی «کدهای تخفیف» کنار «پیام دلتنگی» — همه‌ی کدهای تخفیفی که مستقیماً
    به این مشتری اختصاص یافته‌اند (M2M users)، صرف‌نظر از اینکه استفاده شده/
    منقضی شده/هنوز فعال باشند — تا ادمین قبل از ارسال دوباره، وضعیت واقعی را ببیند."""
    permission_classes = [permissions.IsAdminUser]
    serializer_class = UserAssignedDiscountSerializer

    def get_queryset(self):  # type: ignore[override]
        return Discount.objects.filter(users__id=self.kwargs['pk']).order_by('-created_at')

    def get_serializer_context(self):
        context = super().get_serializer_context()
        discount_ids = [d.id for d in self.get_queryset()]
        used_discount_ids = set(
            DiscountUsage.objects.filter(
                discount_id__in=discount_ids, user_id=self.kwargs['pk'],
            ).values_list('discount_id', flat=True)
        )
        context['used_discount_ids'] = used_discount_ids
        return context
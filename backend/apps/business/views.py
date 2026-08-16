from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import BusinessHours, SpecialDay, DeliverySettings, CafeInfo, ReservationSettings, Banner, SocialLink
from .serializers import (
    BusinessHoursSerializer, SpecialDaySerializer,
    DeliverySettingsSerializer, CafeInfoSerializer, ReservationSettingsSerializer,
    BannerSerializer, BannerAdminSerializer, SocialLinkSerializer,
)
from .utils import get_cafe_status
from apps.accounts.permissions import IsWaiter
from apps.staff_activity.models import StaffActionLog, log_staff_action


class AdminForceCloseTodayView(APIView):
    """
    بستن/بازکردن فوری کافه فقط برای امروز — با اولویت بر ساعات هفتگی تعریف‌شده.
    از همان رکورد SpecialDay امروز استفاده می‌کند که get_cafe_status پیش از
    ساعات هفتگی بررسی می‌کند؛ چون کلید آن تاریخ «امروز» است، فردا خودکار و
    بدون نیاز به هیچ job زمان‌بندی‌شده‌ای به برنامه‌ی عادی هفتگی برمی‌گردد.
    ادمین همیشه دسترسی دارد؛ سرپرست سالن فقط اگر can_force_close_cafe فعال باشد.
    """
    def get_permissions(self):
        if self.request.user and self.request.user.is_staff:
            return [permissions.IsAdminUser()]
        return [IsWaiter()]

    def _check_waiter_permission(self, request):
        if request.user.is_staff:
            return None
        perm = getattr(request.user, 'waiter_permissions', None)
        if not perm or not perm.can_force_close_cafe:
            return Response({'detail': 'دسترسی به بستن فوری کافه ندارید'}, status=status.HTTP_403_FORBIDDEN)
        return None

    def post(self, request):
        denied = self._check_waiter_permission(request)
        if denied:
            return denied

        today = timezone.localdate()
        actor_name = request.user.full_name or str(request.user.phone)
        SpecialDay.objects.update_or_create(
            date=today,
            defaults={
                'is_closed': True,
                'open_time': None,
                'close_time': None,
                'note': f'بسته شده دستی توسط {actor_name}',
            },
        )
        log_staff_action(
            request.user, StaffActionLog.Action.CAFE_FORCE_CLOSED, 'کافه را برای امروز فوری بست',
        )
        return Response(get_cafe_status())

    def delete(self, request):
        denied = self._check_waiter_permission(request)
        if denied:
            return denied

        today = timezone.localdate()
        SpecialDay.objects.filter(date=today).delete()
        log_staff_action(
            request.user, StaffActionLog.Action.CAFE_REOPENED, 'کافه را دوباره باز کرد',
        )
        return Response(get_cafe_status())


class CafeStatusView(APIView):
    """وضعیت فعلی کافه — عمومی"""
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        return Response(get_cafe_status())


class PublicBusinessHoursView(generics.ListAPIView):
    """ساعات کاری هفتگی — عمومی"""
    permission_classes = [permissions.AllowAny]
    serializer_class = BusinessHoursSerializer
    queryset = BusinessHours.objects.all().order_by('day_of_week')


class AdminBusinessHoursView(APIView):
    """مدیریت ساعات کاری هفتگی"""
    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        hours = BusinessHours.objects.all().order_by('day_of_week')
        return Response(BusinessHoursSerializer(hours, many=True).data)

    def put(self, request):
        """آپدیت bulk همه روزها"""
        if not isinstance(request.data, list):
            return Response({'detail': 'آرایه‌ای از روزها ارسال کنید'}, status=status.HTTP_400_BAD_REQUEST)
        updated = []
        for item in request.data:
            day = item.get('day_of_week')
            try:
                bh = BusinessHours.objects.get(day_of_week=day)
            except BusinessHours.DoesNotExist:
                return Response({'detail': f'روز {day} یافت نشد'}, status=status.HTTP_400_BAD_REQUEST)
            ser = BusinessHoursSerializer(bh, data=item, partial=True)
            ser.is_valid(raise_exception=True)
            ser.save()
            updated.append(ser.data)
        return Response(updated)


class AdminBusinessHoursDayView(APIView):
    """آپدیت یک روز خاص"""
    permission_classes = [permissions.IsAdminUser]

    def patch(self, request, day_of_week):
        try:
            bh = BusinessHours.objects.get(day_of_week=day_of_week)
        except BusinessHours.DoesNotExist:
            return Response({'detail': 'روز یافت نشد'}, status=status.HTTP_404_NOT_FOUND)
        ser = BusinessHoursSerializer(bh, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(ser.data)


class AdminSpecialDayView(generics.ListCreateAPIView):
    """مدیریت روزهای خاص"""
    permission_classes = [permissions.IsAdminUser]
    serializer_class = SpecialDaySerializer
    queryset = SpecialDay.objects.all().order_by('date')


class AdminSpecialDayDetailView(generics.DestroyAPIView):
    permission_classes = [permissions.IsAdminUser]
    serializer_class = SpecialDaySerializer
    queryset = SpecialDay.objects.all()


class DeliverySettingsView(APIView):
    """تنظیمات ارسال — عمومی"""
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        settings = DeliverySettings.get_settings()
        return Response(DeliverySettingsSerializer(settings).data)


class AdminDeliverySettingsView(APIView):
    """مدیریت تنظیمات ارسال"""
    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        settings = DeliverySettings.get_settings()
        return Response(DeliverySettingsSerializer(settings).data)

    def patch(self, request):
        settings = DeliverySettings.get_settings()
        ser = DeliverySettingsSerializer(settings, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(ser.data)


class CafeInfoView(APIView):
    """اطلاعات کافه — عمومی"""
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        info = CafeInfo.get_info()
        return Response(CafeInfoSerializer(info).data)


class AdminCafeInfoView(APIView):
    """مدیریت اطلاعات کافه"""
    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        info = CafeInfo.get_info()
        return Response(CafeInfoSerializer(info).data)

    def patch(self, request):
        info = CafeInfo.get_info()
        ser = CafeInfoSerializer(info, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(ser.data)


class BannerListView(generics.ListAPIView):
    """بنرهای فعال و در بازه‌ی زمانی جاری — عمومی"""
    permission_classes = [permissions.AllowAny]
    serializer_class = BannerSerializer

    def get_queryset(self):
        return Banner.visible_now().order_by('order', '-created_at')


class AdminBannerListCreateView(generics.ListCreateAPIView):
    """مدیریت بنرها"""
    permission_classes = [permissions.IsAdminUser]
    serializer_class = BannerAdminSerializer
    queryset = Banner.objects.all()


class AdminBannerDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [permissions.IsAdminUser]
    serializer_class = BannerAdminSerializer
    queryset = Banner.objects.all()


class SocialLinkListView(generics.ListAPIView):
    """شبکه‌های اجتماعی فعال — عمومی (برای فوتر)"""
    permission_classes = [permissions.AllowAny]
    serializer_class = SocialLinkSerializer
    queryset = SocialLink.objects.filter(is_active=True)


class AdminSocialLinkListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAdminUser]
    serializer_class = SocialLinkSerializer
    queryset = SocialLink.objects.all()


class AdminSocialLinkDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [permissions.IsAdminUser]
    serializer_class = SocialLinkSerializer
    queryset = SocialLink.objects.all()


class ReservationSettingsView(APIView):
    """تنظیمات رزرو — عمومی"""
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        s = ReservationSettings.get_settings()
        return Response(ReservationSettingsSerializer(s).data)


class AdminReservationSettingsView(APIView):
    """مدیریت تنظیمات رزرو"""
    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        s = ReservationSettings.get_settings()
        return Response(ReservationSettingsSerializer(s).data)

    def patch(self, request):
        s = ReservationSettings.get_settings()
        ser = ReservationSettingsSerializer(s, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(ser.data)

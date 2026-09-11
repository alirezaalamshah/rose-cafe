from __future__ import annotations

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, generics, permissions
from rest_framework.serializers import BaseSerializer
from rest_framework_simplejwt.tokens import RefreshToken
from django.shortcuts import get_object_or_404
from django.conf import settings

from .models import User, Address, WaiterPermission
from .serializers import (
    SendOTPSerializer, VerifyOTPSerializer,
    RegisterSerializer, RegisterVerifySerializer,
    LoginSerializer, ForgotPasswordSerializer, ResetPasswordSerializer,
    UserSerializer, UserUpdateSerializer, AddressSerializer,
    AdminUserSerializer, WaiterPermissionSerializer, ChangePasswordSerializer,
)
from .permissions import IsWaiter
from .otp import generate_otp, save_otp, verify_otp
from apps.common import geocoding
from apps.notifications.sms import send_otp_sms
from apps.common.pagination import StandardPagination
from .throttles import OTPSendThrottle, OTPSendIPThrottle, OTPVerifyThrottle, LoginThrottle


class SendOTPView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [OTPSendThrottle, OTPSendIPThrottle]

    def post(self, request):
        serializer = SendOTPSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        phone: str = serializer.validated_data['phone']

        otp = generate_otp()
        save_otp(phone, otp)
        send_otp_sms(phone, otp)

        response_data: dict = {
            'detail': 'کد تایید ارسال شد',
            'expires_in': settings.OTP_EXPIRY_SECONDS,
        }
        if settings.DEBUG:
            response_data['otp'] = otp

        return Response(response_data, status=status.HTTP_200_OK)


class VerifyOTPView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [OTPVerifyThrottle]

    def post(self, request):
        serializer = VerifyOTPSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        phone: str = serializer.validated_data['phone']
        otp: str = serializer.validated_data['otp']

        if not verify_otp(phone, otp):
            return Response(
                {'detail': 'کد تایید نامعتبر یا منقضی شده است'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user, created = User.objects.get_or_create(phone=phone)

        refresh = RefreshToken.for_user(user)
        return Response({
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user': UserSerializer(user).data,
            'is_new_user': created,
        }, status=status.HTTP_200_OK)


# ─── Auth جدید ───────────────────────────────────────────────────────────────

class RegisterView(APIView):
    """مرحله ۱ ثبت‌نام: ارسال OTP به شماره جدید"""
    permission_classes = [permissions.AllowAny]
    throttle_classes = [OTPSendThrottle, OTPSendIPThrottle]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        phone = serializer.validated_data['phone']

        otp = generate_otp()
        save_otp(phone, otp)
        send_otp_sms(phone, otp)

        response_data = {'detail': 'کد تایید ارسال شد', 'expires_in': settings.OTP_EXPIRY_SECONDS}
        if settings.DEBUG:
            response_data['otp'] = otp
        return Response(response_data)


class RegisterVerifyView(APIView):
    """مرحله ۲ ثبت‌نام: تأیید OTP + تنظیم رمز عبور"""
    permission_classes = [permissions.AllowAny]
    throttle_classes = [OTPVerifyThrottle]

    def post(self, request):
        serializer = RegisterVerifySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        phone = data['phone']

        if not verify_otp(phone, data['otp']):
            return Response({'detail': 'کد تایید نامعتبر یا منقضی شده است'}, status=status.HTTP_400_BAD_REQUEST)

        user, _ = User.objects.get_or_create(phone=phone)
        user.set_password(data['password'])
        user.save(update_fields=['password'])

        refresh = RefreshToken.for_user(user)
        return Response({
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user': UserSerializer(user).data,
        }, status=status.HTTP_201_CREATED)


class LoginView(APIView):
    """ورود با شماره موبایل + رمز عبور"""
    permission_classes = [permissions.AllowAny]
    throttle_classes = [LoginThrottle]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        phone = serializer.validated_data['phone']
        password = serializer.validated_data['password']

        try:
            user = User.objects.get(phone=phone)
        except User.DoesNotExist:
            return Response({'detail': 'شماره موبایل یا رمز عبور اشتباه است'}, status=status.HTTP_401_UNAUTHORIZED)

        if not user.has_usable_password():
            return Response(
                {'detail': 'رمز عبور تنظیم نشده — از گزینه «فراموشی رمز» استفاده کنید', 'code': 'no_password'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not user.check_password(password):
            return Response({'detail': 'شماره موبایل یا رمز عبور اشتباه است'}, status=status.HTTP_401_UNAUTHORIZED)

        if not user.is_active:
            return Response({'detail': 'حساب کاربری غیرفعال است'}, status=status.HTTP_403_FORBIDDEN)

        refresh = RefreshToken.for_user(user)
        return Response({
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user': UserSerializer(user).data,
        })


class ForgotPasswordView(APIView):
    """فراموشی رمز: ارسال OTP به شماره موجود"""
    permission_classes = [permissions.AllowAny]
    throttle_classes = [OTPSendThrottle, OTPSendIPThrottle]

    def post(self, request):
        serializer = ForgotPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        phone = serializer.validated_data['phone']

        otp = generate_otp()
        save_otp(phone, otp)
        send_otp_sms(phone, otp)

        response_data = {'detail': 'کد بازیابی ارسال شد', 'expires_in': settings.OTP_EXPIRY_SECONDS}
        if settings.DEBUG:
            response_data['otp'] = otp
        return Response(response_data)


class ResetPasswordView(APIView):
    """بازنشانی رمز: تأیید OTP + رمز جدید"""
    permission_classes = [permissions.AllowAny]
    throttle_classes = [OTPVerifyThrottle]

    def post(self, request):
        serializer = ResetPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        phone = data['phone']

        if not verify_otp(phone, data['otp']):
            return Response({'detail': 'کد تایید نامعتبر یا منقضی شده است'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user = User.objects.get(phone=phone)
        except User.DoesNotExist:
            return Response({'detail': 'کاربر یافت نشد'}, status=status.HTTP_404_NOT_FOUND)

        user.set_password(data['password'])
        user.save(update_fields=['password'])

        refresh = RefreshToken.for_user(user)
        return Response({
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user': UserSerializer(user).data,
            'detail': 'رمز عبور با موفقیت تغییر کرد',
        })


class ChangePasswordView(APIView):
    """تغییر رمز عبور برای کاربر لاگین‌شده — هم مشتری هم ادمین/گارسون"""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        user = request.user

        if user.has_usable_password():
            if not data.get('current_password') or not user.check_password(data['current_password']):
                return Response(
                    {'detail': 'رمز عبور فعلی اشتباه است', 'code': 'wrong_current_password'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        user.set_password(data['password'])
        user.save(update_fields=['password'])
        return Response({'detail': 'رمز عبور با موفقیت تغییر کرد'})


class RefreshTokenView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        try:
            refresh = RefreshToken(request.data.get('refresh'))
            return Response({'access': str(refresh.access_token)})
        except Exception:
            return Response(
                {'detail': 'توکن نامعتبر است'},
                status=status.HTTP_401_UNAUTHORIZED,
            )


class MeView(generics.RetrieveUpdateAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self) -> type[BaseSerializer]:
        if self.request.method in ['PUT', 'PATCH']:
            return UserUpdateSerializer
        return UserSerializer

    def get_object(self):
        return self.request.user


class AddressListCreateView(generics.ListCreateAPIView):
    serializer_class = AddressSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Address.objects.filter(user=self.request.user).order_by('-is_default', '-created_at')

    def perform_create(self, serializer: BaseSerializer) -> None:
        serializer.save(user=self.request.user)


class AddressDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = AddressSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Address.objects.filter(user=self.request.user)


class AddressGeocodeSearchView(APIView):
    """جست‌وجوی متنی آدرس -> لیست نتایج با مختصات (Nominatim) — با کلیک صریح دکمه‌ی
    «جستجو» صدا زده می‌شود، نه به‌صورت suggestion زنده (به‌خاطر سقف نرخ Nominatim).
    نتایج به شعاع مجاز ثبت آدرس (SnappSettings.max_delivery_radius_km) محدود می‌شوند —
    هم با viewbox (فیلتر اولیه‌ی سمت Nominatim) هم با فاصله‌ی واقعی هاورساین (چون
    viewbox یک مستطیل است، نه دایره‌ی دقیق؛ نتیجه‌ای در گوشه‌ی مستطیل می‌تواند
    واقعاً خارج از شعاع باشد)."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        query = request.query_params.get('q', '').strip()
        if not query:
            return Response({'detail': 'متن جست‌وجو الزامی است'}, status=status.HTTP_400_BAD_REQUEST)

        from apps.snapp.models import SnappSettings
        from apps.common.utils import haversine_distance_km
        snapp_settings = SnappSettings.get_settings()

        viewbox = None
        store_lat = store_lng = None
        if snapp_settings.store_latitude and snapp_settings.store_longitude:
            store_lat, store_lng = float(snapp_settings.store_latitude), float(snapp_settings.store_longitude)
            radius_km = snapp_settings.max_delivery_radius_km
            # تبدیل تقریبی کیلومتر به درجه‌ی طول/عرض جغرافیایی، برای ساخت کادر جست‌وجو
            deg = radius_km / 111.0
            viewbox = f'{store_lng-deg},{store_lat+deg},{store_lng+deg},{store_lat-deg}'

        result = geocoding.search_address(query, viewbox=viewbox, bounded=bool(viewbox))
        if not result['success']:
            return Response({'detail': result['message']}, status=status.HTTP_502_BAD_GATEWAY)

        results = result['results']
        if store_lat is not None:
            filtered = []
            for r in results:
                distance = haversine_distance_km(store_lat, store_lng, r['latitude'], r['longitude'])
                if distance <= snapp_settings.max_delivery_radius_km:
                    filtered.append(r)
            results = filtered

        if not results:
            return Response({
                'results': [],
                'detail': f'آدرسی در محدوده‌ی {snapp_settings.max_delivery_radius_km} کیلومتری کافه با این متن یافت نشد — '
                          'می‌توانید موقعیت را مستقیم روی نقشه انتخاب کنید',
            })
        return Response({'results': results})


class AddressReverseGeocodeView(APIView):
    """مختصات پین -> آدرس خوانا، برای پر کردن خودکار فیلدهای فرم بعد از کلیک/درگ روی نقشه."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        latitude = request.query_params.get('lat')
        longitude = request.query_params.get('lng')
        if not latitude or not longitude:
            return Response({'detail': 'مختصات الزامی است'}, status=status.HTTP_400_BAD_REQUEST)

        result = geocoding.reverse_geocode(latitude, longitude)
        if not result['success']:
            return Response({'detail': result['message']}, status=status.HTTP_502_BAD_GATEWAY)
        return Response(result)


# ─── Admin User Views ───────────────────────────────────────────────────────

class AdminUserListView(generics.ListAPIView):
    permission_classes = [permissions.IsAdminUser]
    serializer_class = AdminUserSerializer
    pagination_class = StandardPagination

    def get_queryset(self):
        from .customer_insights import annotate_customer_stats
        qs = User.objects.all().select_related('waiter_permissions').order_by('-date_joined')
        search = self.request.query_params.get('search', '')
        role = self.request.query_params.get('role', '')
        if search:
            from django.db.models import Q
            qs = qs.filter(
                Q(full_name__icontains=search) | Q(phone__icontains=search)
            )
        if role:
            qs = qs.filter(role=role)
        return annotate_customer_stats(qs)


class AdminUserDetailView(generics.RetrieveUpdateAPIView):
    permission_classes = [permissions.IsAdminUser]
    serializer_class = AdminUserSerializer

    def get_queryset(self):
        return User.objects.all().select_related('waiter_permissions')


class AdminWaiterPermissionView(APIView):
    """Admin manages a specific waiter's permissions"""
    permission_classes = [permissions.IsAdminUser]

    def get(self, request, pk):
        user = get_object_or_404(User, pk=pk, role=User.Role.WAITER)
        perm, _ = WaiterPermission.objects.get_or_create(user=user)
        return Response(WaiterPermissionSerializer(perm).data)

    def patch(self, request, pk):
        user = get_object_or_404(User, pk=pk, role=User.Role.WAITER)
        perm, _ = WaiterPermission.objects.get_or_create(user=user)
        serializer = WaiterPermissionSerializer(perm, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


# ─── Admin: Customer 360 — گزارش کامل یک مشتری برای ادمین ─────────────────────
# صفحه‌ی جزئیات مشتری در پنل ادمین (تب‌های خلاصه/سفارش/کیف‌پول/تخفیف/رزرو/نظر) از
# این ویوها تغذیه می‌شود. هرکدام لاغر و مستقل‌اند، سریالایزرهای موجود اپ‌های دیگر را
# (نه چیز جدید) با فیلتر روی همین کاربر دوباره استفاده می‌کنند.

class AdminUserSummaryView(APIView):
    """خلاصه‌ی آماری یک مشتری — برای تب «خلاصه» صفحه‌ی جزئیات."""
    permission_classes = [permissions.IsAdminUser]

    def get(self, request, pk):
        from django.db.models import Sum, Count, Q
        from apps.orders.models import Order
        from apps.wallet.services import get_or_create_wallet
        from apps.discounts.models import DiscountUsage
        from apps.reservations.models import Reservation
        from apps.reviews.models import Review, CafeReview

        user = get_object_or_404(User, pk=pk)

        real_orders = Order.objects.filter(user=user, is_paid=True).exclude(
            status__in=[Order.Status.CANCELLED, Order.Status.REJECTED]
        )
        order_agg = real_orders.aggregate(
            count=Count('id'), total_spent=Sum('final_price'), total_discount=Sum('discount_amount'),
        )
        last_order = Order.objects.filter(user=user).order_by('-created_at').first()

        wallet = get_or_create_wallet(user)

        discount_usage_count = DiscountUsage.objects.filter(user=user).count()

        reservation_agg = Reservation.objects.filter(
            user=user, status__in=['completed', 'no_show'],
        ).aggregate(resolved=Count('id'), no_show=Count('id', filter=Q(status='no_show')))
        resolved = reservation_agg['resolved']
        no_show_rate = round(reservation_agg['no_show'] / resolved * 100, 1) if resolved else 0

        review_count = Review.objects.filter(user=user).count() + CafeReview.objects.filter(user=user).count()

        from .customer_insights import tier_for
        orders_count = order_agg['count'] or 0
        total_spent = order_agg['total_spent'] or 0

        return Response({
            'profile': AdminUserSerializer(user).data,
            'orders_count': orders_count,
            'total_spent': total_spent,
            'avg_order': round(total_spent / orders_count) if orders_count else 0,
            'tier': tier_for(orders_count, total_spent),
            'total_discount_used': order_agg['total_discount'] or 0,
            'discount_usage_count': discount_usage_count,
            'last_order_at': last_order.created_at.isoformat() if last_order else None,
            'wallet_balance': wallet.balance,
            'reservations_count': Reservation.objects.filter(user=user).count(),
            'reservation_no_show_rate': no_show_rate,
            'reviews_count': review_count,
            'addresses_count': user.addresses.count(),
        })


class AdminUserWalletAdjustmentView(APIView):
    """تنظیم دستی کیف‌پول مشتری توسط ادمین (مثلاً جبران خسارت یک سفارش خراب)."""
    permission_classes = [permissions.IsAdminUser]

    def post(self, request, pk):
        from apps.wallet.services import credit, debit, InsufficientBalanceError
        from apps.wallet.models import WalletTransaction

        user = get_object_or_404(User, pk=pk)
        try:
            amount = int(request.data.get('amount'))
        except (TypeError, ValueError):
            return Response({'detail': 'مبلغ نامعتبر است'}, status=status.HTTP_400_BAD_REQUEST)
        if amount == 0:
            return Response({'detail': 'مبلغ نمی‌تواند صفر باشد'}, status=status.HTTP_400_BAD_REQUEST)

        description = (request.data.get('description') or '').strip()
        if not description:
            return Response({'detail': 'دلیل تنظیم دستی الزامی است'}, status=status.HTTP_400_BAD_REQUEST)
        actor_name = request.user.full_name or str(request.user.phone)
        full_description = f'{description} — توسط {actor_name}'

        try:
            if amount > 0:
                wallet = credit(user, amount, WalletTransaction.Type.ADMIN_ADJUSTMENT, description=full_description)
                from apps.notifications.sms import send_wallet_topup_sms
                send_wallet_topup_sms(str(user.phone), amount, wallet.balance)
            else:
                wallet = debit(user, abs(amount), WalletTransaction.Type.ADMIN_ADJUSTMENT, description=full_description)
        except InsufficientBalanceError:
            return Response({'detail': 'موجودی کیف‌پول کافی نیست'}, status=status.HTTP_400_BAD_REQUEST)

        from apps.staff_activity.models import StaffActionLog, log_staff_action
        signed_amount = f'{amount:+,}'
        log_staff_action(
            request.user, StaffActionLog.Action.WALLET_ADMIN_ADJUSTMENT,
            f'کیف‌پول {user.full_name or user.phone} را {signed_amount} تومان تنظیم کرد — {description}',
        )

        return Response({'balance': wallet.balance})


class AdminChurnedCustomersView(generics.ListAPIView):
    """مشتریانی که قبلاً واقعاً سفارش می‌دادند ولی مدتی است سفارش نداده‌اند."""
    permission_classes = [permissions.IsAdminUser]
    pagination_class = StandardPagination
    serializer_class = AdminUserSerializer

    def get_queryset(self):
        from django.utils import timezone
        from datetime import timedelta
        from .customer_insights import annotate_customer_stats, CHURN_MIN_ORDERS, CHURN_INACTIVE_DAYS

        cutoff = timezone.now() - timedelta(days=CHURN_INACTIVE_DAYS)
        qs = annotate_customer_stats(User.objects.filter(role=User.Role.CUSTOMER))
        return qs.filter(
            orders_count__gte=CHURN_MIN_ORDERS, last_order_at__isnull=False, last_order_at__lt=cutoff,
        ).order_by('last_order_at')


class AdminUserOrdersView(generics.ListAPIView):
    """تب «سفارش‌ها» — تاریخچه‌ی کامل سفارش‌های این مشتری."""
    permission_classes = [permissions.IsAdminUser]
    pagination_class = StandardPagination

    def get_serializer_class(self):
        from apps.orders.serializers import AdminOrderSerializer
        return AdminOrderSerializer

    def get_queryset(self):
        from apps.orders.models import Order
        return Order.objects.filter(user_id=self.kwargs['pk']).select_related(
            'user', 'address', 'table'
        ).prefetch_related('items__menu_item').order_by('-created_at')


class AdminUserWalletTransactionsView(generics.ListAPIView):
    """تب «کیف‌پول» — دفتر کامل تراکنش‌های این مشتری."""
    permission_classes = [permissions.IsAdminUser]
    pagination_class = StandardPagination

    def get_serializer_class(self):
        from apps.wallet.serializers import WalletTransactionSerializer
        return WalletTransactionSerializer

    def get_queryset(self):
        from apps.wallet.models import WalletTransaction
        return WalletTransaction.objects.filter(
            wallet__user_id=self.kwargs['pk']
        ).select_related('order')


class AdminUserDiscountUsageView(generics.ListAPIView):
    """تب «تخفیف‌ها» — کدهای تخفیفی که این مشتری استفاده کرده."""
    permission_classes = [permissions.IsAdminUser]
    pagination_class = StandardPagination

    def get_serializer_class(self):
        from apps.discounts.serializers import DiscountUsageSerializer
        return DiscountUsageSerializer

    def get_queryset(self):
        from apps.discounts.models import DiscountUsage
        return DiscountUsage.objects.filter(
            user_id=self.kwargs['pk']
        ).select_related('discount').order_by('-used_at')

    def get_serializer_context(self):
        from apps.orders.models import Order
        context = super().get_serializer_context()
        order_ids = [u.order_id for u in self.get_queryset()]
        order_lookup = {
            o['id']: o for o in Order.objects.filter(id__in=order_ids).values('id', 'order_number', 'discount_amount')
        }
        context['order_lookup'] = order_lookup
        return context


class AdminUserReservationsView(generics.ListAPIView):
    """تب «رزروها» — تاریخچه‌ی رزرو میز این مشتری."""
    permission_classes = [permissions.IsAdminUser]
    pagination_class = StandardPagination

    def get_serializer_class(self):
        from apps.reservations.serializers import AdminReservationSerializer
        return AdminReservationSerializer

    def get_queryset(self):
        from apps.reservations.models import Reservation
        return Reservation.objects.filter(
            user_id=self.kwargs['pk']
        ).select_related('table').order_by('-date', '-start_time')


class AdminUserReviewsView(APIView):
    """تب «نظرات» — نظرات این مشتری روی آیتم‌های منو و روی خود کافه."""
    permission_classes = [permissions.IsAdminUser]

    def get(self, request, pk):
        from apps.reviews.models import Review, CafeReview
        from apps.reviews.serializers import AdminReviewSerializer, AdminCafeReviewSerializer

        get_object_or_404(User, pk=pk)
        menu_reviews = Review.objects.filter(user_id=pk).select_related('menu_item').order_by('-created_at')
        cafe_reviews = CafeReview.objects.filter(user_id=pk).order_by('-created_at')
        return Response({
            'menu_reviews': AdminReviewSerializer(menu_reviews, many=True).data,
            'cafe_reviews': AdminCafeReviewSerializer(cafe_reviews, many=True).data,
        })


# ─── Waiter Self Views ───────────────────────────────────────────────────────

class WaiterMeView(APIView):
    """Returns the authenticated waiter's own profile and permissions"""
    permission_classes = [IsWaiter]

    def get(self, request):
        user = request.user
        perm, _ = WaiterPermission.objects.get_or_create(user=user)
        return Response({
            'id': user.id,
            'phone': str(user.phone),
            'full_name': user.full_name,
            'role': user.role,
            'permissions': WaiterPermissionSerializer(perm).data,
        })

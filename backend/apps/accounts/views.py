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


# ─── Admin User Views ───────────────────────────────────────────────────────

class AdminUserListView(generics.ListAPIView):
    permission_classes = [permissions.IsAdminUser]
    serializer_class = AdminUserSerializer
    pagination_class = StandardPagination

    def get_queryset(self):
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
        return qs


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

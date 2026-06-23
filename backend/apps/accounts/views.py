from __future__ import annotations

from typing import TYPE_CHECKING

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, generics, permissions
from rest_framework.serializers import BaseSerializer
from rest_framework_simplejwt.tokens import RefreshToken
from django.conf import settings

from .models import User, Address
from .serializers import (
    SendOTPSerializer, VerifyOTPSerializer,
    UserSerializer, UserUpdateSerializer, AddressSerializer, AdminUserSerializer
)
from .otp import generate_otp, save_otp, verify_otp
from apps.notifications.sms import send_otp_sms
# from drf_spectacular.utils import extend_schema, OpenApiExample

class SendOTPView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):  # type: ignore[override]
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

    def post(self, request):  # type: ignore[override]
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


class RefreshTokenView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):  # type: ignore[override]
        try:
            refresh = RefreshToken(request.data.get('refresh'))
            return Response({'access': str(refresh.access_token)})
        except Exception:
            return Response(
                {'detail': 'توکن نامعتبر است'},
                status=status.HTTP_401_UNAUTHORIZED,
            )


class MeView(generics.RetrieveUpdateAPIView):  # type: ignore[misc]
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self) -> type[BaseSerializer]:  # type: ignore[override]
        if self.request.method in ['PUT', 'PATCH']:
            return UserUpdateSerializer
        return UserSerializer

    def get_object(self):  # type: ignore[override]
        return self.request.user


class AddressListCreateView(generics.ListCreateAPIView):  # type: ignore[misc]
    serializer_class = AddressSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):  # type: ignore[override]
        return Address.objects.filter(user=self.request.user).order_by('-is_default', '-created_at')

    def perform_create(self, serializer: BaseSerializer) -> None:
        serializer.save(user=self.request.user)


class AddressDetailView(generics.RetrieveUpdateDestroyAPIView):  # type: ignore[misc]
    serializer_class = AddressSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):  # type: ignore[override]
        return Address.objects.filter(user=self.request.user)


class AdminUserListView(generics.ListAPIView):  # type: ignore[misc]
    permission_classes = [permissions.IsAdminUser]
    serializer_class = AdminUserSerializer

    def get_queryset(self):  # type: ignore[override]
        qs = User.objects.all().order_by('-date_joined')
        search = self.request.query_params.get('search', '')
        if search:
            from django.db.models import Q
            qs = qs.filter(
                Q(full_name__icontains=search) | Q(phone__icontains=search)
            )
        return qs


class AdminUserDetailView(generics.RetrieveUpdateAPIView):  # type: ignore[misc]
    permission_classes = [permissions.IsAdminUser]
    serializer_class = AdminUserSerializer

    def get_queryset(self):  # type: ignore[override]
        return User.objects.all()
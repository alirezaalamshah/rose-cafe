from django.urls import path
from .views import (
    SendOTPView, VerifyOTPView, RefreshTokenView,
    RegisterView, RegisterVerifyView, LoginView,
    ForgotPasswordView, ResetPasswordView,
    MeView, AddressListCreateView, AddressDetailView,
    AdminUserListView, AdminUserDetailView, AdminWaiterPermissionView,
    WaiterMeView, ChangePasswordView,
)

urlpatterns = [
    # Auth جدید (رمز عبور)
    path('register/', RegisterView.as_view(), name='register'),
    path('register/verify/', RegisterVerifyView.as_view(), name='register-verify'),
    path('login/', LoginView.as_view(), name='login'),
    path('forgot-password/', ForgotPasswordView.as_view(), name='forgot-password'),
    path('reset-password/', ResetPasswordView.as_view(), name='reset-password'),

    # Auth قدیمی (OTP — نگه‌داشته شده برای سازگاری)
    path('send-otp/', SendOTPView.as_view(), name='send-otp'),
    path('verify-otp/', VerifyOTPView.as_view(), name='verify-otp'),
    path('refresh/', RefreshTokenView.as_view(), name='token-refresh'),
    path('me/', MeView.as_view(), name='me'),
    path('change-password/', ChangePasswordView.as_view(), name='change-password'),
    path('addresses/', AddressListCreateView.as_view(), name='addresses'),
    path('addresses/<int:pk>/', AddressDetailView.as_view(), name='address-detail'),

    # Admin user management
    path('admin/users/', AdminUserListView.as_view(), name='admin-users'),
    path('admin/users/<int:pk>/', AdminUserDetailView.as_view(), name='admin-user-detail'),
    path('admin/users/<int:pk>/waiter-permissions/', AdminWaiterPermissionView.as_view(), name='admin-waiter-permissions'),

    # Waiter self
    path('waiter/me/', WaiterMeView.as_view(), name='waiter-me'),
]

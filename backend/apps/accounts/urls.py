from django.urls import path
from .views import (
    SendOTPView, VerifyOTPView, RefreshTokenView,
    RegisterView, RegisterVerifyView, LoginView,
    ForgotPasswordView, ResetPasswordView,
    MeView, AddressListCreateView, AddressDetailView,
    AddressGeocodeSearchView, AddressReverseGeocodeView,
    AdminUserListView, AdminUserDetailView, AdminWaiterPermissionView,
    AdminUserSummaryView, AdminUserOrdersView, AdminUserWalletTransactionsView,
    AdminUserDiscountUsageView, AdminUserReservationsView, AdminUserReviewsView,
    AdminUserWalletAdjustmentView, AdminChurnedCustomersView,
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
    path('addresses/geocode/search/', AddressGeocodeSearchView.as_view(), name='address-geocode-search'),
    path('addresses/geocode/reverse/', AddressReverseGeocodeView.as_view(), name='address-geocode-reverse'),

    # Admin user management
    path('admin/users/', AdminUserListView.as_view(), name='admin-users'),
    path('admin/users/<int:pk>/', AdminUserDetailView.as_view(), name='admin-user-detail'),
    path('admin/users/<int:pk>/waiter-permissions/', AdminWaiterPermissionView.as_view(), name='admin-waiter-permissions'),
    path('admin/users/<int:pk>/summary/', AdminUserSummaryView.as_view(), name='admin-user-summary'),
    path('admin/users/<int:pk>/orders/', AdminUserOrdersView.as_view(), name='admin-user-orders'),
    path('admin/users/<int:pk>/wallet-transactions/', AdminUserWalletTransactionsView.as_view(), name='admin-user-wallet-transactions'),
    path('admin/users/<int:pk>/discount-usage/', AdminUserDiscountUsageView.as_view(), name='admin-user-discount-usage'),
    path('admin/users/<int:pk>/reservations/', AdminUserReservationsView.as_view(), name='admin-user-reservations'),
    path('admin/users/<int:pk>/reviews/', AdminUserReviewsView.as_view(), name='admin-user-reviews'),
    path('admin/users/<int:pk>/wallet-adjustment/', AdminUserWalletAdjustmentView.as_view(), name='admin-user-wallet-adjustment'),
    path('admin/customers/churned/', AdminChurnedCustomersView.as_view(), name='admin-customers-churned'),

    # Waiter self
    path('waiter/me/', WaiterMeView.as_view(), name='waiter-me'),
]

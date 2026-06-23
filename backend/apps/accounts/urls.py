from django.urls import path
from .views import (
    SendOTPView, VerifyOTPView, RefreshTokenView,
    MeView, AddressListCreateView, AddressDetailView,
    AdminUserListView, AdminUserDetailView,
)

urlpatterns = [
    path('send-otp/', SendOTPView.as_view(), name='send-otp'),
    path('verify-otp/', VerifyOTPView.as_view(), name='verify-otp'),
    path('refresh/', RefreshTokenView.as_view(), name='token-refresh'),
    path('me/', MeView.as_view(), name='me'),
    path('addresses/', AddressListCreateView.as_view(), name='addresses'),
    path('addresses/<int:pk>/', AddressDetailView.as_view(), name='address-detail'),
    path('admin/users/', AdminUserListView.as_view(), name='admin-users'),
    path('admin/users/<int:pk>/', AdminUserDetailView.as_view(), name='admin-user-detail'),
]
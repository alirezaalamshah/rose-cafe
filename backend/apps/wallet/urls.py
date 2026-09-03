from django.urls import path
from .views import (
    MyWalletView, WalletTransactionListView,
    WalletTopupRequestView, WalletTopupVerifyView,
    LoyaltySettingsView, AdminLoyaltySettingsView,
)

urlpatterns = [
    path('me/', MyWalletView.as_view(), name='wallet-me'),
    path('transactions/', WalletTransactionListView.as_view(), name='wallet-transactions'),
    path('topup/request/', WalletTopupRequestView.as_view(), name='wallet-topup-request'),
    path('topup/verify/', WalletTopupVerifyView.as_view(), name='wallet-topup-verify'),
    path('loyalty-settings/', LoyaltySettingsView.as_view(), name='loyalty-settings'),
    path('admin/loyalty-settings/', AdminLoyaltySettingsView.as_view(), name='admin-loyalty-settings'),
]

from django.urls import path
from .views import (
    CheckDiscountView, AdminDiscountListCreateView, AdminDiscountDetailView, BirthdayOfferView,
    AdminWinBackSettingsView, AdminSendWinBackSMSView, AdminUserAssignedDiscountsView,
)

urlpatterns = [
    path('check/', CheckDiscountView.as_view(), name='check-discount'),
    path('birthday-offer/', BirthdayOfferView.as_view(), name='birthday-offer'),
    path('admin/', AdminDiscountListCreateView.as_view(), name='admin-discounts'),
    path('admin/<int:pk>/', AdminDiscountDetailView.as_view(), name='admin-discount-detail'),
    path('admin/win-back-settings/', AdminWinBackSettingsView.as_view(), name='admin-win-back-settings'),
    path('admin/win-back/<int:pk>/send/', AdminSendWinBackSMSView.as_view(), name='admin-win-back-send'),
    path('admin/user/<int:pk>/assigned/', AdminUserAssignedDiscountsView.as_view(), name='admin-user-assigned-discounts'),
]
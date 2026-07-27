from django.urls import path
from .views import CheckDiscountView, AdminDiscountListCreateView, AdminDiscountDetailView, BirthdayOfferView

urlpatterns = [
    path('check/', CheckDiscountView.as_view(), name='check-discount'),
    path('birthday-offer/', BirthdayOfferView.as_view(), name='birthday-offer'),
    path('admin/', AdminDiscountListCreateView.as_view(), name='admin-discounts'),
    path('admin/<int:pk>/', AdminDiscountDetailView.as_view(), name='admin-discount-detail'),
]
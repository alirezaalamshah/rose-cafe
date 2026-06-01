from django.urls import path
from .views import CheckDiscountView, AdminDiscountListCreateView, AdminDiscountDetailView

urlpatterns = [
    path('check/', CheckDiscountView.as_view(), name='check-discount'),
    path('admin/', AdminDiscountListCreateView.as_view(), name='admin-discounts'),
    path('admin/<int:pk>/', AdminDiscountDetailView.as_view(), name='admin-discount-detail'),
]
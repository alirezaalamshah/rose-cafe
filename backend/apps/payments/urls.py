from django.urls import path
from .views import (
    PaymentRequestView, PaymentVerifyView,
    PaymentHistoryView, AdminPaymentListView,
)

urlpatterns = [
    path('request/', PaymentRequestView.as_view(), name='payment-request'),
    path('verify/', PaymentVerifyView.as_view(), name='payment-verify'),
    path('history/', PaymentHistoryView.as_view(), name='payment-history'),
    path('admin/', AdminPaymentListView.as_view(), name='admin-payments'),
]
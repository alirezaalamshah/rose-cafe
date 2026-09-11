from django.urls import path
from .views import (
    AdminReceiptSettingsView, WalkInOrderCreateView, WalkInOrderMenuView, WalkInOrderTableView,
    PendingPrintJobsView, AckPrintJobView,
)

urlpatterns = [
    path('admin/receipt-settings/', AdminReceiptSettingsView.as_view(), name='pos-receipt-settings'),
    path('walk-in-orders/', WalkInOrderCreateView.as_view(), name='pos-walk-in-order-create'),
    path('walk-in-orders/menu/', WalkInOrderMenuView.as_view(), name='pos-walk-in-order-menu'),
    path('walk-in-orders/tables/', WalkInOrderTableView.as_view(), name='pos-walk-in-order-tables'),
    path('print-jobs/pending/', PendingPrintJobsView.as_view(), name='pos-print-jobs-pending'),
    path('print-jobs/<int:pk>/ack/', AckPrintJobView.as_view(), name='pos-print-job-ack'),
]

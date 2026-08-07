from django.urls import path
from .views import (
    OrderListCreateView, OrderDetailView, OrderCancelView,
    AdminOrderListView, AdminOrderDetailView, AdminOrderStatusUpdateView,
    NearestOrderDateView,
    WaiterOrderListView, WaiterOrderStatusUpdateView,
    ConfirmCashPaymentView, OrderApproveView, OrderRejectView,
)

urlpatterns = [
    path('', OrderListCreateView.as_view(), name='orders'),
    path('<int:pk>/', OrderDetailView.as_view(), name='order-detail'),
    path('<int:pk>/cancel/', OrderCancelView.as_view(), name='order-cancel'),
    path('<int:pk>/confirm-cash/', ConfirmCashPaymentView.as_view(), name='order-confirm-cash'),
    path('<int:pk>/approve/', OrderApproveView.as_view(), name='order-approve'),
    path('<int:pk>/reject/', OrderRejectView.as_view(), name='order-reject'),

    # Admin
    path('admin/', AdminOrderListView.as_view(), name='admin-orders'),
    path('admin/nearest-date/', NearestOrderDateView.as_view(), name='admin-orders-nearest-date'),
    path('admin/<int:pk>/', AdminOrderDetailView.as_view(), name='admin-order-detail'),
    path('admin/<int:pk>/status/', AdminOrderStatusUpdateView.as_view(), name='admin-order-status'),

    # Waiter
    path('waiter/', WaiterOrderListView.as_view(), name='waiter-orders'),
    path('waiter/<int:pk>/status/', WaiterOrderStatusUpdateView.as_view(), name='waiter-order-status'),
]

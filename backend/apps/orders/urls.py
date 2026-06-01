from django.urls import path
from .views import (
    OrderListCreateView, OrderDetailView, OrderCancelView,
    AdminOrderListView, AdminOrderDetailView, AdminOrderStatusUpdateView,
)

urlpatterns = [
    path('', OrderListCreateView.as_view(), name='orders'),
    path('<int:pk>/', OrderDetailView.as_view(), name='order-detail'),
    path('<int:pk>/cancel/', OrderCancelView.as_view(), name='order-cancel'),

    # Admin
    path('admin/', AdminOrderListView.as_view(), name='admin-orders'),
    path('admin/<int:pk>/', AdminOrderDetailView.as_view(), name='admin-order-detail'),
    path('admin/<int:pk>/status/', AdminOrderStatusUpdateView.as_view(), name='admin-order-status'),
]
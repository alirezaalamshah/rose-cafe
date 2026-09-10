from django.urls import path
from .views import (
    AdminSnappSettingsView, DispatchToSnappView, RetryDispatchToSnappView,
    CancelSnappCourierView, SnappWebhookView, SnappCourierLocationView,
    SnappDeliveryCategoriesView, ResetSnappCircuitBreakerView, DeliveryZoneInfoView,
)

urlpatterns = [
    path('webhook/', SnappWebhookView.as_view(), name='snapp-webhook'),
    path('delivery-zone/', DeliveryZoneInfoView.as_view(), name='snapp-delivery-zone'),
    path('admin/settings/', AdminSnappSettingsView.as_view(), name='snapp-admin-settings'),
    path('admin/settings/delivery-categories/', SnappDeliveryCategoriesView.as_view(), name='snapp-delivery-categories'),
    path('admin/settings/reset-circuit-breaker/', ResetSnappCircuitBreakerView.as_view(), name='snapp-reset-circuit-breaker'),
    path('admin/orders/<int:pk>/dispatch/', DispatchToSnappView.as_view(), name='snapp-dispatch'),
    path('admin/orders/<int:pk>/retry/', RetryDispatchToSnappView.as_view(), name='snapp-retry'),
    path('admin/orders/<int:pk>/cancel/', CancelSnappCourierView.as_view(), name='snapp-cancel'),
    path('orders/<int:pk>/location/', SnappCourierLocationView.as_view(), name='snapp-location'),
]

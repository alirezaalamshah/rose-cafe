from django.urls import path
from .views import (
    CafeStatusView, PublicBusinessHoursView,
    AdminBusinessHoursView, AdminBusinessHoursDayView,
    AdminSpecialDayView, AdminSpecialDayDetailView,
    AdminForceCloseTodayView,
    DeliverySettingsView, AdminDeliverySettingsView,
    CafeInfoView, AdminCafeInfoView,
    ReservationSettingsView, AdminReservationSettingsView,
    BannerListView, AdminBannerListCreateView, AdminBannerDetailView,
    SocialLinkListView, AdminSocialLinkListCreateView, AdminSocialLinkDetailView,
)

urlpatterns = [
    path('status/', CafeStatusView.as_view(), name='cafe-status'),
    path('hours/', PublicBusinessHoursView.as_view(), name='business-hours'),
    path('info/', CafeInfoView.as_view(), name='cafe-info'),
    path('delivery-settings/', DeliverySettingsView.as_view(), name='delivery-settings'),
    path('banners/', BannerListView.as_view(), name='banners'),
    path('social-links/', SocialLinkListView.as_view(), name='social-links'),

    path('admin/hours/', AdminBusinessHoursView.as_view(), name='admin-hours'),
    path('admin/hours/<int:day_of_week>/', AdminBusinessHoursDayView.as_view(), name='admin-hours-day'),
    path('admin/special-days/', AdminSpecialDayView.as_view(), name='admin-special-days'),
    path('admin/special-days/<int:pk>/', AdminSpecialDayDetailView.as_view(), name='admin-special-day-detail'),
    path('admin/force-close-today/', AdminForceCloseTodayView.as_view(), name='admin-force-close-today'),
    path('admin/delivery-settings/', AdminDeliverySettingsView.as_view(), name='admin-delivery-settings'),
    path('admin/info/', AdminCafeInfoView.as_view(), name='admin-cafe-info'),
    path('reservation-settings/', ReservationSettingsView.as_view(), name='reservation-settings'),
    path('admin/reservation-settings/', AdminReservationSettingsView.as_view(), name='admin-reservation-settings'),
    path('admin/banners/', AdminBannerListCreateView.as_view(), name='admin-banners'),
    path('admin/banners/<int:pk>/', AdminBannerDetailView.as_view(), name='admin-banner-detail'),
    path('admin/social-links/', AdminSocialLinkListCreateView.as_view(), name='admin-social-links'),
    path('admin/social-links/<int:pk>/', AdminSocialLinkDetailView.as_view(), name='admin-social-link-detail'),
]

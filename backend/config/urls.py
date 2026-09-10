from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.views.static import serve
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from .dashboard import admin_dashboard

urlpatterns = [
    path('api/admin/', admin.site.urls),
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/auth/', include('apps.accounts.urls')),
    path('api/menu/', include('apps.menu.urls')),
    path('api/orders/', include('apps.orders.urls')),
    path('api/payments/', include('apps.payments.urls')),
    path('api/reservations/', include('apps.reservations.urls')),
    path('api/reviews/', include('apps.reviews.urls')),
    path('api/discounts/', include('apps.discounts.urls')),
    path('api/business/', include('apps.business.urls')),
    path('api/dashboard/', admin_dashboard, name='admin-dashboard'),
    path('api/notifications/', include('apps.notifications.urls')),
    path('api/staff-activity/', include('apps.staff_activity.urls')),
    path('api/wallet/', include('apps.wallet.urls')),
    path('api/snapp/', include('apps.snapp.urls')),
    re_path(r'^api/media/(?P<path>.*)$', serve, {'document_root': settings.MEDIA_ROOT}),
]

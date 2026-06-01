from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from django.utils import timezone


@api_view(['GET'])
@permission_classes([IsAdminUser])
def admin_dashboard(request):
    from apps.orders.models import Order
    from apps.reservations.models import Reservation
    from apps.accounts.models import User
    from apps.payments.models import Payment
    from django.db.models import Sum

    today = timezone.now().date()

    today_orders = Order.objects.filter(created_at__date=today)
    today_revenue = Payment.objects.filter(
        status='success',
        created_at__date=today
    ).aggregate(total=Sum('amount'))['total'] or 0

    return Response({
        'today': {
            'orders_count': today_orders.count(),
            'revenue': today_revenue,
            'pending_orders': today_orders.filter(status='pending').count(),
            'preparing_orders': today_orders.filter(status='preparing').count(),
            'reservations': Reservation.objects.filter(date=today).count(),
        },
        'total': {
            'users': User.objects.count(),
            'orders': Order.objects.count(),
            'revenue': Payment.objects.filter(status='success').aggregate(
                total=Sum('amount')
            )['total'] or 0,
        }
    })


urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/auth/', include('apps.accounts.urls')),
    path('api/menu/', include('apps.menu.urls')),
    path('api/orders/', include('apps.orders.urls')),
    path('api/payments/', include('apps.payments.urls')),
    path('api/reservations/', include('apps.reservations.urls')),
    path('api/reviews/', include('apps.reviews.urls')),
    path('api/discounts/', include('apps.discounts.urls')),
    path('api/dashboard/', admin_dashboard, name='admin-dashboard'),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
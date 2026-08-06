from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.views.static import serve
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from django.utils import timezone


@api_view(['GET'])
@permission_classes([IsAdminUser])
def admin_dashboard(request):
    from apps.orders.models import Order, OrderItem
    from apps.reservations.models import Reservation
    from apps.accounts.models import User
    from apps.payments.models import Payment
    from apps.reviews.models import Review, CafeReview
    from apps.menu.models import MenuItem, Category
    from apps.business.models import Banner
    from django.db.models import Sum, Count, Q
    from django.db.models.functions import TruncDate
    from datetime import timedelta

    today = timezone.now().date()
    week_start = today - timedelta(days=6)

    today_orders = Order.objects.filter(created_at__date=today)
    today_revenue = Payment.objects.filter(
        status='success', created_at__date=today
    ).aggregate(total=Sum('amount'))['total'] or 0
    today_payment_count = Payment.objects.filter(status='success', created_at__date=today).count()
    today_aov = round(today_revenue / today_payment_count) if today_payment_count else 0

    # درآمد ۷ روز گذشته — به‌جای ۱۴ کوئری جدا (۲ به‌ازای هر روز)، فقط ۲ کوئری گروهی
    revenue_by_day = {
        row['day']: row['total']
        for row in Payment.objects.filter(
            status='success', created_at__date__gte=week_start, created_at__date__lte=today,
        ).annotate(day=TruncDate('created_at')).values('day').annotate(total=Sum('amount')).values('day', 'total')
    }
    orders_by_day = {
        row['day']: row['cnt']
        for row in Order.objects.filter(
            created_at__date__gte=week_start, created_at__date__lte=today,
        ).annotate(day=TruncDate('created_at')).values('day').annotate(cnt=Count('id')).values('day', 'cnt')
    }
    weekly_revenue = []
    for i in range(6, -1, -1):
        d = today - timedelta(days=i)
        weekly_revenue.append({
            'date': str(d), 'revenue': revenue_by_day.get(d, 0), 'orders': orders_by_day.get(d, 0),
        })

    # تفکیک سفارشات امروز (فقط سفارش‌های واقعاً پرداخت‌شده — نه لغوشده، نه در انتظار پرداخت آنلاین)
    real_today_orders = today_orders.exclude(status__in=['cancelled', 'waiting_payment'])

    DELIVERY_LABELS = {'dine_in': 'سرو در کافه', 'takeaway': 'برون‌بر', 'delivery': 'ارسال با پیک'}
    delivery_rows = {
        row['delivery_type']: row
        for row in real_today_orders.values('delivery_type').annotate(
            revenue=Sum('final_price'), count=Count('id'),
        )
    }
    by_delivery_type = []
    for value, label in DELIVERY_LABELS.items():
        row = delivery_rows.get(value)
        if row and row['count']:
            by_delivery_type.append({
                'type': value, 'label': label, 'revenue': row['revenue'] or 0, 'count': row['count'],
            })

    PAYMENT_LABELS = {'cash': 'نقدی', 'online': 'آنلاین'}
    payment_rows = {
        row['payment_method']: row
        for row in real_today_orders.values('payment_method').annotate(
            revenue=Sum('final_price'), count=Count('id'),
        )
    }
    by_payment_method = []
    for value, label in PAYMENT_LABELS.items():
        row = payment_rows.get(value)
        if row and row['count']:
            by_payment_method.append({
                'method': value, 'label': label, 'revenue': row['revenue'] or 0, 'count': row['count'],
            })

    # آخرین سفارشات
    recent_orders = []
    for o in Order.objects.select_related('user').prefetch_related('items').order_by('-created_at')[:8]:
        recent_orders.append({
            'id': o.id,
            'order_number': o.order_number,
            'status': o.status,
            'user_phone': str(o.user.phone),
            'items_count': len(o.items.all()),
            'final_price': o.final_price,
            'created_at': o.created_at.isoformat(),
            'delivery_type': o.delivery_type,
        })

    # رزروهای آینده
    upcoming_reservations = []
    for r in Reservation.objects.filter(
        date__gte=today,
        status__in=['pending', 'confirmed']
    ).select_related('user', 'table').order_by('date', 'start_time')[:5]:
        upcoming_reservations.append({
            'id': r.id,
            'date': str(r.date),
            'start_time': str(r.start_time)[:5],
            'end_time': str(r.end_time)[:5],
            'user_phone': str(r.user.phone),
            'table_number': r.table.number,
            'guests_count': r.guests_count,
            'status': r.status,
        })

    # نرخ no-show در ۳۰ روز گذشته
    window_start = today - timedelta(days=30)
    no_show_agg = Reservation.objects.filter(
        date__gte=window_start, date__lte=today, status__in=['completed', 'no_show'],
    ).aggregate(
        resolved_count=Count('id'),
        no_show_count=Count('id', filter=Q(status='no_show')),
    )
    resolved_count = no_show_agg['resolved_count']
    no_show_count = no_show_agg['no_show_count']
    no_show_rate = round(no_show_count / resolved_count * 100, 1) if resolved_count else 0

    pending_reviews = (
        Review.objects.filter(is_approved=False).count() +
        CafeReview.objects.filter(is_approved=False).count()
    )

    # مبلغ نقدی وصول‌نشده
    cash_pending_qs = Order.objects.filter(payment_method='cash', is_paid=False).exclude(status='cancelled')
    cash_pending_amount = cash_pending_qs.aggregate(total=Sum('final_price'))['total'] or 0
    cash_pending_count = cash_pending_qs.count()

    # آیتم‌های بدون عکس
    items_without_image = MenuItem.objects.filter(
        Q(image='') | Q(image__isnull=True)
    ).count()

    # بنرهایی که تا ۳ روز دیگر منقضی می‌شوند
    expiring_banners = [
        {'id': b.id, 'title': b.title or f'بنر #{b.id}', 'end_date': str(b.end_date)}
        for b in Banner.objects.filter(
            is_active=True, end_date__isnull=False,
            end_date__gte=today, end_date__lte=today + timedelta(days=3),
        ).order_by('end_date')[:5]
    ]

    # پرفروش‌ترین آیتم‌های ۷ روز گذشته
    best_sellers = list(
        OrderItem.objects.filter(
            order__created_at__date__gte=today - timedelta(days=6),
            order__created_at__date__lte=today,
        ).exclude(order__status='cancelled')
        .values('menu_item_id', 'menu_item__name')
        .annotate(quantity_sold=Sum('quantity'))
        .order_by('-quantity_sold')[:5]
    )
    best_sellers = [
        {'id': b['menu_item_id'], 'name': b['menu_item__name'], 'quantity_sold': b['quantity_sold']}
        for b in best_sellers
    ]

    return Response({
        'attention': {
            'cash_pending_amount': cash_pending_amount,
            'cash_pending_count': cash_pending_count,
            'pending_reviews': pending_reviews,
            'items_without_image': items_without_image,
            'expiring_banners': expiring_banners,
        },
        'today': {
            'orders_count': today_orders.count(),
            'revenue': today_revenue,
            'aov': today_aov,
            'waiting_payment_orders': today_orders.filter(status='waiting_payment').count(),
            'paid_orders': today_orders.filter(status='paid').count(),
            'preparing_orders': today_orders.filter(status='preparing').count(),
            'reservations': Reservation.objects.filter(date=today).count(),
            'by_delivery_type': by_delivery_type,
            'by_payment_method': by_payment_method,
        },
        'menu_insights': {
            'best_sellers': best_sellers,
            'unavailable_items': MenuItem.objects.exclude(status='available').count(),
            'inactive_categories': Category.objects.filter(is_active=False).count(),
        },
        'reservations_insight': {
            'no_show_rate': no_show_rate,
            'no_show_count': no_show_count,
            'resolved_count': resolved_count,
        },
        'total': {
            'users': User.objects.count(),
            'orders': Order.objects.count(),
            'revenue': Payment.objects.filter(status='success').aggregate(
                total=Sum('amount')
            )['total'] or 0,
            'pending_reviews': pending_reviews,
            'new_users_this_week': User.objects.filter(date_joined__date__gte=today - timedelta(days=6)).count(),
        },
        'weekly_revenue': weekly_revenue,
        'recent_orders': recent_orders,
        'upcoming_reservations': upcoming_reservations,
    })


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
    re_path(r'^api/media/(?P<path>.*)$', serve, {'document_root': settings.MEDIA_ROOT}),
]
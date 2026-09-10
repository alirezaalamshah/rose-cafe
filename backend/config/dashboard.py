"""
داشبورد ادمین: `/api/dashboard/`. چون این ویو داده از تقریباً همه‌ی اپ‌ها جمع می‌کند
و به هیچ‌کدام تعلق اختصاصی ندارد، به‌جای اضافه‌شدن به یکی از آن‌ها این‌جا نگه داشته می‌شود
(از config/urls.py جدا شد چون با اضافه‌شدن بخش‌های بازه‌ی زمانی خیلی بزرگ شده بود).
"""
from datetime import timedelta

from django.db.models import Sum, Count, Q, Avg
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response

from apps.common.utils import local_day_range


def _range_financial(orders_in_range):
    """درآمد، تخفیف، هزینه‌ی ارسال/بسته‌بندی — فقط سفارش‌های واقعاً پرداخت‌شده و لغو/ردنشده."""
    from apps.orders.models import Order

    real_orders = orders_in_range.filter(is_paid=True).exclude(
        status__in=[Order.Status.CANCELLED, Order.Status.REJECTED]
    )
    agg = real_orders.aggregate(
        revenue=Sum('final_price'),
        discount_given=Sum('discount_amount'),
        delivery_cost_total=Sum('delivery_cost'),
        packaging_cost_total=Sum('packaging_cost'),
        orders_count=Count('id'),
    )
    discount_orders_count = real_orders.exclude(discount_amount=0).count()

    return {
        'revenue': agg['revenue'] or 0,
        'orders_count': agg['orders_count'] or 0,
        'discount_given': agg['discount_given'] or 0,
        'discount_orders_count': discount_orders_count,
        'delivery_cost_total': agg['delivery_cost_total'] or 0,
        'packaging_cost_total': agg['packaging_cost_total'] or 0,
    }


def _wallet_range_stats(start, end):
    from apps.wallet.models import WalletTransaction, Wallet

    agg = WalletTransaction.objects.filter(
        created_at__gte=start, created_at__lt=end,
    ).aggregate(
        topups=Sum('amount', filter=Q(type=WalletTransaction.Type.TOPUP)),
        cashback=Sum('amount', filter=Q(type=WalletTransaction.Type.CASHBACK)),
    )
    total_balance = Wallet.objects.aggregate(s=Sum('balance'))['s'] or 0
    return {
        'wallet_topups': agg['topups'] or 0,
        # cashback به‌صورت منفی نیست (credit همیشه amount مثبت ثبت می‌کند) — مستقیم جمع می‌شود
        'wallet_cashback_paid': agg['cashback'] or 0,
        'wallet_total_balance': total_balance,
    }


def _range_quality(orders_in_range, start, end):
    """رضایت مشتری (میانگین امتیاز) و نرخ رد/لغو سفارش در بازه."""
    from apps.orders.models import Order
    from apps.reviews.models import Review
    from apps.reservations.models import Reservation

    total_count = orders_in_range.count()
    rejected_count = orders_in_range.filter(status=Order.Status.REJECTED).count()
    cancelled_count = orders_in_range.filter(status=Order.Status.CANCELLED).count()
    rejection_rate = round((rejected_count + cancelled_count) / total_count * 100, 1) if total_count else 0

    top_rejection_reasons = list(
        orders_in_range.filter(status=Order.Status.REJECTED).exclude(rejection_reason='')
        .values('rejection_reason').annotate(count=Count('id')).order_by('-count')[:5]
    )
    top_rejection_reasons = [
        {'reason': r['rejection_reason'], 'count': r['count']} for r in top_rejection_reasons
    ]

    rating_agg = Review.objects.filter(
        is_approved=True, created_at__gte=start, created_at__lt=end,
    ).aggregate(avg=Avg('rating'), count=Count('id'))

    no_show_agg = Reservation.objects.filter(
        date__gte=start.date(), date__lt=end.date(), status__in=['completed', 'no_show'],
    ).aggregate(
        resolved_count=Count('id'),
        no_show_count=Count('id', filter=Q(status='no_show')),
    )
    resolved_count = no_show_agg['resolved_count']
    no_show_rate = round(no_show_agg['no_show_count'] / resolved_count * 100, 1) if resolved_count else 0

    return {
        'avg_rating': round(rating_agg['avg'], 2) if rating_agg['avg'] else None,
        'ratings_count': rating_agg['count'],
        'total_orders': total_count,
        'rejected_count': rejected_count,
        'cancelled_count': cancelled_count,
        'rejection_rate': rejection_rate,
        'top_rejection_reasons': top_rejection_reasons,
        'no_show_rate': no_show_rate,
    }


def _range_sales(start, end):
    """پرفروش‌ترین آیتم/دسته‌بندی/تنوع/افزودنی، مشتری تکراری/جدید — همه در بازه."""
    from apps.orders.models import Order, OrderItem, OrderItemAddon
    from apps.accounts.models import User

    real_items = OrderItem.objects.filter(
        order__created_at__gte=start, order__created_at__lt=end, order__is_paid=True,
    ).exclude(order__status__in=[Order.Status.CANCELLED, Order.Status.REJECTED])

    top_items = list(
        real_items.values('menu_item_id', 'menu_item__name')
        .annotate(quantity=Sum('quantity')).order_by('-quantity')[:5]
    )
    top_items = [
        {'id': i['menu_item_id'], 'name': i['menu_item__name'], 'quantity': i['quantity']}
        for i in top_items
    ]

    top_categories = list(
        real_items.values('menu_item__category_id', 'menu_item__category__name')
        .annotate(quantity=Sum('quantity'))
        .order_by('-quantity')[:5]
    )
    top_categories = [
        {'category_id': c['menu_item__category_id'], 'category_name': c['menu_item__category__name'], 'quantity': c['quantity']}
        for c in top_categories
    ]

    top_variants = list(
        real_items.exclude(variant_name='')
        .values('variant_name').annotate(quantity=Sum('quantity')).order_by('-quantity')[:5]
    )

    top_addons = list(
        OrderItemAddon.objects.filter(
            order_item__order__created_at__gte=start, order_item__order__created_at__lt=end,
            order_item__order__is_paid=True,
        ).exclude(order_item__order__status__in=[Order.Status.CANCELLED, Order.Status.REJECTED])
        .values('name').annotate(count=Count('id')).order_by('-count')[:5]
    )

    real_orders = Order.objects.filter(
        created_at__gte=start, created_at__lt=end, is_paid=True,
    ).exclude(status__in=[Order.Status.CANCELLED, Order.Status.REJECTED])
    customer_order_counts = real_orders.values('user_id').annotate(c=Count('id'))
    unique_customers = customer_order_counts.count()
    repeat_customers = customer_order_counts.filter(c__gt=1).count()
    repeat_customer_rate = round(repeat_customers / unique_customers * 100, 1) if unique_customers else 0

    new_users = User.objects.filter(date_joined__gte=start, date_joined__lt=end).count()

    top_customers_agg = list(
        real_orders.values('user_id', 'user__full_name', 'user__phone')
        .annotate(orders_count=Count('id'), total_spent=Sum('final_price'))
        .order_by('-orders_count')[:5]
    )
    top_customers = [
        {
            'user_id': c['user_id'],
            'name': c['user__full_name'] or str(c['user__phone']),
            'orders_count': c['orders_count'],
            'total_spent': c['total_spent'],
        }
        for c in top_customers_agg
    ]

    return {
        'top_items': top_items,
        'top_categories': top_categories,
        'top_variants': top_variants,
        'top_addons': top_addons,
        'top_customers': top_customers,
        'unique_customers': unique_customers,
        'repeat_customer_rate': repeat_customer_rate,
        'new_users': new_users,
    }


def _range_courier(start, end):
    """آمار عملکرد پیک اسنپ‌باکس در بازه — بر اساس زمان dispatched_at (نه created_at
    سفارش)، چون این آمار درباره‌ی خودِ رویداد ارسال به پیک است."""
    from django.db.models.functions import Cast
    from django.db.models import DurationField, F
    from apps.snapp.models import SnappCourierOrder

    couriers_in_range = SnappCourierOrder.objects.filter(dispatched_at__gte=start, dispatched_at__lt=end)
    total = couriers_in_range.count()
    if not total:
        return {
            'total_dispatched': 0, 'delivered_count': 0, 'cancelled_count': 0,
            'cancellation_rate': None, 'avg_delivery_minutes': None, 'total_delivery_fare': 0,
        }

    delivered = couriers_in_range.filter(status=SnappCourierOrder.Status.DELIVERED)
    cancelled_or_failed = couriers_in_range.filter(
        status__in=[SnappCourierOrder.Status.CANCELLED, SnappCourierOrder.Status.FAILED]
    ).count()

    # میانگین فاصله‌ی ارسال تا آخرین وبهوک برای سفارش‌های تحویل‌شده — تقریبی از «زمان تحویل»
    # (وبهوک آخر برای DELIVERED دقیقاً همان لحظه‌ی تحویل است)
    avg_duration = delivered.exclude(last_webhook_at__isnull=True).annotate(
        duration=Cast(F('last_webhook_at') - F('dispatched_at'), output_field=DurationField())
    ).aggregate(avg=Avg('duration'))['avg']
    avg_minutes = round(avg_duration.total_seconds() / 60, 1) if avg_duration else None

    total_fare = couriers_in_range.aggregate(s=Sum('delivery_fare'))['s'] or 0

    return {
        'total_dispatched': total,
        'delivered_count': delivered.count(),
        'cancelled_count': cancelled_or_failed,
        'cancellation_rate': round(cancelled_or_failed / total * 100, 1),
        'avg_delivery_minutes': avg_minutes,
        'total_delivery_fare': total_fare,
    }


def _range_staff(start, end):
    from apps.accounts.models import User
    from apps.staff_activity.views import _compute_waiter_stats

    rows = [_compute_waiter_stats(w, start, end) for w in User.objects.filter(role=User.Role.WAITER)]
    rows.sort(key=lambda r: (r['approved_count'] + r['rejected_count']), reverse=True)
    return {'rows': rows[:5]}


def _pct_change(current, previous):
    if not previous:
        return None  # نمی‌شود درصد تغییر را نسبت به صفر حساب کرد — نه صفر، نه بی‌نهایت
    return round((current - previous) / previous * 100, 1)


def _previous_period_comparison(start, end):
    """درآمد/تعداد سفارش بازه‌ی درست قبلی با همان طول زمانی — برای نمایش «نسبت به بازه‌ی قبل»."""
    from apps.orders.models import Order
    length = end - start
    prev_start, prev_end = start - length, start
    prev_financial = _range_financial(Order.objects.filter(created_at__gte=prev_start, created_at__lt=prev_end))
    return {'revenue': prev_financial['revenue'], 'orders_count': prev_financial['orders_count']}


def _range_insights(date_from, date_to):
    from apps.orders.models import Order

    start = local_day_range(date_from)[0]
    end = local_day_range(date_to)[1]
    orders_in_range = Order.objects.filter(created_at__gte=start, created_at__lt=end)

    financial = _range_financial(orders_in_range)
    financial.update(_wallet_range_stats(start, end))

    previous = _previous_period_comparison(start, end)
    comparison = {
        'revenue_change_pct': _pct_change(financial['revenue'], previous['revenue']),
        'orders_change_pct': _pct_change(financial['orders_count'], previous['orders_count']),
    }

    return {
        'from': date_from,
        'to': date_to,
        'financial': financial,
        'quality': _range_quality(orders_in_range, start, end),
        'sales': _range_sales(start, end),
        'staff': _range_staff(start, end),
        'courier': _range_courier(start, end),
        'comparison': comparison,
    }


@api_view(['GET'])
@permission_classes([IsAdminUser])
def admin_dashboard(request):
    from apps.orders.models import Order
    from apps.reservations.models import Reservation
    from apps.accounts.models import User
    from apps.payments.models import Payment
    from apps.reviews.models import Review, CafeReview
    from apps.menu.models import MenuItem, Category
    from apps.business.models import Banner

    # timezone.localdate (نه timezone.now().date()) و بازه‌های UTC محاسبه‌شده در پایتون
    # (نه lookup مستقیم __date یا TruncDate) — چون هر دوی این‌ها روی MySQL به
    # CONVERT_TZ با نام منطقه‌ی زمانی ترجمه می‌شوند که بدون جدول‌های tzinfo سمت سرور
    # (خیلی از هاست‌های اشتراکی) همیشه NULL برمی‌گرداند و هیچ ردیفی match نمی‌شود.
    today = timezone.localdate()
    week_start = today - timedelta(days=6)
    today_start, today_end = local_day_range(today)
    week_start_utc, _ = local_day_range(week_start)

    today_orders = Order.objects.filter(created_at__gte=today_start, created_at__lt=today_end)
    today_revenue = Payment.objects.filter(
        status='success', created_at__gte=today_start, created_at__lt=today_end,
    ).aggregate(total=Sum('amount'))['total'] or 0
    today_payment_count = Payment.objects.filter(
        status='success', created_at__gte=today_start, created_at__lt=today_end,
    ).count()
    today_aov = round(today_revenue / today_payment_count) if today_payment_count else 0

    # درآمد ۷ روز گذشته — به‌جای ۱۴ کوئری جدا (۲ به‌ازای هر روز)، فقط ۲ کوئری؛ گروه‌بندی
    # بر اساس روز محلی در پایتون انجام می‌شود (نه TruncDate سمت دیتابیس، به همان دلیل بالا)
    revenue_by_day = {}
    for row in Payment.objects.filter(
        status='success', created_at__gte=week_start_utc, created_at__lt=today_end,
    ).values('created_at', 'amount'):
        d = timezone.localtime(row['created_at']).date()
        revenue_by_day[d] = revenue_by_day.get(d, 0) + row['amount']

    orders_by_day = {}
    for row in Order.objects.filter(
        created_at__gte=week_start_utc, created_at__lt=today_end,
    ).values('created_at'):
        d = timezone.localtime(row['created_at']).date()
        orders_by_day[d] = orders_by_day.get(d, 0) + 1

    weekly_revenue = []
    for i in range(6, -1, -1):
        d = today - timedelta(days=i)
        weekly_revenue.append({
            'date': str(d), 'revenue': revenue_by_day.get(d, 0), 'orders': orders_by_day.get(d, 0),
        })

    # تفکیک سفارشات امروز (فقط سفارش‌های واقعاً پرداخت‌شده — نه لغوشده، نه در انتظار پرداخت آنلاین)
    real_today_orders = today_orders.exclude(status__in=['cancelled', 'waiting_payment'])

    DELIVERY_LABELS = {'dine_in': 'سرو در کافه', 'takeaway': 'بیرون‌بر', 'delivery': 'ارسال با پیک'}
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

    PAYMENT_LABELS = {'cash': 'نقدی', 'online': 'آنلاین', 'wallet': 'کیف پول'}
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

    response_data = {
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
            'unavailable_items': MenuItem.objects.exclude(status='available').count(),
            'inactive_categories': Category.objects.filter(is_active=False).count(),
        },
        'total': {
            'users': User.objects.count(),
            'orders': Order.objects.count(),
            'revenue': Payment.objects.filter(status='success').aggregate(
                total=Sum('amount')
            )['total'] or 0,
            'pending_reviews': pending_reviews,
        },
        'weekly_revenue': weekly_revenue,
        'recent_orders': recent_orders,
        'upcoming_reservations': upcoming_reservations,
    }

    # بخش‌های مبتنی بر بازه‌ی زمانی (مالی/کیفیت/فروش/کارکنان) — فقط وقتی from و to
    # صریح داده شده باشند محاسبه می‌شوند (پیش‌فرض چیزی برای «امروز» تغییر نمی‌کند)
    date_from = request.query_params.get('from')
    date_to = request.query_params.get('to')
    if date_from and date_to:
        response_data['range'] = _range_insights(date_from, date_to)

    return Response(response_data)

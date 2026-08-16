from rest_framework import generics, permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from django.db.models import Sum, Avg, F, DurationField, ExpressionWrapper
from apps.common.utils import local_day_range
from apps.common.pagination import StandardPagination
from apps.accounts.models import User
from apps.accounts.permissions import IsWaiter
from .models import StaffActionLog
from .serializers import StaffActionLogSerializer


class StaffActionLogListView(generics.ListAPIView):
    """گزارش فعالیت کارکنان — فقط ادمین می‌بیند که کدام گارسون/ادمین چه اکشنی انجام داده."""
    permission_classes = [permissions.IsAdminUser]
    serializer_class = StaffActionLogSerializer
    pagination_class = StandardPagination

    def get_queryset(self):  # type: ignore[override]
        from django.db.models import Q

        qs = StaffActionLog.objects.select_related('user', 'order', 'reservation')

        user_id = self.request.query_params.get('user')
        if user_id:
            qs = qs.filter(user_id=user_id)

        search = self.request.query_params.get('search')
        if search:
            qs = qs.filter(Q(user__full_name__icontains=search) | Q(user__phone__icontains=search))

        action = self.request.query_params.get('action')
        if action:
            qs = qs.filter(action=action)

        order_id = self.request.query_params.get('order')
        if order_id:
            qs = qs.filter(order_id=order_id)

        date_filter = self.request.query_params.get('date')
        if date_filter:
            start, end = local_day_range(date_filter)
            qs = qs.filter(created_at__gte=start, created_at__lt=end)

        return qs.order_by('-created_at')


def _compute_waiter_stats(waiter, start, end):
    """
    آمار یک سرپرست سالن در یک بازه: تعداد تأیید/رد، مجموع نقدی/آنلاین وصول‌شده (بر اساس
    سفارش‌های تخصیص‌یافته به همان سرپرست در بازه)، میانگین زمان تأیید-تا-تحویل، و تعداد
    سفارش‌های جاری فعلی (این یکی لحظه‌ای است و مستقل از بازه‌ی تاریخ محاسبه می‌شود).
    """
    from apps.orders.models import Order

    active_statuses = [Order.Status.PAID, Order.Status.PREPARING, Order.Status.READY]
    duration_expr = ExpressionWrapper(F('delivered_at') - F('approved_at'), output_field=DurationField())

    approved_count = StaffActionLog.objects.filter(
        user=waiter, action=StaffActionLog.Action.ORDER_APPROVED,
        created_at__gte=start, created_at__lt=end,
    ).count()
    rejected_count = StaffActionLog.objects.filter(
        user=waiter, action=StaffActionLog.Action.ORDER_REJECTED,
        created_at__gte=start, created_at__lt=end,
    ).count()

    assigned_qs = Order.objects.filter(
        assigned_waiter=waiter, created_at__gte=start, created_at__lt=end,
    )
    cash_collected = assigned_qs.filter(
        payment_method=Order.PaymentMethod.CASH, is_paid=True,
    ).aggregate(s=Sum('final_price'))['s'] or 0
    online_collected = assigned_qs.filter(
        payment_method=Order.PaymentMethod.ONLINE, is_paid=True,
    ).aggregate(s=Sum('final_price'))['s'] or 0

    avg_delta = assigned_qs.filter(
        approved_at__isnull=False, delivered_at__isnull=False,
    ).annotate(_duration=duration_expr).aggregate(avg=Avg('_duration'))['avg']
    avg_delivery_minutes = round(avg_delta.total_seconds() / 60, 1) if avg_delta else None

    current_active_orders = Order.objects.filter(
        assigned_waiter=waiter, status__in=active_statuses,
    ).count()

    return {
        'waiter_id': waiter.id,
        'waiter_name': waiter.full_name or str(waiter.phone),
        'approved_count': approved_count,
        'rejected_count': rejected_count,
        'cash_collected': cash_collected,
        'online_collected': online_collected,
        'avg_delivery_minutes': avg_delivery_minutes,
        'current_active_orders': current_active_orders,
    }


class StaffPerformanceReportView(APIView):
    """گزارش تجمیعی عملکرد همه‌ی سرپرست‌های سالن — فقط ادمین."""
    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        date_from = request.query_params.get('from')
        date_to = request.query_params.get('to')
        if not date_from or not date_to:
            return Response({'detail': 'پارامترهای from و to الزامی است'}, status=400)

        start = local_day_range(date_from)[0]
        end = local_day_range(date_to)[1]

        results = [
            _compute_waiter_stats(waiter, start, end)
            for waiter in User.objects.filter(role=User.Role.WAITER)
        ]
        results.sort(key=lambda r: (r['approved_count'] + r['rejected_count']), reverse=True)
        return Response(results)


class MyPerformanceView(APIView):
    """
    همان گزارش، ولی فقط برای خودِ سرپرست سالنِ درخواست‌دهنده — نیاز به دسترسی
    can_view_own_performance دارد (ادمین چون گزارش کامل را دارد نیازی به این ندارد).
    """
    permission_classes = [IsWaiter]

    def get(self, request):
        perm = getattr(request.user, 'waiter_permissions', None)
        if not perm or not perm.can_view_own_performance:
            return Response({'detail': 'دسترسی به مشاهده‌ی عملکرد ندارید'}, status=403)

        date_from = request.query_params.get('from')
        date_to = request.query_params.get('to')
        if not date_from or not date_to:
            return Response({'detail': 'پارامترهای from و to الزامی است'}, status=400)

        start = local_day_range(date_from)[0]
        end = local_day_range(date_to)[1]
        return Response(_compute_waiter_stats(request.user, start, end))

from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.db import transaction
from django.conf import settings
from django.utils import timezone

from .models import Order, OrderItem, OrderItemAddon
from apps.menu.models import MenuItemVariant, MenuItemAddon
from .serializers import (
    OrderCreateSerializer, OrderSerializer,
    AdminOrderSerializer, OrderStatusUpdateSerializer,
)
from apps.accounts.models import Address
from apps.accounts.permissions import IsWaiter
from apps.discounts.utils import apply_discount
from apps.notifications.sms import send_order_ready_for_courier_sms
from apps.notifications.push import notify_new_order
from apps.common.utils import local_day_range
from apps.staff_activity.models import StaffActionLog, log_staff_action


def _staff_display_name(user):
    return user.full_name or str(user.phone)


def _already_actioned_response(order):
    """
    وقتی دو گارسون هم‌زمان تأیید/رد بزنند، دومی این پیام را می‌گیرد — با ذکر اینکه
    سفارش قبلاً توسط چه کسی تأیید/رد شده (اگر گارسونی مسئولش شده باشد).
    """
    who = _staff_display_name(order.assigned_waiter) if order.assigned_waiter else None
    verb = 'رد شد' if order.status == Order.Status.REJECTED else 'تأیید شد'
    detail = f'این سفارش قبلاً {("توسط " + who + " ") if who else ""}{verb}'
    return Response({'detail': detail}, status=status.HTTP_400_BAD_REQUEST)


def _send_status_change_sms(order):
    """
    تنها پیامک مرتبط با تغییر وضعیت سفارش: وقتی سفارش ارسال با پیک «تحویل داده شد» می‌شود
    (یعنی از کافه خارج و دست پیک سپرده شده). برای بقیه‌ی تغییرات وضعیت (و انواع تحویل دیگر)
    پیامکی ارسال نمی‌شود.
    """
    if order.status == Order.Status.DELIVERED and order.delivery_type == Order.DeliveryType.DELIVERY:
        send_order_ready_for_courier_sms(str(order.user.phone), order.order_number)


def _assigned_waiter_suffix(order, actor):
    """
    وقتی ادمین به‌جای گارسونِ مسئولِ سفارش اکشنی می‌زند (مثلاً وصول وجه)، این پسوند
    به متن رکورد ردگیری اضافه می‌شود تا در گزارش کاملاً شفاف باشد چه کسی مسئول سفارش بوده.
    """
    if order.assigned_waiter_id and order.assigned_waiter_id != actor.id:
        return f' — مسئول سفارش: {_staff_display_name(order.assigned_waiter)}'
    return ''


class OrderListCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        orders = Order.objects.filter(
            user=request.user
        ).prefetch_related('items__menu_item')
        serializer = OrderSerializer(orders, many=True)
        return Response(serializer.data)

    @transaction.atomic
    def post(self, request):
        from apps.business.utils import get_cafe_status
        cafe = get_cafe_status()
        if not cafe['is_open']:
            return Response({'detail': cafe['message']}, status=status.HTTP_400_BAD_REQUEST)

        serializer = OrderCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        # بررسی آدرس
        address = None
        if data.get('delivery_type') == Order.DeliveryType.DELIVERY:
            try:
                address = Address.objects.get(
                    id=data['address'], user=request.user
                )
            except Address.DoesNotExist:
                return Response(
                    {'detail': 'آدرس یافت نشد'},
                    status=status.HTTP_400_BAD_REQUEST
                )

        # بررسی میز برای سرو در کافه
        table = None
        if data.get('delivery_type') == Order.DeliveryType.DINE_IN:
            from apps.reservations.models import Table as TableModel
            try:
                table = TableModel.objects.get(id=data['table'], is_active=True)
            except TableModel.DoesNotExist:
                return Response(
                    {'detail': 'میز انتخابی معتبر نیست یا فعال نمی‌باشد'},
                    status=status.HTTP_400_BAD_REQUEST
                )

        # محاسبه قیمت آیتم‌ها (قبل از تعیین هزینه ارسال)
        total = 0
        items_to_create = []
        for item_data in data['items']:
            menu_item = item_data['menu_item']
            variant = None
            variant_name = ''
            if item_data.get('variant_id'):
                try:
                    variant = MenuItemVariant.objects.get(
                        id=item_data['variant_id'], item=menu_item
                    )
                    variant_name = variant.name
                    unit_price = variant.final_price
                except MenuItemVariant.DoesNotExist:
                    unit_price = menu_item.final_price
            else:
                unit_price = menu_item.final_price

            # افزودنی‌های انتخابی — فقط آن‌هایی که واقعاً به همین آیتم تعلق دارند و موجودند
            addon_ids = item_data.get('addon_ids') or []
            addons = list(
                MenuItemAddon.objects.filter(id__in=addon_ids, item=menu_item, is_available=True)
            ) if addon_ids else []
            addons_total = sum(a.price for a in addons)

            qty = item_data['quantity']
            total += (unit_price + addons_total) * qty
            items_to_create.append({
                'menu_item': menu_item,
                'variant': variant,
                'variant_name': variant_name,
                'quantity': qty,
                'unit_price': unit_price,
                'addons': addons,
            })

        # هزینه ارسال بر اساس تنظیمات (با پشتیبانی از ارسال رایگان مشروط) — یک‌بار برای کل سفارش
        from apps.business.models import DeliverySettings
        delivery_settings = DeliverySettings.get_settings()
        if data['delivery_type'] == Order.DeliveryType.DELIVERY:
            threshold = delivery_settings.free_delivery_threshold
            if threshold and total >= threshold:
                delivery_cost = 0
            else:
                delivery_cost = delivery_settings.delivery_cost
        else:
            delivery_cost = 0

        # هزینه بسته‌بندی — به‌ازای هر واحد از هر آیتم (نه یک‌بار برای کل سفارش)؛ مثلاً ۲ لیوان قهوه
        # باید ۲ برابر هزینه بسته‌بندی داشته باشد. فقط برای بیرون‌بر/ارسالی (سرو در کافه نیاز ندارد)
        total_quantity = sum(item_p['quantity'] for item_p in items_to_create)
        if data['delivery_type'] == Order.DeliveryType.TAKEAWAY:
            packaging_cost = delivery_settings.takeaway_packaging_cost * total_quantity
        elif data['delivery_type'] == Order.DeliveryType.DELIVERY:
            packaging_cost = delivery_settings.delivery_packaging_cost * total_quantity
        else:
            packaging_cost = 0

        payment_method = data.get('payment_method', Order.PaymentMethod.ONLINE)

        # اعتبارسنجی تخفیف قبل از هرگونه نوشتن در دیتابیس — وگرنه با کد نامعتبر
        # سفارش/آیتم‌های یتیم (بدون تخفیف) در دیتابیس باقی می‌مانند، چون یک return
        # ساده وسط transaction.atomic باعث rollback نمی‌شود (فقط raise این کار را می‌کند)
        discount_code = data.get('discount_code', '')
        discount_amount = 0
        applied_discount_result = None
        if discount_code:
            result = apply_discount(discount_code, total, request.user)
            if not result['valid']:
                return Response(
                    {'detail': result['message']},
                    status=status.HTTP_400_BAD_REQUEST
                )
            discount_amount = result['discount_amount']
            applied_discount_result = result

        # ساخت سفارش
        order = Order.objects.create(
            user=request.user,
            delivery_type=data['delivery_type'],
            payment_method=payment_method,
            address=address,
            table=table,
            note=data.get('note', ''),
            delivery_cost=delivery_cost,
            packaging_cost=packaging_cost,
        )

        # ساخت آیتم‌ها
        for item_p in items_to_create:
            order_item = OrderItem.objects.create(
                order=order,
                menu_item=item_p['menu_item'],
                variant=item_p['variant'],
                variant_name=item_p['variant_name'],
                quantity=item_p['quantity'],
                unit_price=item_p['unit_price'],
            )
            for addon in item_p['addons']:
                OrderItemAddon.objects.create(
                    order_item=order_item, addon=addon, name=addon.name, price=addon.price,
                )

        order.total_price = total
        if applied_discount_result:
            order.discount_code = discount_code
            order.discount_amount = discount_amount

        order.final_price = total + delivery_cost + packaging_cost - discount_amount

        # سفارش نقدی بلافاصله در انتظار تأیید کافه قرار می‌گیرد — پیش از آماده‌سازی
        # باید گارسون/ادمین تأیید کند (ممکن است کافه امکان آماده کردنش را نداشته باشد)
        if payment_method == Order.PaymentMethod.CASH:
            order.status = Order.Status.PENDING_CONFIRMATION

        order.save()

        if order.status == Order.Status.PENDING_CONFIRMATION:
            notify_new_order(order)

        # ثبت استفاده از تخفیف
        if applied_discount_result:
            from apps.discounts.models import DiscountUsage
            disc_obj = applied_discount_result['discount']
            DiscountUsage.objects.create(
                discount=disc_obj,
                user=request.user,
                order_id=order.id,
                used_year=applied_discount_result.get('used_year'),
            )
            disc_obj.used_count += 1
            disc_obj.save(update_fields=['used_count'])

        return Response(
            OrderSerializer(order).data,
            status=status.HTTP_201_CREATED
        )


class OrderDetailView(generics.RetrieveAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = OrderSerializer

    def get_queryset(self):  # type: ignore[override]
        return Order.objects.filter(
            user=self.request.user
        ).prefetch_related('items__menu_item')


class OrderCancelView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        try:
            order = Order.objects.get(pk=pk, user=request.user)
        except Order.DoesNotExist:
            return Response({'detail': 'سفارش یافت نشد'}, status=status.HTTP_404_NOT_FOUND)

        if order.status not in [Order.Status.WAITING_PAYMENT]:
            return Response(
                {'detail': 'امکان لغو این سفارش وجود ندارد'},
                status=status.HTTP_400_BAD_REQUEST
            )

        order.status = Order.Status.CANCELLED
        order.save()
        return Response({'detail': 'سفارش لغو شد'})


# Admin Views
class AdminOrderListView(generics.ListAPIView):
    """
    بدون پارامتر date: لیست «سفارشات جاری» — همه‌چیز به‌جز تحویل‌داده‌شده/لغوشده
    (مگر اینکه status صریحاً درخواست شده باشد).
    با پارامتر date=YYYY-MM-DD: حالت بایگانی — همه‌ی سفارش‌های همان روز، فارغ از وضعیت.
    """
    permission_classes = [permissions.IsAdminUser]
    serializer_class = AdminOrderSerializer

    def get_queryset(self):  # type: ignore[override]
        qs = Order.objects.all().select_related(
            'user', 'address', 'table'
        ).prefetch_related('items__menu_item')
        closed_statuses = [Order.Status.DELIVERED, Order.Status.CANCELLED, Order.Status.REJECTED]
        status_filter = self.request.query_params.get('status')
        date_filter = self.request.query_params.get('date')
        if date_filter:
            start, end = local_day_range(date_filter)
            qs = qs.filter(created_at__gte=start, created_at__lt=end)
            if status_filter:
                qs = qs.filter(status=status_filter)
        elif status_filter:
            qs = qs.filter(status=status_filter)
            if status_filter in closed_statuses:
                # بدون تاریخ، سفارش‌های بسته‌شده فقط برای امروز نشان داده می‌شوند — برای
                # دیدن تاریخچه‌ی کامل باید از حالت بایگانی (با date) استفاده شود
                start, end = local_day_range(timezone.localdate())
                qs = qs.filter(created_at__gte=start, created_at__lt=end)
        else:
            qs = qs.exclude(status__in=closed_statuses)
        return qs


class NearestOrderDateView(APIView):
    """
    نزدیک‌ترین روزی که سفارش دارد را نسبت به یک تاریخ برمی‌گرداند — برای دکمه‌های
    «روز قبل/بعد» صفحه‌ی بایگانی پنل ادمین، که باید روزهای خالی را رد کنند و
    مستقیم به نزدیک‌ترین روز واقعاً دارای سفارش بپرند. گارسون به بایگانی دسترسی
    ندارد، پس این ویو فقط برای ادمین است.
    """
    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        date_str = request.query_params.get('date')
        direction = request.query_params.get('direction')
        if not date_str or direction not in ('prev', 'next'):
            return Response({'detail': 'پارامترهای date و direction الزامی است'}, status=status.HTTP_400_BAD_REQUEST)

        qs = Order.objects.all()
        start, end = local_day_range(date_str)
        if direction == 'prev':
            found = qs.filter(created_at__lt=start).order_by('-created_at').first()
        else:
            found = qs.filter(created_at__gte=end).order_by('created_at').first()

        if not found:
            return Response({'date': None})
        return Response({'date': str(timezone.localtime(found.created_at).date())})


class AdminOrderDetailView(generics.RetrieveAPIView):
    permission_classes = [permissions.IsAdminUser]
    serializer_class = AdminOrderSerializer

    def get_queryset(self):  # type: ignore[override]
        return Order.objects.all().prefetch_related('items__menu_item')


class AdminOrderStatusUpdateView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def patch(self, request, pk):
        try:
            order = Order.objects.get(pk=pk)
        except Order.DoesNotExist:
            return Response({'detail': 'سفارش یافت نشد'}, status=status.HTTP_404_NOT_FOUND)

        serializer = OrderStatusUpdateSerializer(order, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()

        if order.status == Order.Status.DELIVERED and not order.delivered_at:
            order.delivered_at = timezone.now()
            order.save(update_fields=['delivered_at'])

        log_staff_action(
            request.user, StaffActionLog.Action.ORDER_STATUS_CHANGED,
            f'وضعیت سفارش #{order.order_number} را به «{order.get_status_display()}»'
            f' تغییر داد{_assigned_waiter_suffix(order, request.user)}',
            order=order,
        )

        # ارسال SMS
        _send_status_change_sms(order)

        return Response(OrderSerializer(order).data)


class OrderApproveView(APIView):
    """گارسون یا ادمین سفارشی که در انتظار تأیید کافه است را تأیید می‌کند — به صف آماده‌سازی می‌رود."""

    def get_permissions(self):
        if self.request.user and self.request.user.is_staff:
            return [permissions.IsAdminUser()]
        return [IsWaiter()]

    def _check_waiter_permission(self, request):
        if request.user.is_staff:
            return None
        perm = getattr(request.user, 'waiter_permissions', None)
        if not perm or not perm.can_manage_orders:
            return Response({'detail': 'دسترسی به مدیریت سفارشات ندارید'}, status=status.HTTP_403_FORBIDDEN)
        return None

    @transaction.atomic
    def post(self, request, pk):
        denied = self._check_waiter_permission(request)
        if denied:
            return denied
        try:
            order = Order.objects.select_for_update().get(pk=pk)
        except Order.DoesNotExist:
            return Response({'detail': 'سفارش یافت نشد'}, status=status.HTTP_404_NOT_FOUND)

        if order.status != Order.Status.PENDING_CONFIRMATION:
            return _already_actioned_response(order)

        order.status = Order.Status.PAID
        order.approved_at = timezone.now()
        # سفارشی که مستقیم توسط ادمین تأیید می‌شود، به هیچ گارسونی قفل نمی‌شود — مشترک باقی می‌ماند
        if not request.user.is_staff:
            order.assigned_waiter = request.user
        order.save(update_fields=['status', 'approved_at', 'assigned_waiter'])

        log_staff_action(
            request.user, StaffActionLog.Action.ORDER_APPROVED,
            f'سفارش #{order.order_number} را تأیید کرد', order=order,
        )

        return Response(AdminOrderSerializer(order).data)


class OrderRejectView(APIView):
    """گارسون یا ادمین سفارشی که در انتظار تأیید کافه است را رد می‌کند — مثلاً وقتی کافه امکان آماده کردنش را ندارد."""

    def get_permissions(self):
        if self.request.user and self.request.user.is_staff:
            return [permissions.IsAdminUser()]
        return [IsWaiter()]

    def _check_waiter_permission(self, request):
        if request.user.is_staff:
            return None
        perm = getattr(request.user, 'waiter_permissions', None)
        if not perm or not perm.can_manage_orders:
            return Response({'detail': 'دسترسی به مدیریت سفارشات ندارید'}, status=status.HTTP_403_FORBIDDEN)
        return None

    @transaction.atomic
    def post(self, request, pk):
        denied = self._check_waiter_permission(request)
        if denied:
            return denied

        reason = (request.data.get('reason') or '').strip()
        if not reason:
            return Response({'detail': 'دلیل رد سفارش الزامی است'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            order = Order.objects.select_for_update().get(pk=pk)
        except Order.DoesNotExist:
            return Response({'detail': 'سفارش یافت نشد'}, status=status.HTTP_404_NOT_FOUND)

        if order.status != Order.Status.PENDING_CONFIRMATION:
            return _already_actioned_response(order)

        order.status = Order.Status.REJECTED
        order.rejection_reason = reason
        if not request.user.is_staff:
            order.assigned_waiter = request.user
        order.save(update_fields=['status', 'rejection_reason', 'assigned_waiter'])

        log_staff_action(
            request.user, StaffActionLog.Action.ORDER_REJECTED,
            f'سفارش #{order.order_number} را رد کرد — دلیل: {reason}', order=order,
        )

        return Response(AdminOrderSerializer(order).data)


# ─── Waiter Views ────────────────────────────────────────────────────────────

WAITER_ALLOWED_STATUSES = {
    Order.Status.PREPARING, Order.Status.READY, Order.Status.DELIVERED,
}
# گارسون می‌تواند سفارش PAID را به PREPARING ببرد (شروع آماده‌سازی)
WAITER_ALLOWED_STATUSES_EXTENDED = WAITER_ALLOWED_STATUSES


class WaiterOrderListView(generics.ListAPIView):
    """
    فقط سفارشات جاری — گارسون به بایگانی (سفارش‌های روزهای گذشته) دسترسی ندارد،
    پس برخلاف AdminOrderListView پارامتر date اصلاً پذیرفته/بررسی نمی‌شود.
    """
    permission_classes = [IsWaiter]
    serializer_class = AdminOrderSerializer

    def get_queryset(self):
        perm = getattr(self.request.user, 'waiter_permissions', None)
        if not perm or not perm.can_manage_orders:
            return Order.objects.none()
        from django.db.models import Q
        # WAITING_PAYMENT یعنی پرداخت آنلاین ناتمام — گارسون نباید آن را ببیند
        # سفارشی که گارسون دیگری تأیید/رد کرده (assigned_waiter) تا پایان مسیرش فقط برای
        # همان گارسون نمایش داده می‌شود؛ سفارش‌های تخصیص‌نیافته (هنوز کسی claim نکرده، یا
        # مستقیم توسط ادمین تأیید شده) برای همه‌ی گارسون‌ها مشترک می‌ماند
        qs = Order.objects.exclude(
            status=Order.Status.WAITING_PAYMENT
        ).filter(
            Q(assigned_waiter__isnull=True) | Q(assigned_waiter=self.request.user)
        ).select_related('user', 'address', 'table').prefetch_related('items__menu_item')
        closed_statuses = [Order.Status.DELIVERED, Order.Status.CANCELLED, Order.Status.REJECTED]
        status_filter = self.request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)
            if status_filter in closed_statuses:
                # بدون تاریخ، سفارش‌های بسته‌شده فقط برای امروز نشان داده می‌شوند (نه کل تاریخچه)
                start, end = local_day_range(timezone.localdate())
                qs = qs.filter(created_at__gte=start, created_at__lt=end)
        else:
            qs = qs.exclude(status__in=closed_statuses)
        return qs.order_by('-created_at')

    def list(self, request, *args, **kwargs):
        perm = getattr(request.user, 'waiter_permissions', None)
        if not perm or not perm.can_manage_orders:
            return Response({'detail': 'دسترسی به مدیریت سفارشات ندارید'}, status=status.HTTP_403_FORBIDDEN)
        return super().list(request, *args, **kwargs)


class WaiterOrderStatusUpdateView(APIView):
    permission_classes = [IsWaiter]

    def patch(self, request, pk):
        perm = getattr(request.user, 'waiter_permissions', None)
        if not perm or not perm.can_manage_orders:
            return Response({'detail': 'دسترسی به مدیریت سفارشات ندارید'}, status=status.HTTP_403_FORBIDDEN)

        try:
            order = Order.objects.get(pk=pk)
        except Order.DoesNotExist:
            return Response({'detail': 'سفارش یافت نشد'}, status=status.HTTP_404_NOT_FOUND)

        # سفارشی که به گارسون دیگری قفل شده، برای این گارسون اصلاً قابل مشاهده/اکشن نیست
        if order.assigned_waiter_id and order.assigned_waiter_id != request.user.id:
            return Response({'detail': 'این سفارش به سرپرست سالن دیگری اختصاص دارد'}, status=status.HTTP_403_FORBIDDEN)

        new_status = request.data.get('status')
        if new_status not in [s.value for s in WAITER_ALLOWED_STATUSES]:
            return Response(
                {'detail': f'سرپرست سالن تنها می‌تواند وضعیت را به {", ".join(s.value for s in WAITER_ALLOWED_STATUSES)} تغییر دهد'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        order.status = new_status
        if new_status == Order.Status.DELIVERED and not order.delivered_at:
            order.delivered_at = timezone.now()
        order.save()

        log_staff_action(
            request.user, StaffActionLog.Action.ORDER_STATUS_CHANGED,
            f'وضعیت سفارش #{order.order_number} را به «{order.get_status_display()}» تغییر داد',
            order=order,
        )

        _send_status_change_sms(order)

        return Response(AdminOrderSerializer(order).data)


class ConfirmCashPaymentView(APIView):
    """گارسون یا ادمین تأیید می‌کند که وجه نقد دریافت شد"""

    def get_permissions(self):
        if self.request.user and self.request.user.is_staff:
            return [permissions.IsAdminUser()]
        return [IsWaiter()]

    @transaction.atomic
    def post(self, request, pk):
        try:
            order = Order.objects.select_for_update().get(pk=pk)
        except Order.DoesNotExist:
            return Response({'detail': 'سفارش یافت نشد'}, status=status.HTTP_404_NOT_FOUND)

        if (not request.user.is_staff and order.assigned_waiter_id
                and order.assigned_waiter_id != request.user.id):
            return Response({'detail': 'این سفارش به سرپرست سالن دیگری اختصاص دارد'}, status=status.HTTP_403_FORBIDDEN)

        if order.payment_method != Order.PaymentMethod.CASH:
            return Response(
                {'detail': 'این سفارش پرداخت آنلاین دارد'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if order.is_paid:
            return Response({'detail': 'وجه این سفارش قبلاً دریافت شده است'})

        order.is_paid = True
        order.save(update_fields=['is_paid'])

        # ثبت رکورد پرداخت نقدی
        from apps.payments.models import Payment
        Payment.objects.update_or_create(
            order=order,
            defaults={
                'user': order.user,
                'amount': order.final_price,
                'authority': f'CASH-{order.id}',
                'status': Payment.Status.SUCCESS,
                'ref_id': f'CASH-{order.id}',
                'description': f'پرداخت نقدی سفارش #{order.id}',
            }
        )

        log_staff_action(
            request.user, StaffActionLog.Action.CASH_COLLECTED,
            f'وجه نقد سفارش #{order.order_number} را وصول کرد{_assigned_waiter_suffix(order, request.user)}',
            order=order,
        )

        return Response({'detail': 'دریافت وجه تأیید شد', 'order_id': order.id})
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.db import transaction
from django.conf import settings

from .models import Order, OrderItem, OrderItemAddon
from apps.menu.models import MenuItemVariant, MenuItemAddon
from .serializers import (
    OrderCreateSerializer, OrderSerializer,
    AdminOrderSerializer, OrderStatusUpdateSerializer,
)
from apps.accounts.models import Address
from apps.accounts.permissions import IsWaiter
from apps.discounts.utils import apply_discount
from apps.notifications.sms import send_order_status_sms

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

        # سفارش نقدی بلافاصله PAID می‌شود — آشپزخانه فوری شروع می‌کند
        if payment_method == Order.PaymentMethod.CASH:
            order.status = Order.Status.PAID

        order.save()

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
        status_filter = self.request.query_params.get('status')
        date_filter = self.request.query_params.get('date')
        if date_filter:
            qs = qs.filter(created_at__date=date_filter)
            if status_filter:
                qs = qs.filter(status=status_filter)
        elif status_filter:
            qs = qs.filter(status=status_filter)
        else:
            qs = qs.exclude(status__in=[Order.Status.DELIVERED, Order.Status.CANCELLED])
        return qs


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

        # ارسال SMS
        phone = str(order.user.phone)
        send_order_status_sms(phone, order.order_number, order.status)

        return Response(OrderSerializer(order).data)


# ─── Waiter Views ────────────────────────────────────────────────────────────

WAITER_ALLOWED_STATUSES = {
    Order.Status.PREPARING, Order.Status.READY, Order.Status.DELIVERED,
}
# گارسون می‌تواند سفارش PAID را به PREPARING ببرد (شروع آماده‌سازی)
WAITER_ALLOWED_STATUSES_EXTENDED = WAITER_ALLOWED_STATUSES


class WaiterOrderListView(generics.ListAPIView):
    permission_classes = [IsWaiter]
    serializer_class = AdminOrderSerializer

    def get_queryset(self):
        perm = getattr(self.request.user, 'waiter_permissions', None)
        if not perm or not perm.can_manage_orders:
            return Order.objects.none()
        # WAITING_PAYMENT یعنی پرداخت آنلاین ناتمام — گارسون نباید آن را ببیند
        qs = Order.objects.exclude(
            status=Order.Status.WAITING_PAYMENT
        ).select_related('user', 'address', 'table').prefetch_related('items__menu_item')
        status_filter = self.request.query_params.get('status')
        date_filter = self.request.query_params.get('date')
        if date_filter:
            qs = qs.filter(created_at__date=date_filter)
            if status_filter:
                qs = qs.filter(status=status_filter)
        elif status_filter:
            qs = qs.filter(status=status_filter)
        else:
            qs = qs.exclude(status__in=[Order.Status.DELIVERED, Order.Status.CANCELLED])
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

        new_status = request.data.get('status')
        if new_status not in [s.value for s in WAITER_ALLOWED_STATUSES]:
            return Response(
                {'detail': f'گارسون تنها می‌تواند وضعیت را به {", ".join(s.value for s in WAITER_ALLOWED_STATUSES)} تغییر دهد'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        order.status = new_status
        order.save()

        phone = str(order.user.phone)
        send_order_status_sms(phone, order.order_number, order.status)

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

        return Response({'detail': 'دریافت وجه تأیید شد', 'order_id': order.id})
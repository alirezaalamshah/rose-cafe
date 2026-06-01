from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.db import transaction
from django.conf import settings

from .models import Order, OrderItem
from .serializers import (
    OrderCreateSerializer, OrderSerializer,
    AdminOrderSerializer, OrderStatusUpdateSerializer,
)
from apps.accounts.models import Address
from apps.discounts.utils import apply_discount
from apps.notifications.sms import send_order_status_sms

DELIVERY_COST = 35000


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

        delivery_cost = DELIVERY_COST if data['delivery_type'] == Order.DeliveryType.DELIVERY else 0

        # ساخت سفارش
        order = Order.objects.create(
            user=request.user,
            delivery_type=data['delivery_type'],
            address=address,
            note=data.get('note', ''),
            delivery_cost=delivery_cost,
        )

        # ساخت آیتم‌ها
        total = 0
        for item_data in data['items']:
            menu_item = item_data['menu_item']
            unit_price = menu_item.final_price
            OrderItem.objects.create(
                order=order,
                menu_item=menu_item,
                quantity=item_data['quantity'],
                unit_price=unit_price,
            )
            total += unit_price * item_data['quantity']

        order.total_price = total

        # اعمال تخفیف
        discount_code = data.get('discount_code', '')
        discount_amount = 0
        if discount_code:
            result = apply_discount(discount_code, total, request.user)
            if result['valid']:
                discount_amount = result['discount_amount']
                order.discount_code = discount_code
                order.discount_amount = discount_amount
            else:
                return Response(
                    {'detail': result['message']},
                    status=status.HTTP_400_BAD_REQUEST
                )

        order.final_price = total + delivery_cost - discount_amount
        order.save()

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

        if order.status not in [Order.Status.PENDING, Order.Status.CONFIRMED]:
            return Response(
                {'detail': 'امکان لغو این سفارش وجود ندارد'},
                status=status.HTTP_400_BAD_REQUEST
            )

        order.status = Order.Status.CANCELLED
        order.save()
        return Response({'detail': 'سفارش لغو شد'})


# Admin Views
class AdminOrderListView(generics.ListAPIView):
    permission_classes = [permissions.IsAdminUser]
    serializer_class = AdminOrderSerializer

    def get_queryset(self):  # type: ignore[override]
        qs = Order.objects.all().select_related(
            'user', 'address'
        ).prefetch_related('items__menu_item')
        status_filter = self.request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)
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
        send_order_status_sms(phone, order.id, order.status)

        return Response(OrderSerializer(order).data)
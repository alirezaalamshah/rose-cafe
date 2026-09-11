from django.conf import settings as django_settings
from django.db import transaction
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import ReceiptSettings, PrintJob
from .serializers import ReceiptSettingsSerializer, WalkInOrderCreateSerializer, PrintJobSerializer
from .services import get_walk_in_customer
from apps.orders.models import Order
from apps.orders.serializers import OrderSerializer
from apps.orders.services import create_order, OrderCreationError
from apps.accounts.permissions import IsWaiter, IsAdminOrWaiter
from apps.staff_activity.models import StaffActionLog, log_staff_action


class AdminReceiptSettingsView(generics.RetrieveUpdateAPIView):
    permission_classes = [permissions.IsAdminUser]
    serializer_class = ReceiptSettingsSerializer

    def get_object(self):
        return ReceiptSettings.get_settings()


def _check_walk_in_permission(request):
    if request.user.is_staff:
        return None
    perm = getattr(request.user, 'waiter_permissions', None)
    if not perm or not perm.can_take_walk_in_orders:
        return Response({'detail': 'دسترسی به ثبت سفارش حضوری ندارید'}, status=status.HTTP_403_FORBIDDEN)
    return None


class WalkInOrderMenuView(APIView):
    """فهرست آیتم‌های موجود منو برای پنل سفارش‌گیری حضوری — برخلاف
    WaiterMenuItemListView (که can_manage_menu_availability می‌خواهد و همه‌ی
    آیتم‌ها را برمی‌گرداند)، اینجا فقط آیتم‌های available با دسترسی جداگانه
    can_take_walk_in_orders لازم است، چون این دو قابلیت کاملاً بی‌ربط‌اند."""
    permission_classes = [IsAdminOrWaiter]

    def get(self, request):
        denied = _check_walk_in_permission(request)
        if denied:
            return denied
        from apps.menu.models import MenuItem
        from apps.menu.serializers import MenuItemAdminSerializer
        items = MenuItem.objects.filter(
            status=MenuItem.Status.AVAILABLE
        ).select_related('category').prefetch_related('variants', 'addons')
        return Response(MenuItemAdminSerializer(items, many=True).data)


class WalkInOrderTableView(APIView):
    """میزهای فعال برای انتخاب «سرو در کافه» — مثل WalkInOrderMenuView، دسترسی
    can_manage_tables نمی‌خواهد چون سفارش‌گیری حضوری فقط میز را می‌خواند، مدیریت نمی‌کند."""
    permission_classes = [IsAdminOrWaiter]

    def get(self, request):
        denied = _check_walk_in_permission(request)
        if denied:
            return denied
        from apps.reservations.models import Table as TableModel
        from apps.orders.serializers import TableSimpleSerializer
        tables = TableModel.objects.filter(is_active=True).order_by('number')
        return Response(TableSimpleSerializer(tables, many=True).data)


class WalkInOrderCreateView(APIView):
    """ثبت سفارش حضوری توسط پرسنل — برای مشتریانی که داخل اپلیکیشن سفارش نمی‌دهند.
    همیشه نقدی و مستقیم PAID ساخته می‌شود، چون خودِ پرسنل در محل سفارش را می‌گیرد
    (نیازی به تأیید جداگانه‌ی کافه نیست)."""

    def get_permissions(self):
        if self.request.user and self.request.user.is_staff:
            return [permissions.IsAdminUser()]
        return [IsWaiter()]

    @transaction.atomic
    def post(self, request):
        denied = _check_walk_in_permission(request)
        if denied:
            return denied

        serializer = WalkInOrderCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

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

        try:
            order = create_order(
                user=get_walk_in_customer(),
                items=data['items'],
                delivery_type=data['delivery_type'],
                payment_method=Order.PaymentMethod.CASH,
                table=table,
                note=data.get('note', ''),
                walk_in_customer_name=data.get('customer_name', ''),
                force_status=Order.Status.PAID,
            )
        except OrderCreationError as exc:
            return Response({'detail': exc.message}, status=status.HTTP_400_BAD_REQUEST)

        log_staff_action(
            request.user, StaffActionLog.Action.WALK_IN_ORDER_CREATED,
            f'سفارش حضوری #{order.order_number} را ثبت کرد', order=order,
        )

        return Response(OrderSerializer(order).data, status=status.HTTP_201_CREATED)


class PrintAgentAuthMixin:
    """Print Agent (برنامه‌ی محلی داخل کافه) با یک API Key ثابت در هدر احراز هویت
    می‌شود، نه توکن کاربر — دستگاه چاپ هیچ حساب کاربری ندارد. الگوی مشابه
    SNAPP_BOX_WEBHOOK_TOKEN."""
    permission_classes = [permissions.AllowAny]

    def _authenticated(self, request):
        key = request.headers.get('X-Print-Agent-Key', '')
        return bool(django_settings.PRINT_AGENT_API_KEY) and key == django_settings.PRINT_AGENT_API_KEY


class PendingPrintJobsView(PrintAgentAuthMixin, APIView):
    """Print Agent هر چند ثانیه این را poll می‌کند تا فیش‌های در انتظار را بگیرد."""

    def get(self, request):
        if not self._authenticated(request):
            return Response(status=status.HTTP_403_FORBIDDEN)
        jobs = PrintJob.objects.filter(
            status=PrintJob.Status.PENDING
        ).select_related('order__user', 'order__table').prefetch_related('order__items__menu_item', 'order__items__addons')
        return Response(PrintJobSerializer(jobs, many=True).data)


class AckPrintJobView(PrintAgentAuthMixin, APIView):
    """Print Agent بعد از چاپ موفق یک فیش، این را صدا می‌زند تا از صف pending خارج شود."""

    def post(self, request, pk):
        if not self._authenticated(request):
            return Response(status=status.HTTP_403_FORBIDDEN)
        try:
            job = PrintJob.objects.get(pk=pk)
        except PrintJob.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        job.mark_printed()
        return Response(status=status.HTTP_200_OK)

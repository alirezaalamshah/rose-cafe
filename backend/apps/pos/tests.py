"""
تست‌های پنل سفارش‌گیری حضوری و صف چاپ فیش:
- دسترسی can_take_walk_in_orders (ادمین/سرپرست سالن مجاز، بدون دسترسی رد می‌شود)
- سفارش حضوری همیشه مستقیم PAID ساخته می‌شود و صف چاپ (PrintJob) را پر می‌کند
- تأیید یک سفارش عادی (PENDING_CONFIRMATION -> PAID) هم صف چاپ را پر می‌کند
- endpointهای Print Agent (لیست pending + ack) فقط با API Key معتبر کار می‌کنند
"""
from datetime import time

from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APITestCase
from rest_framework import status

from apps.accounts.models import User, WaiterPermission
from apps.menu.models import Category, MenuItem
from apps.business.models import BusinessHours
from apps.reservations.models import Table
from apps.orders.models import Order
from .models import ReceiptSettings, PrintJob
from .services import get_walk_in_customer, render_receipt_text


class WalkInOrderTestCase(APITestCase):
    def setUp(self):
        for day in range(7):
            BusinessHours.objects.update_or_create(
                day_of_week=day,
                defaults={'is_open': True, 'open_time': time(0, 0), 'close_time': time(23, 59)},
            )
        self.category = Category.objects.create(name='نوشیدنی', slug='drinks-pos-test')
        self.item = MenuItem.objects.create(
            category=self.category, name='اسپرسو', slug='espresso-pos-test',
            price=80000, status=MenuItem.Status.AVAILABLE,
        )
        self.table = Table.objects.create(number=5, capacity=2, is_active=True)

        self.waiter = User.objects.create_user(phone='+989120001001', full_name='سرپرست تست')
        self.waiter.role = User.Role.WAITER
        self.waiter.save(update_fields=['role'])

        self.admin = User.objects.create_user(phone='+989120001002', full_name='ادمین تست')
        self.admin.is_staff = True
        self.admin.save(update_fields=['is_staff'])

    def _post_walk_in(self, user, **overrides):
        payload = {
            'items': [{'menu_item': self.item.id, 'quantity': 2}],
            'delivery_type': Order.DeliveryType.TAKEAWAY,
        }
        payload.update(overrides)
        self.client.force_authenticate(user=user)
        return self.client.post('/api/pos/walk-in-orders/', payload, format='json')

    def test_waiter_without_permission_denied(self):
        WaiterPermission.objects.create(user=self.waiter, can_take_walk_in_orders=False)
        response = self._post_walk_in(self.waiter)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_waiter_with_permission_creates_order(self):
        WaiterPermission.objects.create(user=self.waiter, can_take_walk_in_orders=True)
        response = self._post_walk_in(self.waiter, customer_name='آقای رضایی')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(response.data['status'], Order.Status.PAID)
        self.assertEqual(response.data['payment_method'], Order.PaymentMethod.CASH)
        self.assertEqual(response.data['total_price'], 160000)

        order = Order.objects.get(pk=response.data['id'])
        self.assertEqual(order.walk_in_customer_name, 'آقای رضایی')
        self.assertEqual(order.user, get_walk_in_customer())
        self.assertTrue(PrintJob.objects.filter(order=order).exists())

    def test_admin_creates_walk_in_order_without_explicit_permission(self):
        response = self._post_walk_in(self.admin)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)

    def test_dine_in_requires_table(self):
        WaiterPermission.objects.create(user=self.waiter, can_take_walk_in_orders=True)
        response = self._post_walk_in(self.waiter, delivery_type=Order.DeliveryType.DINE_IN)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_dine_in_with_table_succeeds(self):
        WaiterPermission.objects.create(user=self.waiter, can_take_walk_in_orders=True)
        response = self._post_walk_in(
            self.waiter, delivery_type=Order.DeliveryType.DINE_IN, table=self.table.id,
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(response.data['table'], self.table.id)

    def test_delivery_type_not_allowed(self):
        """پیک برای سفارش حضوری بی‌معناست — سریالایزر اصلاً آن را در choices ندارد."""
        WaiterPermission.objects.create(user=self.waiter, can_take_walk_in_orders=True)
        response = self._post_walk_in(self.waiter, delivery_type=Order.DeliveryType.DELIVERY)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_shared_walk_in_customer_reused_across_orders(self):
        WaiterPermission.objects.create(user=self.waiter, can_take_walk_in_orders=True)
        self._post_walk_in(self.waiter, customer_name='مشتری اول')
        self._post_walk_in(self.waiter, customer_name='مشتری دوم')
        self.assertEqual(User.objects.filter(phone=get_walk_in_customer().phone).count(), 1)


class OrderApprovalPrintJobTestCase(APITestCase):
    """تأیید یک سفارش عادی (نه حضوری) هم باید صف چاپ را پر کند."""

    def setUp(self):
        self.customer = User.objects.create_user(phone='+989120001003', full_name='مشتری تست')
        self.category = Category.objects.create(name='نوشیدنی', slug='drinks-pos-test-2')
        self.item = MenuItem.objects.create(
            category=self.category, name='کاپوچینو', slug='cappuccino-pos-test',
            price=90000, status=MenuItem.Status.AVAILABLE,
        )
        self.admin = User.objects.create_user(phone='+989120001004', full_name='ادمین تست')
        self.admin.is_staff = True
        self.admin.save(update_fields=['is_staff'])

        self.order = Order.objects.create(
            user=self.customer,
            delivery_type=Order.DeliveryType.TAKEAWAY,
            payment_method=Order.PaymentMethod.CASH,
            status=Order.Status.PENDING_CONFIRMATION,
        )

    def test_approve_creates_print_job(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(f'/api/orders/{self.order.id}/approve/', format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertTrue(PrintJob.objects.filter(order=self.order).exists())


class PrintAgentEndpointsTestCase(APITestCase):
    @override_settings(PRINT_AGENT_API_KEY='test-secret-key')
    def test_pending_jobs_requires_valid_key(self):
        response = self.client.get('/api/pos/print-jobs/pending/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        response = self.client.get(
            '/api/pos/print-jobs/pending/', HTTP_X_PRINT_AGENT_KEY='wrong-key',
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        response = self.client.get(
            '/api/pos/print-jobs/pending/', HTTP_X_PRINT_AGENT_KEY='test-secret-key',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    @override_settings(PRINT_AGENT_API_KEY='test-secret-key')
    def test_pending_jobs_lists_only_pending_and_ack_marks_printed(self):
        customer = User.objects.create_user(phone='+989120001005', full_name='مشتری تست')
        category = Category.objects.create(name='نوشیدنی', slug='drinks-pos-test-3')
        item = MenuItem.objects.create(
            category=category, name='موکا', slug='mocha-pos-test',
            price=95000, status=MenuItem.Status.AVAILABLE,
        )
        order = Order.objects.create(
            user=customer, delivery_type=Order.DeliveryType.TAKEAWAY,
            payment_method=Order.PaymentMethod.CASH, status=Order.Status.PAID,
        )
        from apps.orders.models import OrderItem
        OrderItem.objects.create(order=order, menu_item=item, quantity=1, unit_price=95000)
        job = PrintJob.objects.create(order=order)

        response = self.client.get(
            '/api/pos/print-jobs/pending/', HTTP_X_PRINT_AGENT_KEY='test-secret-key',
        )
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['order_number'], order.order_number)
        self.assertIn('موکا', response.data[0]['receipt_text'])

        ack_response = self.client.post(
            f'/api/pos/print-jobs/{job.id}/ack/', HTTP_X_PRINT_AGENT_KEY='test-secret-key',
        )
        self.assertEqual(ack_response.status_code, status.HTTP_200_OK)
        job.refresh_from_db()
        self.assertEqual(job.status, PrintJob.Status.PRINTED)

        response = self.client.get(
            '/api/pos/print-jobs/pending/', HTTP_X_PRINT_AGENT_KEY='test-secret-key',
        )
        self.assertEqual(len(response.data), 0)


class ReceiptSettingsTestCase(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(phone='+989120001006', full_name='ادمین تست')
        self.admin.is_staff = True
        self.admin.save(update_fields=['is_staff'])

    def test_admin_can_update_receipt_settings(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.patch(
            '/api/pos/admin/receipt-settings/',
            {'footer_text': 'منتظر حضور دوباره‌تان هستیم', 'show_customer_phone': True},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        settings_obj = ReceiptSettings.get_settings()
        self.assertEqual(settings_obj.footer_text, 'منتظر حضور دوباره‌تان هستیم')
        self.assertTrue(settings_obj.show_customer_phone)

    def test_non_admin_cannot_update_receipt_settings(self):
        customer = User.objects.create_user(phone='+989120001007', full_name='مشتری تست')
        self.client.force_authenticate(user=customer)
        response = self.client.patch(
            '/api/pos/admin/receipt-settings/', {'footer_text': 'x'}, format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

"""تست‌های داشبورد ادمین (`config/dashboard.py`) — عمدتاً بخش‌های بازه‌ی زمانی جدید."""
from datetime import time, timedelta

from django.core.cache import cache
from django.utils import timezone
from rest_framework.test import APITestCase
from rest_framework import status

from apps.accounts.models import User
from apps.business.models import BusinessHours
from apps.discounts.models import Discount
from apps.menu.models import Category, MenuItem, MenuItemAddon
from apps.orders.models import Order, OrderItem, OrderItemAddon
from apps.reviews.models import Review
from apps.wallet.models import LoyaltySettings, WalletTransaction
from apps.wallet.services import credit, debit


class AdminDashboardRangeTestCase(APITestCase):
    def setUp(self):
        # CachedSingletonModel (LoyaltySettings) از cache فرآیندی استفاده می‌کند که rollback
        # تراکنش هر تست پاکش نمی‌کند — بین تست‌ها دستی پاک می‌شود (همان الگوی apps/wallet/tests.py)
        cache.clear()
        self.admin = User.objects.create_user(phone='+989120000041', full_name='ادمین تست')
        self.admin.is_staff = True
        self.admin.save(update_fields=['is_staff'])
        self.customer = User.objects.create_user(phone='+989120000042', full_name='مشتری تست')

        for day in range(7):
            BusinessHours.objects.update_or_create(
                day_of_week=day,
                defaults={'is_open': True, 'open_time': time(0, 0), 'close_time': time(23, 59)},
            )

        self.category = Category.objects.create(name='صبحانه', slug='breakfast-dash-test')
        self.item = MenuItem.objects.create(
            category=self.category, name='املت', slug='omelette-dash-test',
            price=80000, status=MenuItem.Status.AVAILABLE,
        )
        self.addon = MenuItemAddon.objects.create(item=self.item, name='پنیر اضافه', price=20000)
        self.today_iso = timezone.localdate().isoformat()

    def _create_order(self, status_value, is_paid, discount_amount=0, rejection_reason=''):
        order = Order.objects.create(
            user=self.customer, delivery_type=Order.DeliveryType.TAKEAWAY,
            payment_method=Order.PaymentMethod.CASH, status=status_value, is_paid=is_paid,
            final_price=180000, discount_amount=discount_amount, rejection_reason=rejection_reason,
        )
        order_item = OrderItem.objects.create(order=order, menu_item=self.item, quantity=2, unit_price=80000)
        OrderItemAddon.objects.create(order_item=order_item, addon=self.addon, name=self.addon.name, price=20000)
        return order

    def test_range_omitted_when_no_date_params(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get('/api/dashboard/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertNotIn('range', response.data)

    def test_range_financial_counts_only_paid_non_cancelled_orders(self):
        self._create_order(Order.Status.DELIVERED, True, discount_amount=15000)
        self._create_order(Order.Status.CANCELLED, True)
        self._create_order(Order.Status.WAITING_PAYMENT, False)

        self.client.force_authenticate(user=self.admin)
        response = self.client.get('/api/dashboard/', {'from': self.today_iso, 'to': self.today_iso})
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)

        financial = response.data['range']['financial']
        self.assertEqual(financial['orders_count'], 1)
        self.assertEqual(financial['revenue'], 180000)
        self.assertEqual(financial['discount_given'], 15000)
        self.assertEqual(financial['discount_orders_count'], 1)

    def test_range_quality_rejection_rate_and_reasons(self):
        self._create_order(Order.Status.DELIVERED, True)
        self._create_order(Order.Status.REJECTED, False, rejection_reason='آیتم موجود نبود')
        self._create_order(Order.Status.REJECTED, False, rejection_reason='آیتم موجود نبود')

        self.client.force_authenticate(user=self.admin)
        response = self.client.get('/api/dashboard/', {'from': self.today_iso, 'to': self.today_iso})
        quality = response.data['range']['quality']
        self.assertEqual(quality['total_orders'], 3)
        self.assertEqual(quality['rejected_count'], 2)
        self.assertAlmostEqual(quality['rejection_rate'], 66.7, delta=0.1)
        self.assertEqual(quality['top_rejection_reasons'][0]['reason'], 'آیتم موجود نبود')
        self.assertEqual(quality['top_rejection_reasons'][0]['count'], 2)

    def test_range_quality_average_rating(self):
        other_customer = User.objects.create_user(phone='+989120000044', full_name='مشتری دیگر')
        Review.objects.create(user=self.customer, menu_item=self.item, rating=4, is_approved=True)
        Review.objects.create(user=self.admin, menu_item=self.item, rating=2, is_approved=True)
        Review.objects.create(user=other_customer, menu_item=self.item, rating=5, is_approved=False)  # not approved — excluded

        self.client.force_authenticate(user=self.admin)
        response = self.client.get('/api/dashboard/', {'from': self.today_iso, 'to': self.today_iso})
        quality = response.data['range']['quality']
        self.assertEqual(quality['ratings_count'], 2)
        self.assertEqual(quality['avg_rating'], 3.0)

    def test_range_sales_top_category_variant_addon_and_repeat_customers(self):
        self._create_order(Order.Status.DELIVERED, True)
        self._create_order(Order.Status.DELIVERED, True)  # same customer twice — repeat

        self.client.force_authenticate(user=self.admin)
        response = self.client.get('/api/dashboard/', {'from': self.today_iso, 'to': self.today_iso})
        sales = response.data['range']['sales']
        self.assertEqual(sales['top_items'][0]['name'], 'املت')
        self.assertEqual(sales['top_items'][0]['quantity'], 4)  # 2 orders × qty 2
        self.assertEqual(sales['top_categories'][0]['category_name'], 'صبحانه')
        self.assertEqual(sales['top_categories'][0]['quantity'], 4)  # 2 orders × qty 2
        self.assertEqual(sales['top_addons'][0]['name'], 'پنیر اضافه')
        self.assertEqual(sales['unique_customers'], 1)
        self.assertEqual(sales['repeat_customer_rate'], 100.0)
        self.assertEqual(sales['top_customers'][0]['user_id'], self.customer.id)
        self.assertEqual(sales['top_customers'][0]['orders_count'], 2)
        self.assertEqual(sales['top_customers'][0]['total_spent'], 360000)  # 2 × 180000

    def test_range_sales_new_users(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get('/api/dashboard/', {'from': self.today_iso, 'to': self.today_iso})
        # self.admin و self.customer هر دو همین الان (در setUp) ساخته شدند — هر دو در بازه‌ی امروز جدیدند
        self.assertEqual(response.data['range']['sales']['new_users'], 2)

    def test_range_wallet_stats(self):
        credit(self.customer, 100000, WalletTransaction.Type.TOPUP)
        settings_obj = LoyaltySettings.get_settings()
        settings_obj.is_enabled = True
        settings_obj.cashback_percentage = 10
        settings_obj.save()
        order = self._create_order(Order.Status.DELIVERED, True)
        from apps.wallet.services import credit_order_cashback
        credit_order_cashback(order)

        self.client.force_authenticate(user=self.admin)
        response = self.client.get('/api/dashboard/', {'from': self.today_iso, 'to': self.today_iso})
        financial = response.data['range']['financial']
        self.assertEqual(financial['wallet_topups'], 100000)
        self.assertEqual(financial['wallet_cashback_paid'], 18000)  # 10% of 180000
        # سفارش با CASH پرداخت شد (نه از کیف‌پول) — موجودی فقط از شارژ + کش‌بک تشکیل می‌شود
        self.assertEqual(financial['wallet_total_balance'], 100000 + 18000)

    def test_range_staff_reuses_existing_stats_helper(self):
        waiter = User.objects.create_user(phone='+989120000043', full_name='سرپرست تست')
        waiter.role = User.Role.WAITER
        waiter.save(update_fields=['role'])

        self.client.force_authenticate(user=self.admin)
        response = self.client.get('/api/dashboard/', {'from': self.today_iso, 'to': self.today_iso})
        staff_rows = response.data['range']['staff']['rows']
        self.assertTrue(any(r['waiter_id'] == waiter.id for r in staff_rows))

    def test_range_requires_admin(self):
        response = self.client.get('/api/dashboard/', {'from': self.today_iso, 'to': self.today_iso})
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_comparison_against_previous_equal_length_period(self):
        # بازه‌ی انتخابی: امروز و دیروز (۲ روز) — یک سفارش داخل بازه
        yesterday_iso = (timezone.localdate() - timedelta(days=1)).isoformat()
        self._create_order(Order.Status.DELIVERED, True)  # امروز، final_price=180000

        # بازه‌ی «قبلی» درست‌قبل از بازه‌ی انتخابی (۲ روز پیش از دیروز) — باید در comparison دیده شود
        old_order = self._create_order(Order.Status.DELIVERED, True)
        Order.objects.filter(pk=old_order.pk).update(created_at=timezone.now() - timedelta(days=3))

        self.client.force_authenticate(user=self.admin)
        response = self.client.get('/api/dashboard/', {'from': yesterday_iso, 'to': self.today_iso})
        comparison = response.data['range']['comparison']
        # بازه‌ی فعلی ۱۸۰۰۰۰ درآمد دارد، بازه‌ی قبلی هم ۱۸۰۰۰۰ (همان مبلغ) — تغییر ۰٪
        self.assertEqual(comparison['revenue_change_pct'], 0.0)
        self.assertEqual(comparison['orders_change_pct'], 0.0)

    def test_comparison_none_when_no_previous_period_data(self):
        self._create_order(Order.Status.DELIVERED, True)
        self.client.force_authenticate(user=self.admin)
        response = self.client.get('/api/dashboard/', {'from': self.today_iso, 'to': self.today_iso})
        comparison = response.data['range']['comparison']
        self.assertIsNone(comparison['revenue_change_pct'])
        self.assertIsNone(comparison['orders_change_pct'])

    def test_courier_stats_empty_when_nothing_dispatched(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get('/api/dashboard/', {'from': self.today_iso, 'to': self.today_iso})
        courier = response.data['range']['courier']
        self.assertEqual(courier['total_dispatched'], 0)
        self.assertIsNone(courier['cancellation_rate'])
        self.assertIsNone(courier['avg_delivery_minutes'])

    def test_courier_stats_with_real_records(self):
        from apps.snapp.models import SnappCourierOrder

        order1 = self._create_order(Order.Status.DELIVERED, True)
        order2 = self._create_order(Order.Status.DELIVERED, True)
        order3 = self._create_order(Order.Status.DELIVERED, True)

        now = timezone.now()
        delivered = SnappCourierOrder.objects.create(
            order=order1, snapp_order_id='s1', status=SnappCourierOrder.Status.DELIVERED,
            delivery_fare=45000,
        )
        SnappCourierOrder.objects.filter(pk=delivered.pk).update(
            dispatched_at=now - timedelta(minutes=20), last_webhook_at=now,
        )
        cancelled = SnappCourierOrder.objects.create(
            order=order2, snapp_order_id='s2', status=SnappCourierOrder.Status.CANCELLED,
        )
        SnappCourierOrder.objects.filter(pk=cancelled.pk).update(dispatched_at=now)
        SnappCourierOrder.objects.create(
            order=order3, snapp_order_id='s3', status=SnappCourierOrder.Status.ACCEPTED,
        )

        self.client.force_authenticate(user=self.admin)
        response = self.client.get('/api/dashboard/', {'from': self.today_iso, 'to': self.today_iso})
        courier = response.data['range']['courier']
        self.assertEqual(courier['total_dispatched'], 3)
        self.assertEqual(courier['delivered_count'], 1)
        self.assertEqual(courier['cancelled_count'], 1)
        self.assertAlmostEqual(courier['cancellation_rate'], 33.3, places=1)
        self.assertAlmostEqual(courier['avg_delivery_minutes'], 20.0, places=0)
        self.assertEqual(courier['total_delivery_fare'], 45000)

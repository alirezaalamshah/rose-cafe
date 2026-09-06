"""تست‌های «گزارش کامل مشتری» برای ادمین — summary/orders/wallet/discount/reservations/reviews."""
from datetime import time
from unittest.mock import patch

from django.utils import timezone
from rest_framework.test import APITestCase
from rest_framework import status

from .models import User
from apps.business.models import BusinessHours
from apps.menu.models import Category, MenuItem
from apps.orders.models import Order, OrderItem
from apps.discounts.models import Discount, DiscountUsage
from apps.reservations.models import Table, Reservation
from apps.reviews.models import Review, CafeReview
from apps.wallet.services import credit
from apps.wallet.models import WalletTransaction


class AdminUserDetailReportTestCase(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(phone='+989120000051', full_name='ادمین تست')
        self.admin.is_staff = True
        self.admin.save(update_fields=['is_staff'])
        self.customer = User.objects.create_user(phone='+989120000052', full_name='مشتری تست')

        for day in range(7):
            BusinessHours.objects.update_or_create(
                day_of_week=day,
                defaults={'is_open': True, 'open_time': time(0, 0), 'close_time': time(23, 59)},
            )

        self.category = Category.objects.create(name='نوشیدنی', slug='drinks-user-detail-test')
        self.item = MenuItem.objects.create(
            category=self.category, name='لاته', slug='latte-user-detail-test',
            price=100000, status=MenuItem.Status.AVAILABLE,
        )

        self.client.force_authenticate(user=self.admin)

    def _create_paid_order(self, discount_amount=0):
        order = Order.objects.create(
            user=self.customer, delivery_type=Order.DeliveryType.TAKEAWAY,
            payment_method=Order.PaymentMethod.CASH, status=Order.Status.DELIVERED, is_paid=True,
            final_price=100000 - discount_amount, discount_amount=discount_amount,
        )
        OrderItem.objects.create(order=order, menu_item=self.item, quantity=1, unit_price=100000)
        return order

    def test_summary_aggregates_orders_wallet_discount(self):
        self._create_paid_order()
        self._create_paid_order(discount_amount=10000)
        credit(self.customer, 50000, WalletTransaction.Type.TOPUP)

        response = self.client.get(f'/api/auth/admin/users/{self.customer.id}/summary/')
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        data = response.data
        self.assertEqual(data['orders_count'], 2)
        self.assertEqual(data['total_spent'], 190000)  # 100000 + 90000
        self.assertEqual(data['avg_order'], 95000)
        self.assertEqual(data['total_discount_used'], 10000)
        self.assertEqual(data['wallet_balance'], 50000)
        self.assertEqual(data['profile']['id'], self.customer.id)

    def test_summary_requires_admin(self):
        self.client.force_authenticate(user=self.customer)
        response = self.client.get(f'/api/auth/admin/users/{self.customer.id}/summary/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_orders_tab_lists_only_this_user(self):
        self._create_paid_order()
        other = User.objects.create_user(phone='+989120000053', full_name='مشتری دیگر')
        other_order = Order.objects.create(
            user=other, delivery_type=Order.DeliveryType.TAKEAWAY,
            payment_method=Order.PaymentMethod.CASH, final_price=50000,
        )

        response = self.client.get(f'/api/auth/admin/users/{self.customer.id}/orders/')
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        results = response.data['results'] if 'results' in response.data else response.data
        order_ids = [o['id'] for o in results]
        self.assertNotIn(other_order.id, order_ids)
        self.assertEqual(len(results), 1)

    def test_wallet_transactions_tab(self):
        credit(self.customer, 30000, WalletTransaction.Type.TOPUP, description='شارژ تست')
        response = self.client.get(f'/api/auth/admin/users/{self.customer.id}/wallet-transactions/')
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        results = response.data['results'] if 'results' in response.data else response.data
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['amount'], 30000)

    def test_discount_usage_tab_enriches_order_info(self):
        discount = Discount.objects.create(
            code='TESTCODE', discount_type=Discount.DiscountType.FIXED, value=10000,
            valid_from=timezone.now(), valid_until=timezone.now() + timezone.timedelta(days=30),
        )
        order = self._create_paid_order(discount_amount=10000)
        DiscountUsage.objects.create(discount=discount, user=self.customer, order_id=order.id)

        response = self.client.get(f'/api/auth/admin/users/{self.customer.id}/discount-usage/')
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        results = response.data['results'] if 'results' in response.data else response.data
        self.assertEqual(results[0]['discount_code'], 'TESTCODE')
        self.assertEqual(results[0]['order_number'], order.order_number)
        self.assertEqual(results[0]['order_discount_amount'], 10000)

    def test_reservations_tab(self):
        table = Table.objects.create(number=1, capacity=4)
        Reservation.objects.create(
            user=self.customer, table=table, date=timezone.localdate(),
            start_time=time(18, 0), end_time=time(19, 0), guests_count=2,
        )
        response = self.client.get(f'/api/auth/admin/users/{self.customer.id}/reservations/')
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        results = response.data['results'] if 'results' in response.data else response.data
        self.assertEqual(len(results), 1)

    def test_reviews_tab_combines_menu_and_cafe_reviews(self):
        Review.objects.create(user=self.customer, menu_item=self.item, rating=5, is_approved=True)
        CafeReview.objects.create(user=self.customer, rating=4, comment='خوب بود', is_approved=True)

        response = self.client.get(f'/api/auth/admin/users/{self.customer.id}/reviews/')
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(len(response.data['menu_reviews']), 1)
        self.assertEqual(len(response.data['cafe_reviews']), 1)

    def test_summary_includes_tier(self):
        for _ in range(3):
            self._create_paid_order()
        response = self.client.get(f'/api/auth/admin/users/{self.customer.id}/summary/')
        self.assertEqual(response.data['tier'], 'regular')  # 3 orders >= REGULAR_MIN_ORDERS(2), < VIP thresholds

    def test_admin_note_editable_via_user_detail_patch(self):
        response = self.client.patch(f'/api/auth/admin/users/{self.customer.id}/', {'admin_note': 'حساسیت به گلوتن دارد'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.customer.refresh_from_db()
        self.assertEqual(self.customer.admin_note, 'حساسیت به گلوتن دارد')


class AdminWalletAdjustmentTestCase(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(phone='+989120000061', full_name='ادمین تست')
        self.admin.is_staff = True
        self.admin.save(update_fields=['is_staff'])
        self.customer = User.objects.create_user(phone='+989120000062', full_name='مشتری تست')
        self.client.force_authenticate(user=self.admin)

    def test_credit_adjustment(self):
        response = self.client.post(
            f'/api/auth/admin/users/{self.customer.id}/wallet-adjustment/',
            {'amount': 20000, 'description': 'جبران سفارش خراب'}, format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(response.data['balance'], 20000)
        self.assertTrue(
            WalletTransaction.objects.filter(
                wallet__user=self.customer, type=WalletTransaction.Type.ADMIN_ADJUSTMENT, amount=20000,
            ).exists()
        )

    def test_debit_adjustment_insufficient_balance(self):
        response = self.client.post(
            f'/api/auth/admin/users/{self.customer.id}/wallet-adjustment/',
            {'amount': -10000, 'description': 'اصلاح اشتباه'}, format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_requires_description(self):
        response = self.client.post(
            f'/api/auth/admin/users/{self.customer.id}/wallet-adjustment/',
            {'amount': 10000}, format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_requires_admin(self):
        self.client.force_authenticate(user=self.customer)
        response = self.client.post(
            f'/api/auth/admin/users/{self.customer.id}/wallet-adjustment/',
            {'amount': 10000, 'description': 'x'}, format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class AdminChurnedCustomersTestCase(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(phone='+989120000071', full_name='ادمین تست')
        self.admin.is_staff = True
        self.admin.save(update_fields=['is_staff'])
        self.category = Category.objects.create(name='نوشیدنی', slug='drinks-churn-test')
        self.item = MenuItem.objects.create(
            category=self.category, name='لاته', slug='latte-churn-test',
            price=100000, status=MenuItem.Status.AVAILABLE,
        )
        self.client.force_authenticate(user=self.admin)

    def _order_for(self, user, created_at):
        order = Order.objects.create(
            user=user, delivery_type=Order.DeliveryType.TAKEAWAY,
            payment_method=Order.PaymentMethod.CASH, status=Order.Status.DELIVERED,
            is_paid=True, final_price=100000,
        )
        Order.objects.filter(pk=order.pk).update(created_at=created_at)
        OrderItem.objects.create(order=order, menu_item=self.item, quantity=1, unit_price=100000)
        return order

    def test_lists_customer_inactive_for_over_threshold_days(self):
        churned = User.objects.create_user(phone='+989120000072', full_name='مشتری قدیمی')
        self._order_for(churned, timezone.now() - timezone.timedelta(days=40))
        self._order_for(churned, timezone.now() - timezone.timedelta(days=30))

        active = User.objects.create_user(phone='+989120000073', full_name='مشتری فعال')
        self._order_for(active, timezone.now() - timezone.timedelta(days=2))
        self._order_for(active, timezone.now() - timezone.timedelta(days=1))

        one_timer = User.objects.create_user(phone='+989120000074', full_name='مشتری یک‌باره')
        self._order_for(one_timer, timezone.now() - timezone.timedelta(days=40))

        response = self.client.get('/api/auth/admin/customers/churned/')
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        results = response.data['results'] if 'results' in response.data else response.data
        ids = [r['id'] for r in results]
        self.assertIn(churned.id, ids)
        self.assertNotIn(active.id, ids)
        self.assertNotIn(one_timer.id, ids)  # فقط ۱ سفارش داشته — «واقعاً مشتری بوده» حساب نمی‌شود

        # last_order_at باید واقعاً در پاسخ باشد (باگ قبلی: سریالایزر این فیلد را
        # expose نمی‌کرد و فرانت با undefined روبه‌رو می‌شد → «NaN روز پیش»)
        churned_row = next(r for r in results if r['id'] == churned.id)
        self.assertIsNotNone(churned_row['last_order_at'])


class AdminUserListWalletBalanceTestCase(APITestCase):
    """ستون کیف‌پول در جدول کاربران — لیست باید موجودی هر کاربر را بدون N+1 برگرداند."""

    def setUp(self):
        self.admin = User.objects.create_user(phone='+989120000081', full_name='ادمین تست')
        self.admin.is_staff = True
        self.admin.save(update_fields=['is_staff'])
        self.client.force_authenticate(user=self.admin)

    def test_list_includes_wallet_balance(self):
        charged = User.objects.create_user(phone='+989120000082', full_name='مشتری شارژدار')
        credit(charged, 75000, WalletTransaction.Type.TOPUP)
        uncharged = User.objects.create_user(phone='+989120000083', full_name='مشتری بدون کیف‌پول')

        response = self.client.get('/api/auth/admin/users/')
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        results = response.data['results'] if 'results' in response.data else response.data
        by_id = {r['id']: r for r in results}

        self.assertEqual(by_id[charged.id]['wallet_balance'], 75000)
        # کاربری که هنوز Wallet ندارد باید صفر برگردد (نه None/خطا)
        self.assertEqual(by_id[uncharged.id]['wallet_balance'], 0)

    def test_detail_retrieve_does_not_include_wallet_balance(self):
        # AdminUserDetailView (retrieve تکی) از annotate_customer_stats استفاده نمی‌کند —
        # باید None برگرداند، نه صفر (تا با «موجودی واقعاً صفر است» قاطی نشود)
        user = User.objects.create_user(phone='+989120000084', full_name='کاربر تست')
        response = self.client.get(f'/api/auth/admin/users/{user.id}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertIsNone(response.data['wallet_balance'])


class AddressCoordinatesRequiredTestCase(APITestCase):
    """مختصات نقشه (latitude/longitude) اجباری است — بدون آن سفارش پیک اسنپ‌باکس
    اصلاً مقصد ندارد؛ این چک باید هم در ایجاد هم در ویرایش جزئی اعمال شود."""

    def setUp(self):
        self.user = User.objects.create_user(phone='+989120000091', full_name='مشتری تست آدرس')
        self.client.force_authenticate(user=self.user)

    def _payload(self, **overrides):
        payload = {
            'title': 'خانه', 'city': 'دزفول', 'street': 'خیابان آزادگان',
            'latitude': '32.390000', 'longitude': '48.410000',
        }
        payload.update(overrides)
        return payload

    def test_create_fails_without_coordinates(self):
        response = self.client.post('/api/auth/addresses/', self._payload(latitude='', longitude=''))
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_fails_with_only_one_coordinate(self):
        response = self.client.post('/api/auth/addresses/', self._payload(longitude=''))
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_succeeds_with_coordinates(self):
        response = self.client.post('/api/auth/addresses/', self._payload())
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)

    def test_patch_cannot_clear_coordinates_from_existing_address(self):
        create_response = self.client.post('/api/auth/addresses/', self._payload())
        address_id = create_response.data['id']

        response = self.client.patch(f'/api/auth/addresses/{address_id}/', {'latitude': ''})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class AddressDeliveryRadiusTestCase(APITestCase):
    """جلوگیری از ثبت آدرس در شهر/منطقه‌ای خیلی دور از مبدای کافه — فقط وقتی مبدا
    در تنظیمات اسنپ‌باکس مشخص شده باشد اعمال می‌شود."""

    def setUp(self):
        from django.core.cache import cache
        from apps.snapp.models import SnappSettings
        # CachedSingletonModel از کش فرآیندی استفاده می‌کند — rollback خودکار پاکش نمی‌کند
        cache.clear()
        self.user = User.objects.create_user(phone='+989120000092', full_name='مشتری تست شعاع')
        self.client.force_authenticate(user=self.user)

        # مبدا: دزفول، میدان فرهنگ — شعاع مجاز ۱۵ کیلومتر (پیش‌فرض)
        self.snapp_settings = SnappSettings.get_settings()
        self.snapp_settings.store_latitude = '32.382500'
        self.snapp_settings.store_longitude = '48.404700'
        self.snapp_settings.max_delivery_radius_km = 15
        self.snapp_settings.save()

    def test_address_within_radius_is_accepted(self):
        payload = {
            'title': 'خانه', 'city': 'دزفول', 'street': 'خیابان آزادگان',
            'latitude': '32.390000', 'longitude': '48.410000',  # حدود ۱ کیلومتر با مبدا
        }
        response = self.client.post('/api/auth/addresses/', payload)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)

    def test_address_outside_radius_is_rejected(self):
        payload = {
            # اهواز — حدود ۱۰۰ کیلومتر با دزفول، خارج از شعاع مجاز
            'title': 'محل کار', 'city': 'اهواز', 'street': 'خیابان کیانپارس',
            'latitude': '31.317500', 'longitude': '48.687000',
        }
        response = self.client.post('/api/auth/addresses/', payload)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_radius_check_skipped_when_store_location_not_configured(self):
        self.snapp_settings.store_latitude = ''
        self.snapp_settings.store_longitude = ''
        self.snapp_settings.save()

        payload = {
            'title': 'محل کار', 'city': 'اهواز', 'street': 'خیابان کیانپارس',
            'latitude': '31.317500', 'longitude': '48.687000',
        }
        response = self.client.post('/api/auth/addresses/', payload)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)


class AddressGeocodingTestCase(APITestCase):
    """جست‌وجوی متنی آدرس و reverse geocoding — کلاینت واقعی Nominatim mock می‌شود،
    تست فقط لایه‌ی view/serialization ما را پوشش می‌دهد."""

    def setUp(self):
        self.user = User.objects.create_user(phone='+989120000093', full_name='مشتری تست جستجو')
        self.client.force_authenticate(user=self.user)

    def test_search_requires_query(self):
        response = self.client.get('/api/auth/addresses/geocode/search/')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    @patch('apps.accounts.views.geocoding.search_address')
    def test_search_returns_results(self, mock_search):
        mock_search.return_value = {
            'success': True,
            'results': [{'display_name': 'دزفول، میدان فرهنگ', 'latitude': '32.3825', 'longitude': '48.4047'}],
        }
        response = self.client.get('/api/auth/addresses/geocode/search/', {'q': 'میدان فرهنگ دزفول'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 1)

    @patch('apps.accounts.views.geocoding.search_address')
    def test_search_propagates_failure(self, mock_search):
        mock_search.return_value = {'success': False, 'message': 'خطای فرضی'}
        response = self.client.get('/api/auth/addresses/geocode/search/', {'q': 'تست'})
        self.assertEqual(response.status_code, status.HTTP_502_BAD_GATEWAY)

    def test_reverse_requires_coordinates(self):
        response = self.client.get('/api/auth/addresses/geocode/reverse/')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    @patch('apps.accounts.views.geocoding.reverse_geocode')
    def test_reverse_returns_address_fields(self, mock_reverse):
        mock_reverse.return_value = {
            'success': True, 'display_name': 'دزفول، خیابان آزادگان',
            'city': 'دزفول', 'province': 'خوزستان', 'street': 'خیابان آزادگان',
        }
        response = self.client.get('/api/auth/addresses/geocode/reverse/', {'lat': '32.39', 'lng': '48.41'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['city'], 'دزفول')


class AddressSearchRadiusFilterTestCase(APITestCase):
    """نتایج جست‌وجوی متنی آدرس باید به شعاع مجاز ثبت آدرس محدود شوند — حتی اگر
    Nominatim (به‌خاطر ماهیت مستطیلی viewbox) نتیجه‌ای کمی بیرون از شعاع واقعی برگرداند."""

    def setUp(self):
        from django.core.cache import cache
        from apps.snapp.models import SnappSettings
        cache.clear()
        self.user = User.objects.create_user(phone='+989120000094', full_name='مشتری تست فیلتر شعاع')
        self.client.force_authenticate(user=self.user)

        self.snapp_settings = SnappSettings.get_settings()
        self.snapp_settings.store_latitude = '32.382500'
        self.snapp_settings.store_longitude = '48.404700'
        self.snapp_settings.max_delivery_radius_km = 15
        self.snapp_settings.save()

    @patch('apps.accounts.views.geocoding.search_address')
    def test_results_outside_radius_are_filtered_out(self, mock_search):
        mock_search.return_value = {
            'success': True,
            'results': [
                {'display_name': 'دزفول، میدان فرهنگ', 'latitude': 32.3900, 'longitude': 48.4100},  # نزدیک
                {'display_name': 'اهواز، کیانپارس', 'latitude': 31.3175, 'longitude': 48.6870},  # دور
            ],
        }
        response = self.client.get('/api/auth/addresses/geocode/search/', {'q': 'تست'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 1)
        self.assertIn('میدان فرهنگ', response.data['results'][0]['display_name'])

    @patch('apps.accounts.views.geocoding.search_address')
    def test_no_results_within_radius_returns_helpful_message(self, mock_search):
        mock_search.return_value = {
            'success': True,
            'results': [{'display_name': 'اهواز، کیانپارس', 'latitude': 31.3175, 'longitude': 48.6870}],
        }
        response = self.client.get('/api/auth/addresses/geocode/search/', {'q': 'تست'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['results'], [])
        self.assertIn('محدوده', response.data['detail'])

    @patch('apps.accounts.views.geocoding.search_address')
    def test_search_uses_bounded_viewbox_when_store_configured(self, mock_search):
        mock_search.return_value = {'success': True, 'results': []}
        self.client.get('/api/auth/addresses/geocode/search/', {'q': 'تست'})
        _, kwargs = mock_search.call_args
        self.assertTrue(kwargs['bounded'])
        self.assertIsNotNone(kwargs['viewbox'])

"""
تست‌های مسیر حیاتی «ثبت سفارش» — این منطق چندبار در طول توسعه باگ داشته
(هزینه‌ی بسته‌بندی، افزودنی‌ها، تخفیف) پس محاسبه‌ی نهایی این‌جا قفل می‌شود.
"""
from datetime import time, timedelta

from django.utils import timezone
from rest_framework.test import APITestCase
from rest_framework import status

from apps.accounts.models import User
from apps.menu.models import Category, MenuItem, MenuItemVariant, MenuItemAddon
from apps.business.models import BusinessHours, DeliverySettings
from apps.discounts.models import Discount
from apps.reservations.models import Table
from .models import Order


class OrderCreationTestCase(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(phone='+989120000001', full_name='مشتری تست')
        self.client.force_authenticate(user=self.user)

        # کافه برای تمام روزهای هفته باز باشد تا تست به ساعت اجرا وابسته نباشد
        for day in range(7):
            BusinessHours.objects.update_or_create(
                day_of_week=day,
                defaults={'is_open': True, 'open_time': time(0, 0), 'close_time': time(23, 59)},
            )

        self.category = Category.objects.create(name='نوشیدنی', slug='drinks-test')
        self.item = MenuItem.objects.create(
            category=self.category, name='لاته', slug='latte-test',
            price=100000, status=MenuItem.Status.AVAILABLE,
        )
        self.addon = MenuItemAddon.objects.create(item=self.item, name='خامه اضافه', price=30000)

        DeliverySettings.objects.update_or_create(pk=1, defaults={
            'delivery_cost': 40000,
            'free_delivery_threshold': None,
            'takeaway_packaging_cost': 5000,
            'delivery_packaging_cost': 10000,
        })

        self.table = Table.objects.create(number=1, capacity=4, is_active=True)

    def _post_order(self, **overrides):
        payload = {
            'items': [{'menu_item': self.item.id, 'quantity': 1}],
            'delivery_type': Order.DeliveryType.TAKEAWAY,
            'payment_method': Order.PaymentMethod.CASH,
        }
        payload.update(overrides)
        return self.client.post('/api/orders/', payload, format='json')

    def test_basic_order_price(self):
        """بدون افزودنی/تخفیف/بسته‌بندی خاص — قیمت نهایی = قیمت آیتم + بسته‌بندی بیرون‌بر"""
        response = self._post_order()
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(response.data['total_price'], 100000)
        self.assertEqual(response.data['packaging_cost'], 5000)
        self.assertEqual(response.data['delivery_cost'], 0)
        self.assertEqual(response.data['final_price'], 105000)

    def test_addon_price_is_additive_per_unit(self):
        """افزودنی باید per-unit اضافه شود: (قیمت‌پایه + افزودنی) × تعداد"""
        response = self._post_order(items=[{
            'menu_item': self.item.id, 'quantity': 2, 'addon_ids': [self.addon.id],
        }])
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        # (100000 + 30000) * 2 = 260000
        self.assertEqual(response.data['total_price'], 260000)
        order = Order.objects.get(pk=response.data['id'])
        order_item = order.items.first()
        self.assertEqual(order_item.addons.count(), 1)
        self.assertEqual(order_item.addons.first().price, 30000)

    def test_packaging_cost_scales_with_total_item_quantity(self):
        """۲ لیوان قهوه باید ۲ برابر هزینه بسته‌بندی داشته باشد، نه یک‌بار برای کل سفارش"""
        response = self._post_order(items=[{'menu_item': self.item.id, 'quantity': 2}])
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(response.data['packaging_cost'], 5000 * 2)

    def test_packaging_cost_scales_across_multiple_line_items(self):
        """بسته‌بندی باید مجموع تعداد را در نظر بگیرد، حتی وقتی چند آیتم مختلف در یک سفارش باشد"""
        other_item = MenuItem.objects.create(
            category=self.category, name='کاپوچینو', slug='cappuccino-test',
            price=90000, status=MenuItem.Status.AVAILABLE,
        )
        response = self._post_order(items=[
            {'menu_item': self.item.id, 'quantity': 2},
            {'menu_item': other_item.id, 'quantity': 3},
        ])
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(response.data['packaging_cost'], 5000 * 5)

    def test_delivery_cost_stays_flat_regardless_of_quantity(self):
        """برخلاف بسته‌بندی، هزینه ارسال باید یک‌بار برای کل سفارش باشد نه per-unit"""
        from apps.accounts.models import Address
        address = Address.objects.create(user=self.user, title='خانه', city='تهران', street='ولیعصر')
        response = self._post_order(
            items=[{'menu_item': self.item.id, 'quantity': 3}],
            delivery_type=Order.DeliveryType.DELIVERY,
            payment_method=Order.PaymentMethod.ONLINE,
            address=address.id,
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(response.data['delivery_cost'], 40000)  # همیشه یک‌بار
        self.assertEqual(response.data['packaging_cost'], 10000 * 3)  # per-unit

    def test_variant_price_overrides_base_price(self):
        variant = MenuItemVariant.objects.create(
            item=self.item, name='بزرگ', price=130000, is_available=True,
        )
        response = self._post_order(items=[{
            'menu_item': self.item.id, 'quantity': 1, 'variant_id': variant.id,
        }])
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(response.data['total_price'], 130000)

    def test_delivery_type_dine_in_has_no_packaging_cost(self):
        """سرو در کافه نیازی به بسته‌بندی ندارد"""
        response = self._post_order(
            delivery_type=Order.DeliveryType.DINE_IN, table=self.table.id,
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(response.data['packaging_cost'], 0)
        self.assertEqual(response.data['delivery_cost'], 0)
        self.assertEqual(response.data['final_price'], 100000)

    def test_delivery_type_delivery_has_delivery_and_packaging_cost(self):
        from apps.accounts.models import Address
        address = Address.objects.create(
            user=self.user, title='خانه', city='تهران', street='خیابان آزادی',
        )
        response = self._post_order(
            delivery_type=Order.DeliveryType.DELIVERY,
            payment_method=Order.PaymentMethod.ONLINE,
            address=address.id,
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(response.data['delivery_cost'], 40000)
        self.assertEqual(response.data['packaging_cost'], 10000)
        self.assertEqual(response.data['final_price'], 100000 + 40000 + 10000)

    def test_free_delivery_above_threshold(self):
        DeliverySettings.objects.update_or_create(pk=1, defaults={
            'delivery_cost': 40000, 'free_delivery_threshold': 90000,
            'takeaway_packaging_cost': 5000, 'delivery_packaging_cost': 10000,
        })
        from apps.accounts.models import Address
        address = Address.objects.create(user=self.user, title='خانه', city='تهران', street='خیابان ولیعصر')
        response = self._post_order(
            delivery_type=Order.DeliveryType.DELIVERY,
            payment_method=Order.PaymentMethod.ONLINE,
            address=address.id,
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(response.data['delivery_cost'], 0)  # ۱۰۰۰۰۰ >= آستانه‌ی ۹۰۰۰۰

    def test_fixed_discount_applies_to_final_price(self):
        Discount.objects.create(
            code='TEST10K', discount_type=Discount.DiscountType.FIXED, value=10000,
            valid_from=timezone.now() - timedelta(days=1),
            valid_until=timezone.now() + timedelta(days=1),
        )
        response = self._post_order(discount_code='TEST10K')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(response.data['discount_amount'], 10000)
        self.assertEqual(response.data['final_price'], 100000 + 5000 - 10000)

    def test_percentage_discount_capped_by_max_amount(self):
        Discount.objects.create(
            code='PCT50', discount_type=Discount.DiscountType.PERCENTAGE, value=50,
            max_discount_amount=20000,
            valid_from=timezone.now() - timedelta(days=1),
            valid_until=timezone.now() + timedelta(days=1),
        )
        response = self._post_order(discount_code='PCT50')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        # ۵۰٪ از ۱۰۰۰۰۰ = ۵۰۰۰۰ ولی سقف تخفیف ۲۰۰۰۰ است
        self.assertEqual(response.data['discount_amount'], 20000)

    def test_invalid_discount_code_rejects_order(self):
        response = self._post_order(discount_code='NOT-EXIST')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Order.objects.count(), 0)

    def test_cash_payment_marks_order_as_paid_immediately(self):
        response = self._post_order(payment_method=Order.PaymentMethod.CASH)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(response.data['status'], Order.Status.PAID)

    def test_online_payment_stays_waiting_payment(self):
        response = self._post_order(payment_method=Order.PaymentMethod.ONLINE)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(response.data['status'], Order.Status.WAITING_PAYMENT)

    def test_unavailable_addon_is_silently_ignored(self):
        """افزودنی ناموجود نباید به قیمت اضافه شود (نه خطا، فقط نادیده گرفته شود)"""
        unavailable_addon = MenuItemAddon.objects.create(
            item=self.item, name='افزودنی ناموجود', price=99999, is_available=False,
        )
        response = self._post_order(items=[{
            'menu_item': self.item.id, 'quantity': 1, 'addon_ids': [unavailable_addon.id],
        }])
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(response.data['total_price'], 100000)

    def test_delivery_without_address_is_rejected(self):
        response = self._post_order(
            delivery_type=Order.DeliveryType.DELIVERY,
            payment_method=Order.PaymentMethod.ONLINE,
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_cafe_closed_rejects_order(self):
        BusinessHours.objects.filter(day_of_week=timezone.localtime(timezone.now()).weekday()).update(
            is_open=False,
        )
        response = self._post_order()
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Order.objects.count(), 0)

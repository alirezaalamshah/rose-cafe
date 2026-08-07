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

    def test_cash_payment_awaits_cafe_confirmation(self):
        response = self._post_order(payment_method=Order.PaymentMethod.CASH)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(response.data['status'], Order.Status.PENDING_CONFIRMATION)

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


class OrderApprovalWorkflowTestCase(APITestCase):
    """
    سفارش نقدی/آنلاین قبل از رفتن به صف آماده‌سازی باید توسط گارسون یا ادمین
    تأیید یا رد شود — و هر اکشن باید در StaffActionLog ثبت شود.
    """
    def setUp(self):
        from apps.accounts.models import WaiterPermission
        from apps.staff_activity.models import StaffActionLog

        self.StaffActionLog = StaffActionLog

        self.customer = User.objects.create_user(phone='+989120000002', full_name='مشتری')
        self.order = Order.objects.create(
            user=self.customer,
            delivery_type=Order.DeliveryType.TAKEAWAY,
            payment_method=Order.PaymentMethod.CASH,
            status=Order.Status.PENDING_CONFIRMATION,
            final_price=100000,
        )

        self.waiter = User.objects.create_user(phone='+989120000003', full_name='گارسون تست')
        self.waiter.role = User.Role.WAITER
        self.waiter.save(update_fields=['role'])
        WaiterPermission.objects.create(user=self.waiter, can_manage_orders=True)

        self.admin = User.objects.create_user(phone='+989120000004', full_name='ادمین تست')
        self.admin.is_staff = True
        self.admin.save(update_fields=['is_staff'])

    def test_waiter_can_approve_pending_order(self):
        self.client.force_authenticate(user=self.waiter)
        response = self.client.post(f'/api/orders/{self.order.id}/approve/')
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.order.refresh_from_db()
        self.assertEqual(self.order.status, Order.Status.PAID)
        self.assertTrue(
            self.StaffActionLog.objects.filter(
                user=self.waiter, action=self.StaffActionLog.Action.ORDER_APPROVED, order=self.order,
            ).exists()
        )

    def test_reject_requires_reason(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(f'/api/orders/{self.order.id}/reject/', {'reason': ''}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.order.refresh_from_db()
        self.assertEqual(self.order.status, Order.Status.PENDING_CONFIRMATION)

    def test_admin_can_reject_with_reason(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(
            f'/api/orders/{self.order.id}/reject/', {'reason': 'تمام شد لاته'}, format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.order.refresh_from_db()
        self.assertEqual(self.order.status, Order.Status.REJECTED)
        self.assertEqual(self.order.rejection_reason, 'تمام شد لاته')
        self.assertTrue(
            self.StaffActionLog.objects.filter(
                user=self.admin, action=self.StaffActionLog.Action.ORDER_REJECTED, order=self.order,
            ).exists()
        )

    def test_cannot_approve_already_approved_order(self):
        self.client.force_authenticate(user=self.waiter)
        self.client.post(f'/api/orders/{self.order.id}/approve/')
        response = self.client.post(f'/api/orders/{self.order.id}/approve/')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_waiter_without_order_permission_cannot_approve(self):
        from apps.accounts.models import WaiterPermission
        WaiterPermission.objects.filter(user=self.waiter).update(can_manage_orders=False)
        # پس از create() در setUp، جنگو رابطه‌ی معکوس OneToOne را روی self.waiter کش کرده —
        # باید مجدداً از دیتابیس خوانده شود تا مقدار به‌روزشده‌ی بالا را ببیند
        self.waiter.refresh_from_db()
        self.client.force_authenticate(user=self.waiter)
        response = self.client.post(f'/api/orders/{self.order.id}/approve/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_customer_cannot_approve_order(self):
        self.client.force_authenticate(user=self.customer)
        response = self.client.post(f'/api/orders/{self.order.id}/approve/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class OrderAssignmentLockTestCase(APITestCase):
    """
    از لحظه‌ای که یک گارسون سفارشی را تأیید/رد می‌کند، آن سفارش تا پایان مسیرش فقط برای
    همان گارسون قابل مشاهده/اکشن است — بقیه‌ی گارسون‌ها هیچ ردی از آن نمی‌بینند.
    """
    def setUp(self):
        from apps.accounts.models import WaiterPermission

        self.customer = User.objects.create_user(phone='+989120000010', full_name='مشتری')
        self.order = Order.objects.create(
            user=self.customer,
            delivery_type=Order.DeliveryType.TAKEAWAY,
            payment_method=Order.PaymentMethod.CASH,
            status=Order.Status.PENDING_CONFIRMATION,
            final_price=100000,
        )

        self.waiter_a = User.objects.create_user(phone='+989120000011', full_name='گارسون الف')
        self.waiter_a.role = User.Role.WAITER
        self.waiter_a.save(update_fields=['role'])
        WaiterPermission.objects.create(user=self.waiter_a, can_manage_orders=True)

        self.waiter_b = User.objects.create_user(phone='+989120000012', full_name='گارسون ب')
        self.waiter_b.role = User.Role.WAITER
        self.waiter_b.save(update_fields=['role'])
        WaiterPermission.objects.create(user=self.waiter_b, can_manage_orders=True)

        self.admin = User.objects.create_user(phone='+989120000013', full_name='ادمین تست')
        self.admin.is_staff = True
        self.admin.save(update_fields=['is_staff'])

    def test_approve_assigns_order_to_waiter(self):
        self.client.force_authenticate(user=self.waiter_a)
        self.client.post(f'/api/orders/{self.order.id}/approve/')
        self.order.refresh_from_db()
        self.assertEqual(self.order.assigned_waiter_id, self.waiter_a.id)
        self.assertIsNotNone(self.order.approved_at)

    def test_second_waiter_approve_gets_conflict_message(self):
        self.client.force_authenticate(user=self.waiter_a)
        self.client.post(f'/api/orders/{self.order.id}/approve/')

        self.client.force_authenticate(user=self.waiter_b)
        response = self.client.post(f'/api/orders/{self.order.id}/approve/')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('گارسون الف', response.data['detail'])

    def test_other_waiter_cannot_see_assigned_order(self):
        self.client.force_authenticate(user=self.waiter_a)
        self.client.post(f'/api/orders/{self.order.id}/approve/')

        self.client.force_authenticate(user=self.waiter_b)
        response = self.client.get('/api/orders/waiter/')
        results = response.data if isinstance(response.data, list) else response.data['results']
        ids = [o['id'] for o in results]
        self.assertNotIn(self.order.id, ids)

    def test_owning_waiter_still_sees_assigned_order(self):
        self.client.force_authenticate(user=self.waiter_a)
        self.client.post(f'/api/orders/{self.order.id}/approve/')
        response = self.client.get('/api/orders/waiter/')
        results = response.data if isinstance(response.data, list) else response.data['results']
        ids = [o['id'] for o in results]
        self.assertIn(self.order.id, ids)

    def test_other_waiter_cannot_change_status_of_assigned_order(self):
        self.client.force_authenticate(user=self.waiter_a)
        self.client.post(f'/api/orders/{self.order.id}/approve/')

        self.client.force_authenticate(user=self.waiter_b)
        response = self.client.patch(
            f'/api/orders/waiter/{self.order.id}/status/', {'status': 'preparing'}, format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_other_waiter_cannot_confirm_cash_of_assigned_order(self):
        self.client.force_authenticate(user=self.waiter_a)
        self.client.post(f'/api/orders/{self.order.id}/approve/')

        self.client.force_authenticate(user=self.waiter_b)
        response = self.client.post(f'/api/orders/{self.order.id}/confirm-cash/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_can_act_on_order_assigned_to_waiter(self):
        self.client.force_authenticate(user=self.waiter_a)
        self.client.post(f'/api/orders/{self.order.id}/approve/')

        self.client.force_authenticate(user=self.admin)
        response = self.client.post(f'/api/orders/{self.order.id}/confirm-cash/')
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.order.refresh_from_db()
        self.assertTrue(self.order.is_paid)

    def test_admin_approved_order_stays_unassigned_and_shared(self):
        self.client.force_authenticate(user=self.admin)
        self.client.post(f'/api/orders/{self.order.id}/approve/')
        self.order.refresh_from_db()
        self.assertIsNone(self.order.assigned_waiter_id)

        self.client.force_authenticate(user=self.waiter_a)
        response = self.client.get('/api/orders/waiter/')
        results = response.data if isinstance(response.data, list) else response.data['results']
        ids = [o['id'] for o in results]
        self.assertIn(self.order.id, ids)

    def test_delivered_at_set_on_delivery(self):
        self.client.force_authenticate(user=self.waiter_a)
        self.client.post(f'/api/orders/{self.order.id}/approve/')
        self.client.patch(f'/api/orders/waiter/{self.order.id}/status/', {'status': 'preparing'}, format='json')
        self.client.patch(f'/api/orders/waiter/{self.order.id}/status/', {'status': 'ready'}, format='json')
        self.client.patch(f'/api/orders/waiter/{self.order.id}/status/', {'status': 'delivered'}, format='json')
        self.order.refresh_from_db()
        self.assertIsNotNone(self.order.delivered_at)


class StaffPerformanceReportTestCase(APITestCase):
    def setUp(self):
        from apps.accounts.models import WaiterPermission

        self.customer = User.objects.create_user(phone='+989120000020', full_name='مشتری')
        self.waiter = User.objects.create_user(phone='+989120000021', full_name='گارسون گزارش')
        self.waiter.role = User.Role.WAITER
        self.waiter.save(update_fields=['role'])
        WaiterPermission.objects.create(user=self.waiter, can_manage_orders=True)

        self.admin = User.objects.create_user(phone='+989120000022', full_name='ادمین تست')
        self.admin.is_staff = True
        self.admin.save(update_fields=['is_staff'])

        self.order = Order.objects.create(
            user=self.customer,
            delivery_type=Order.DeliveryType.TAKEAWAY,
            payment_method=Order.PaymentMethod.CASH,
            status=Order.Status.PENDING_CONFIRMATION,
            final_price=150000,
        )
        self.client.force_authenticate(user=self.waiter)
        self.client.post(f'/api/orders/{self.order.id}/approve/')
        self.client.post(f'/api/orders/{self.order.id}/confirm-cash/')

    def test_report_counts_approved_order_and_cash_sum(self):
        today = timezone.localdate().isoformat()
        self.client.force_authenticate(user=self.admin)
        response = self.client.get('/api/staff-activity/report/', {'from': today, 'to': today})
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        row = next(r for r in response.data if r['waiter_id'] == self.waiter.id)
        self.assertEqual(row['approved_count'], 1)
        self.assertEqual(row['cash_collected'], 150000)

    def test_report_requires_admin(self):
        self.client.force_authenticate(user=self.waiter)
        today = timezone.localdate().isoformat()
        response = self.client.get('/api/staff-activity/report/', {'from': today, 'to': today})
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

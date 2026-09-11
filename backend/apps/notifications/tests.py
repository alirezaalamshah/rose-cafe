from unittest.mock import patch
from django.test import TestCase
from rest_framework.test import APITestCase
from rest_framework import status

from apps.accounts.models import User, WaiterPermission
from .models import PushSubscription
from .push import get_notification_recipients, notify_new_order, notify_new_reservation


class PushSubscriptionAPITestCase(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(phone='+989120000001', full_name='کاربر تست')
        self.client.force_authenticate(user=self.user)

    def test_subscribe_creates_record(self):
        response = self.client.post('/api/notifications/push/subscribe/', {
            'endpoint': 'https://fcm.googleapis.com/fcm/send/abc123',
            'keys': {'p256dh': 'p256dh-key', 'auth': 'auth-key'},
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(PushSubscription.objects.count(), 1)
        self.assertEqual(PushSubscription.objects.first().user, self.user)

    def test_subscribe_same_endpoint_updates_not_duplicates(self):
        payload = {
            'endpoint': 'https://fcm.googleapis.com/fcm/send/abc123',
            'keys': {'p256dh': 'key1', 'auth': 'auth1'},
        }
        self.client.post('/api/notifications/push/subscribe/', payload, format='json')
        payload['keys']['p256dh'] = 'key2'
        self.client.post('/api/notifications/push/subscribe/', payload, format='json')
        self.assertEqual(PushSubscription.objects.count(), 1)
        self.assertEqual(PushSubscription.objects.first().p256dh, 'key2')

    def test_subscribe_rejects_incomplete_payload(self):
        response = self.client.post(
            '/api/notifications/push/subscribe/', {'endpoint': 'https://x.com'}, format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_unsubscribe_removes_record(self):
        PushSubscription.objects.create(
            user=self.user, endpoint='https://fcm.googleapis.com/fcm/send/abc123',
            p256dh='k', auth='a',
        )
        response = self.client.post(
            '/api/notifications/push/unsubscribe/',
            {'endpoint': 'https://fcm.googleapis.com/fcm/send/abc123'}, format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(PushSubscription.objects.count(), 0)

    def test_vapid_public_key_endpoint(self):
        response = self.client.get('/api/notifications/push/vapid-public-key/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('publicKey', response.data)

    def test_requires_authentication(self):
        self.client.force_authenticate(user=None)
        response = self.client.get('/api/notifications/push/vapid-public-key/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class NotificationRecipientsTestCase(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user(phone='+989120000010', full_name='ادمین')
        self.admin.is_staff = True
        self.admin.save(update_fields=['is_staff'])

        self.waiter_with_perm = User.objects.create_user(phone='+989120000011', full_name='گارسون فعال')
        self.waiter_with_perm.role = User.Role.WAITER
        self.waiter_with_perm.save(update_fields=['role'])
        WaiterPermission.objects.create(
            user=self.waiter_with_perm, can_manage_orders=True, can_manage_reservations=False,
        )

        self.waiter_without_perm = User.objects.create_user(phone='+989120000012', full_name='گارسون غیرفعال')
        self.waiter_without_perm.role = User.Role.WAITER
        self.waiter_without_perm.save(update_fields=['role'])
        WaiterPermission.objects.create(
            user=self.waiter_without_perm, can_manage_orders=False, can_manage_reservations=False,
        )

    def test_admin_always_included(self):
        self.assertIn(self.admin, get_notification_recipients('can_manage_orders'))

    def test_waiter_with_permission_included(self):
        self.assertIn(self.waiter_with_perm, get_notification_recipients('can_manage_orders'))

    def test_waiter_without_permission_excluded(self):
        self.assertNotIn(self.waiter_without_perm, get_notification_recipients('can_manage_orders'))

    def test_different_permission_field(self):
        recipients = get_notification_recipients('can_manage_reservations')
        self.assertIn(self.admin, recipients)
        self.assertNotIn(self.waiter_with_perm, recipients)


class PendingBadgeCountTestCase(APITestCase):
    def setUp(self):
        from apps.orders.models import Order
        from apps.reservations.models import Table, Reservation

        self.admin = User.objects.create_user(phone='+989120000020', full_name='ادمین')
        self.admin.is_staff = True
        self.admin.save(update_fields=['is_staff'])

        self.waiter_orders_only = User.objects.create_user(phone='+989120000021', full_name='گارسون سفارش')
        self.waiter_orders_only.role = User.Role.WAITER
        self.waiter_orders_only.save(update_fields=['role'])
        WaiterPermission.objects.create(
            user=self.waiter_orders_only, can_manage_orders=True, can_manage_reservations=False,
        )

        customer = User.objects.create_user(phone='+989120000022', full_name='مشتری')
        Order.objects.create(
            user=customer, delivery_type=Order.DeliveryType.TAKEAWAY,
            payment_method=Order.PaymentMethod.CASH, status=Order.Status.PENDING_CONFIRMATION,
            final_price=100000,
        )
        Order.objects.create(
            user=customer, delivery_type=Order.DeliveryType.TAKEAWAY,
            payment_method=Order.PaymentMethod.CASH, status=Order.Status.PAID,
            final_price=100000,
        )

        from datetime import time
        from django.utils import timezone
        from apps.business.models import BusinessHours
        for day in range(7):
            BusinessHours.objects.update_or_create(
                day_of_week=day,
                defaults={'is_open': True, 'open_time': time(0, 0), 'close_time': time(23, 59)},
            )
        table = Table.objects.create(number=1, capacity=4, is_active=True)
        Reservation.objects.create(
            user=customer, table=table, status=Reservation.Status.PENDING,
            date=timezone.localdate(), guests_count=2, start_time=time(12, 0), end_time=time(13, 0),
        )

    def test_admin_sees_both_orders_and_reservations(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get('/api/notifications/badge-count/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 2)  # ۱ سفارش pending + ۱ رزرو pending

    def test_waiter_with_orders_only_permission(self):
        self.client.force_authenticate(user=self.waiter_orders_only)
        response = self.client.get('/api/notifications/badge-count/')
        self.assertEqual(response.data['count'], 1)  # فقط سفارش، نه رزرو

    def test_requires_authentication(self):
        self.client.force_authenticate(user=None)
        response = self.client.get('/api/notifications/badge-count/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class NotifyMessageContentTestCase(TestCase):
    """متن پیام‌های Push باید شامل جزئیات کافی (میز/نوع تحویل/نام مشتری) باشد تا
    خودِ نوتیفیکیشن گوشی، بدون باز کردن اپ، قابل‌فهم باشد."""

    def setUp(self):
        from datetime import time
        from apps.business.models import BusinessHours
        from apps.reservations.models import Table
        for day in range(7):
            BusinessHours.objects.update_or_create(
                day_of_week=day,
                defaults={'is_open': True, 'open_time': time(0, 0), 'close_time': time(23, 59)},
            )
        self.admin = User.objects.create_user(phone='+989120000030', full_name='ادمین')
        self.admin.is_staff = True
        self.admin.save(update_fields=['is_staff'])
        self.customer = User.objects.create_user(phone='+989120000031', full_name='رضا احمدی')
        self.table = Table.objects.create(number=7, capacity=4, is_active=True)

    @patch('apps.notifications.push.send_push_to_users')
    def test_new_order_message_includes_table_and_customer_name(self, mock_send):
        from apps.orders.models import Order
        order = Order.objects.create(
            user=self.customer, table=self.table, delivery_type=Order.DeliveryType.DINE_IN,
            payment_method=Order.PaymentMethod.CASH, status=Order.Status.PENDING_CONFIRMATION,
            final_price=100000,
        )
        notify_new_order(order)
        bodies = [call.args[2] for call in mock_send.call_args_list]
        self.assertTrue(any('میز 7' in b and 'رضا احمدی' in b for b in bodies))

    @patch('apps.notifications.push.send_push_to_users')
    def test_new_reservation_message_includes_table_and_customer_name(self, mock_send):
        from datetime import time
        from django.utils import timezone
        from apps.reservations.models import Reservation
        reservation = Reservation.objects.create(
            user=self.customer, table=self.table, guests_count=2,
            date=timezone.localdate(), start_time=time(12, 0), end_time=time(13, 0),
        )
        notify_new_reservation(reservation)
        bodies = [call.args[2] for call in mock_send.call_args_list]
        self.assertTrue(any('میز 7' in b and 'رضا احمدی' in b for b in bodies))

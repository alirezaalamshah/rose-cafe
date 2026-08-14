from django.test import TestCase
from rest_framework.test import APITestCase
from rest_framework import status

from apps.accounts.models import User, WaiterPermission
from .models import PushSubscription
from .push import get_notification_recipients


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

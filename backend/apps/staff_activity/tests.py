from django.utils import timezone
from rest_framework.test import APITestCase
from rest_framework import status

from apps.accounts.models import User, WaiterPermission


class MyPerformanceViewTestCase(APITestCase):
    """گزارش عملکرد شخصی: فقط سرپرست سالنِ دارای can_view_own_performance."""

    def setUp(self):
        self.waiter = User.objects.create_user(phone='+989120000051', full_name='سرپرست تست')
        self.waiter.role = User.Role.WAITER
        self.waiter.save(update_fields=['role'])
        WaiterPermission.objects.create(user=self.waiter, can_view_own_performance=True)

        self.waiter_no_perm = User.objects.create_user(phone='+989120000052', full_name='سرپرست بدون دسترسی')
        self.waiter_no_perm.role = User.Role.WAITER
        self.waiter_no_perm.save(update_fields=['role'])
        WaiterPermission.objects.create(user=self.waiter_no_perm, can_view_own_performance=False)

        self.today = timezone.localdate().isoformat()

    def test_waiter_with_permission_sees_own_stats(self):
        self.client.force_authenticate(user=self.waiter)
        response = self.client.get('/api/staff-activity/my-performance/', {'from': self.today, 'to': self.today})
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(response.data['waiter_id'], self.waiter.id)

    def test_waiter_without_permission_forbidden(self):
        self.client.force_authenticate(user=self.waiter_no_perm)
        response = self.client.get('/api/staff-activity/my-performance/', {'from': self.today, 'to': self.today})
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_missing_date_params(self):
        self.client.force_authenticate(user=self.waiter)
        response = self.client.get('/api/staff-activity/my-performance/')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

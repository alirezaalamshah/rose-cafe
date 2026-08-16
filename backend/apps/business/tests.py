from rest_framework.test import APITestCase
from rest_framework import status

from apps.accounts.models import User, WaiterPermission
from apps.staff_activity.models import StaffActionLog
from .models import SpecialDay


class ForceCloseCafeTestCase(APITestCase):
    """بستن فوری کافه: ادمین همیشه، سرپرست سالن فقط با can_force_close_cafe."""

    def setUp(self):
        self.admin = User.objects.create_user(phone='+989120000041', full_name='ادمین تست')
        self.admin.is_staff = True
        self.admin.save(update_fields=['is_staff'])

        self.waiter = User.objects.create_user(phone='+989120000042', full_name='سرپرست تست')
        self.waiter.role = User.Role.WAITER
        self.waiter.save(update_fields=['role'])
        WaiterPermission.objects.create(user=self.waiter, can_force_close_cafe=True)

        self.waiter_no_perm = User.objects.create_user(phone='+989120000043', full_name='سرپرست بدون دسترسی')
        self.waiter_no_perm.role = User.Role.WAITER
        self.waiter_no_perm.save(update_fields=['role'])
        WaiterPermission.objects.create(user=self.waiter_no_perm, can_force_close_cafe=False)

    def test_waiter_with_permission_can_force_close(self):
        self.client.force_authenticate(user=self.waiter)
        response = self.client.post('/api/business/admin/force-close-today/')
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertTrue(SpecialDay.objects.filter(is_closed=True).exists())
        self.assertTrue(
            StaffActionLog.objects.filter(
                user=self.waiter, action=StaffActionLog.Action.CAFE_FORCE_CLOSED,
            ).exists()
        )

    def test_waiter_without_permission_cannot_force_close(self):
        self.client.force_authenticate(user=self.waiter_no_perm)
        response = self.client.post('/api/business/admin/force-close-today/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_can_force_close_and_reopen(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post('/api/business/admin/force-close-today/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        response = self.client.delete('/api/business/admin/force-close-today/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(SpecialDay.objects.filter(is_closed=True).exists())
        self.assertTrue(
            StaffActionLog.objects.filter(
                user=self.admin, action=StaffActionLog.Action.CAFE_REOPENED,
            ).exists()
        )

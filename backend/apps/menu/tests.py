from rest_framework.test import APITestCase
from rest_framework import status

from apps.accounts.models import User, WaiterPermission
from .models import Category, MenuItem, MenuItemVariant, MenuItemAddon


class WaiterMenuAvailabilityTestCase(APITestCase):
    """سرپرست سالن فقط با can_manage_menu_availability می‌تواند موجودی آیتم/تنوع/افزودنی را تغییر دهد."""

    def setUp(self):
        self.category = Category.objects.create(name='نوشیدنی', slug='drinks-test')
        self.item = MenuItem.objects.create(
            category=self.category, name='لاته', slug='latte-test',
            price=100000, status=MenuItem.Status.AVAILABLE,
        )
        self.variant = MenuItemVariant.objects.create(item=self.item, name='بزرگ', price=120000)
        self.addon = MenuItemAddon.objects.create(item=self.item, name='خامه اضافه', price=15000)

        self.waiter = User.objects.create_user(phone='+989120000031', full_name='سرپرست تست')
        self.waiter.role = User.Role.WAITER
        self.waiter.save(update_fields=['role'])
        WaiterPermission.objects.create(user=self.waiter, can_manage_menu_availability=True)

        self.waiter_no_perm = User.objects.create_user(phone='+989120000032', full_name='سرپرست بدون دسترسی')
        self.waiter_no_perm.role = User.Role.WAITER
        self.waiter_no_perm.save(update_fields=['role'])
        WaiterPermission.objects.create(user=self.waiter_no_perm, can_manage_menu_availability=False)

    def test_waiter_with_permission_can_toggle_item(self):
        self.client.force_authenticate(user=self.waiter)
        response = self.client.patch(
            f'/api/menu/waiter/items/{self.item.id}/availability/', {'status': 'unavailable'}, format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.item.refresh_from_db()
        self.assertEqual(self.item.status, MenuItem.Status.UNAVAILABLE)

    def test_waiter_without_permission_cannot_toggle_item(self):
        self.client.force_authenticate(user=self.waiter_no_perm)
        response = self.client.patch(
            f'/api/menu/waiter/items/{self.item.id}/availability/', {'status': 'unavailable'}, format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_waiter_can_toggle_variant(self):
        self.client.force_authenticate(user=self.waiter)
        response = self.client.patch(
            f'/api/menu/waiter/variants/{self.variant.id}/availability/', {'is_available': False}, format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.variant.refresh_from_db()
        self.assertFalse(self.variant.is_available)

    def test_waiter_can_toggle_addon(self):
        self.client.force_authenticate(user=self.waiter)
        response = self.client.patch(
            f'/api/menu/waiter/addons/{self.addon.id}/availability/', {'is_available': False}, format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.addon.refresh_from_db()
        self.assertFalse(self.addon.is_available)

    def test_waiter_cannot_set_coming_soon(self):
        """سرپرست سالن فقط بین موجود/ناموجود سوییچ می‌کند — نه وضعیت «به‌زودی» که تصمیم ادمینه."""
        self.client.force_authenticate(user=self.waiter)
        response = self.client.patch(
            f'/api/menu/waiter/items/{self.item.id}/availability/', {'status': 'coming_soon'}, format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

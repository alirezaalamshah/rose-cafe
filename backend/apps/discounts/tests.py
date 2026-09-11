from unittest.mock import patch
from django.core.cache import cache
from rest_framework.test import APITestCase
from rest_framework import status

from apps.accounts.models import User
from .models import Discount, DiscountUsage, WinBackSettings


class WinBackSettingsTestCase(APITestCase):
    def setUp(self):
        cache.clear()
        self.admin = User.objects.create_user(phone='+989120000091', full_name='ادمین تست')
        self.admin.is_staff = True
        self.admin.save(update_fields=['is_staff'])
        self.client.force_authenticate(user=self.admin)

    def test_get_returns_defaults(self):
        response = self.client.get('/api/discounts/admin/win-back-settings/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['discount_type'], 'percentage')
        self.assertEqual(response.data['value'], 10)
        self.assertEqual(response.data['valid_days'], 14)

    def test_patch_updates_settings(self):
        response = self.client.patch(
            '/api/discounts/admin/win-back-settings/',
            {'discount_type': 'fixed', 'value': 50000, 'valid_days': 7}, format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        settings_obj = WinBackSettings.get_settings()
        self.assertEqual(settings_obj.discount_type, 'fixed')
        self.assertEqual(settings_obj.value, 50000)
        self.assertEqual(settings_obj.valid_days, 7)

    def test_percentage_over_100_rejected(self):
        response = self.client.patch(
            '/api/discounts/admin/win-back-settings/',
            {'discount_type': 'percentage', 'value': 150}, format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_requires_admin(self):
        customer = User.objects.create_user(phone='+989120000092', full_name='مشتری')
        self.client.force_authenticate(user=customer)
        response = self.client.get('/api/discounts/admin/win-back-settings/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class SendWinBackSMSTestCase(APITestCase):
    def setUp(self):
        cache.clear()
        self.admin = User.objects.create_user(phone='+989120000093', full_name='ادمین تست')
        self.admin.is_staff = True
        self.admin.save(update_fields=['is_staff'])
        self.customer = User.objects.create_user(phone='+989120000094', full_name='مشتری در معرض ریزش')
        self.client.force_authenticate(user=self.admin)

    @patch('apps.discounts.views.send_win_back_discount_sms')
    def test_creates_single_use_discount_and_sends_sms(self, mock_sms):
        mock_sms.return_value = True
        response = self.client.post(f'/api/discounts/admin/win-back/{self.customer.id}/send/')
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertTrue(response.data['sent'])

        code = response.data['code']
        discount = Discount.objects.get(code=code)
        self.assertEqual(discount.discount_type, 'percentage')
        self.assertEqual(discount.value, 10)
        self.assertEqual(discount.usage_limit, 1)
        self.assertIn(self.customer, discount.users.all())

        mock_sms.assert_called_once_with(str(self.customer.phone), code, 'percentage', 10)

    @patch('apps.discounts.views.send_win_back_discount_sms')
    def test_two_sends_create_two_distinct_codes(self, mock_sms):
        mock_sms.return_value = True
        res1 = self.client.post(f'/api/discounts/admin/win-back/{self.customer.id}/send/')
        res2 = self.client.post(f'/api/discounts/admin/win-back/{self.customer.id}/send/')
        self.assertNotEqual(res1.data['code'], res2.data['code'])
        self.assertEqual(Discount.objects.filter(users=self.customer).count(), 2)

    @patch('apps.discounts.views.send_win_back_discount_sms')
    def test_reports_sms_failure(self, mock_sms):
        mock_sms.return_value = False
        response = self.client.post(f'/api/discounts/admin/win-back/{self.customer.id}/send/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data['sent'])
        # کد تخفیف با این حال ساخته شده — فقط ارسال پیامک ناموفق بوده
        self.assertTrue(Discount.objects.filter(code=response.data['code']).exists())

    def test_unknown_customer_404(self):
        response = self.client.post('/api/discounts/admin/win-back/999999/send/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_requires_admin(self):
        self.client.force_authenticate(user=self.customer)
        response = self.client.post(f'/api/discounts/admin/win-back/{self.customer.id}/send/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

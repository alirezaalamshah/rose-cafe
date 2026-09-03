from datetime import time
from django.core.cache import cache
from rest_framework.test import APITestCase
from rest_framework import status

from apps.accounts.models import User
from apps.business.models import BusinessHours
from apps.orders.models import Order
from .models import Wallet, WalletTransaction, LoyaltySettings
from .services import get_or_create_wallet, credit, debit, InsufficientBalanceError, credit_order_cashback


class WalletServiceTestCase(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(phone='+989120000061', full_name='مشتری تست')

    def test_credit_creates_wallet_and_transaction(self):
        wallet = credit(self.user, 50000, WalletTransaction.Type.TOPUP, description='شارژ تست')
        self.assertEqual(wallet.balance, 50000)
        tx = wallet.transactions.first()
        self.assertEqual(tx.amount, 50000)
        self.assertEqual(tx.balance_after, 50000)

    def test_debit_reduces_balance(self):
        credit(self.user, 100000, WalletTransaction.Type.TOPUP)
        wallet = debit(self.user, 40000, WalletTransaction.Type.ORDER_PAYMENT)
        self.assertEqual(wallet.balance, 60000)
        tx = wallet.transactions.first()
        self.assertEqual(tx.amount, -40000)

    def test_debit_insufficient_balance_raises(self):
        credit(self.user, 10000, WalletTransaction.Type.TOPUP)
        with self.assertRaises(InsufficientBalanceError):
            debit(self.user, 20000, WalletTransaction.Type.ORDER_PAYMENT)
        # موجودی نباید تغییر کرده باشد
        wallet = get_or_create_wallet(self.user)
        self.assertEqual(wallet.balance, 10000)


class LoyaltyCashbackTestCase(APITestCase):
    def setUp(self):
        # CachedSingletonModel از cache فرآیندی (نه تراکنش DB) استفاده می‌کند — rollback خودکار
        # هر تست روی DB اثر می‌گذارد ولی cache را پاک نمی‌کند، پس بین تست‌ها دستی پاک می‌شود
        cache.clear()
        self.user = User.objects.create_user(phone='+989120000062', full_name='مشتری تست ۲')
        self.order = Order.objects.create(
            user=self.user, delivery_type=Order.DeliveryType.TAKEAWAY,
            payment_method=Order.PaymentMethod.CASH, final_price=100000,
        )

    def test_cashback_not_applied_when_disabled(self):
        LoyaltySettings.get_settings()  # ensure exists, defaults disabled
        credit_order_cashback(self.order)
        self.assertFalse(Wallet.objects.filter(user=self.user).exists())

    def test_cashback_applied_when_enabled(self):
        settings_obj = LoyaltySettings.get_settings()
        settings_obj.is_enabled = True
        settings_obj.cashback_percentage = 10
        settings_obj.save()

        credit_order_cashback(self.order)
        wallet = get_or_create_wallet(self.user)
        self.assertEqual(wallet.balance, 10000)  # 10% of 100000
        tx = wallet.transactions.first()
        self.assertEqual(tx.type, WalletTransaction.Type.CASHBACK)
        self.assertEqual(tx.order_id, self.order.id)

    def test_cashback_skipped_below_min_order_amount(self):
        settings_obj = LoyaltySettings.get_settings()
        settings_obj.is_enabled = True
        settings_obj.cashback_percentage = 10
        settings_obj.min_order_amount = 200000
        settings_obj.save()

        credit_order_cashback(self.order)
        self.assertFalse(Wallet.objects.filter(user=self.user).exists())


class WalletOrderPaymentTestCase(APITestCase):
    """پرداخت سفارش با کیف‌پول از طریق OrderCreateView"""

    def setUp(self):
        self.user = User.objects.create_user(phone='+989120000063', full_name='مشتری تست ۳')
        self.client.force_authenticate(user=self.user)

        for day in range(7):
            BusinessHours.objects.update_or_create(
                day_of_week=day,
                defaults={'is_open': True, 'open_time': time(0, 0), 'close_time': time(23, 59)},
            )

        from apps.menu.models import Category, MenuItem
        self.category = Category.objects.create(name='دسته تست')
        self.item = MenuItem.objects.create(
            category=self.category, name='آیتم تست', price=50000, status=MenuItem.Status.AVAILABLE,
        )

    def test_order_with_insufficient_wallet_balance_rejected_and_rolled_back(self):
        order_count_before = Order.objects.count()
        response = self.client.post('/api/orders/', {
            'items': [{'menu_item': self.item.id, 'quantity': 1}],
            'delivery_type': 'takeaway',
            'payment_method': 'wallet',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Order.objects.count(), order_count_before)  # rollback واقعی انجام شده

    def test_order_with_sufficient_wallet_balance_succeeds(self):
        credit(self.user, 100000, WalletTransaction.Type.TOPUP)
        response = self.client.post('/api/orders/', {
            'items': [{'menu_item': self.item.id, 'quantity': 1}],
            'delivery_type': 'takeaway',
            'payment_method': 'wallet',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertTrue(response.data['is_paid'])
        self.assertEqual(response.data['status'], 'pending_confirmation')

        wallet = get_or_create_wallet(self.user)
        self.assertEqual(wallet.balance, 50000)  # 100000 - 50000
        tx = wallet.transactions.first()
        self.assertEqual(tx.type, WalletTransaction.Type.ORDER_PAYMENT)
        self.assertEqual(tx.amount, -50000)


class AdminLoyaltySettingsViewTestCase(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(phone='+989120000064', full_name='ادمین تست')
        self.admin.is_staff = True
        self.admin.save(update_fields=['is_staff'])

    def test_admin_can_update_loyalty_settings(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.patch('/api/wallet/admin/loyalty-settings/', {
            'is_enabled': True, 'cashback_percentage': 5,
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        settings_obj = LoyaltySettings.get_settings()
        self.assertTrue(settings_obj.is_enabled)
        self.assertEqual(settings_obj.cashback_percentage, 5)

    def test_non_admin_forbidden(self):
        user = User.objects.create_user(phone='+989120000065', full_name='کاربر عادی')
        self.client.force_authenticate(user=user)
        response = self.client.get('/api/wallet/admin/loyalty-settings/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

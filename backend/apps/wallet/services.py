"""منطق مرکزی تغییر موجودی کیف‌پول — همیشه از این توابع استفاده شود، هیچ‌وقت
Wallet.balance مستقیم مقداردهی نشود (تا دفتر تراکنش‌ها همیشه با موجودی واقعی همخوان بماند)."""
from django.db import transaction

from .models import Wallet, WalletTransaction, LoyaltySettings


class InsufficientBalanceError(Exception):
    pass


def get_or_create_wallet(user):
    wallet, _ = Wallet.objects.get_or_create(user=user)
    return wallet


@transaction.atomic
def credit(user, amount, tx_type, order=None, description=''):
    """واریز به کیف‌پول. amount باید مثبت باشد."""
    if amount <= 0:
        raise ValueError('مبلغ واریز باید مثبت باشد')

    wallet = Wallet.objects.select_for_update().get_or_create(user=user)[0]
    wallet.balance += amount
    wallet.save(update_fields=['balance', 'updated_at'])

    WalletTransaction.objects.create(
        wallet=wallet, type=tx_type, amount=amount,
        balance_after=wallet.balance, order=order, description=description,
    )
    return wallet


@transaction.atomic
def debit(user, amount, tx_type, order=None, description=''):
    """برداشت از کیف‌پول. amount باید مثبت باشد؛ اگر موجودی کافی نباشد خطا می‌دهد."""
    if amount <= 0:
        raise ValueError('مبلغ برداشت باید مثبت باشد')

    wallet = Wallet.objects.select_for_update().get_or_create(user=user)[0]
    if wallet.balance < amount:
        raise InsufficientBalanceError('موجودی کیف‌پول کافی نیست')

    wallet.balance -= amount
    wallet.save(update_fields=['balance', 'updated_at'])

    WalletTransaction.objects.create(
        wallet=wallet, type=tx_type, amount=-amount,
        balance_after=wallet.balance, order=order, description=description,
    )
    return wallet


def credit_order_cashback(order):
    """بعد از تکمیل (تحویل) یک سفارش صدا زده می‌شود. اگر باشگاه مشتریان فعال باشد
    و سفارش واجد شرایط باشد، درصد تنظیم‌شده را به کیف‌پول مشتری برمی‌گرداند.
    idempotent نیست به‌خودی‌خود — فراخوان (views.py) مسئول اطمینان از فراخوانی
    فقط یک‌بار به‌ازای هر سفارش است (همان الگوی موجود «not order.delivered_at»)."""
    settings_obj = LoyaltySettings.get_settings()
    if not settings_obj.is_enabled or settings_obj.cashback_percentage <= 0:
        return None
    if order.final_price < settings_obj.min_order_amount:
        return None

    amount = order.final_price * settings_obj.cashback_percentage // 100
    if amount <= 0:
        return None

    return credit(
        order.user, amount, WalletTransaction.Type.CASHBACK, order=order,
        description=f'بازگشت وجه {settings_obj.cashback_percentage}٪ سفارش #{order.order_number}',
    )

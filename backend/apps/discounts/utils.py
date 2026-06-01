from django.utils import timezone
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from apps.accounts.models import User


def apply_discount(code: str, order_total: int, user: 'User') -> dict:
    from .models import Discount, DiscountUsage

    try:
        discount = Discount.objects.get(code__iexact=code, is_active=True)
    except Discount.DoesNotExist:
        return {'valid': False, 'message': 'کد تخفیف نامعتبر است'}

    now = timezone.now()
    if not (discount.valid_from <= now <= discount.valid_until):
        return {'valid': False, 'message': 'کد تخفیف منقضی شده است'}

    if discount.usage_limit and discount.used_count >= discount.usage_limit:
        return {'valid': False, 'message': 'ظرفیت کد تخفیف تکمیل شده است'}

    if order_total < discount.min_order_amount:
        return {
            'valid': False,
            'message': f'حداقل مبلغ سفارش برای این کد {discount.min_order_amount:,} تومان است'
        }

    if discount.users.exists() and not discount.users.filter(id=user.id).exists():
        return {'valid': False, 'message': 'این کد تخفیف برای شما معتبر نیست'}

    if DiscountUsage.objects.filter(discount=discount, user=user).exists():
        return {'valid': False, 'message': 'شما قبلاً از این کد استفاده کرده‌اید'}

    # محاسبه مبلغ تخفیف
    if discount.discount_type == Discount.DiscountType.PERCENTAGE:
        amount = int(order_total * discount.value / 100)
        if discount.max_discount_amount:
            amount = min(amount, discount.max_discount_amount)
    else:
        amount = min(discount.value, order_total)

    return {
        'valid': True,
        'discount_amount': amount,
        'message': f'کد تخفیف اعمال شد - {amount:,} تومان تخفیف',
        'discount': discount,
    }
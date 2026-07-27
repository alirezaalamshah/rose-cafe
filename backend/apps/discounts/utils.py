from datetime import date, timedelta
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
    today = date.today()

    if discount.is_birthday_type:
        # User must have birthday set
        if not user.birthday:
            return {'valid': False, 'message': 'تاریخ تولد شما ثبت نشده است'}

        # 30 days since registration
        days_since_joined = (now - user.date_joined).days
        if days_since_joined < 30:
            return {'valid': False, 'message': 'حداقل ۳۰ روز از تاریخ عضویت شما باید گذشته باشد'}

        # Check birthday window: ±3 days around birthday (same month/day, current year)
        bday = user.birthday
        try:
            this_year_bday = date(today.year, bday.month, bday.day)
        except ValueError:
            # Feb 29 on non-leap year → Feb 28
            this_year_bday = date(today.year, bday.month, 28)

        window_start = this_year_bday - timedelta(days=3)
        window_end = this_year_bday + timedelta(days=3)

        if not (window_start <= today <= window_end):
            return {'valid': False, 'message': 'کد تولد فقط در بازه ۷ روزه اطراف تاریخ تولد شما معتبر است'}

        # Check not already used this year
        current_year = today.year
        if DiscountUsage.objects.filter(discount=discount, user=user, used_year=current_year).exists():
            return {'valid': False, 'message': 'شما امسال از تخفیف تولد استفاده کرده‌اید'}

    else:
        # Regular discount: validate date range
        if not (discount.valid_from <= now <= discount.valid_until):
            return {'valid': False, 'message': 'کد تخفیف منقضی شده است'}

        # Check already used
        if DiscountUsage.objects.filter(discount=discount, user=user).exists():
            return {'valid': False, 'message': 'شما قبلاً از این کد استفاده کرده‌اید'}

    if discount.usage_limit and discount.used_count >= discount.usage_limit:
        return {'valid': False, 'message': 'ظرفیت کد تخفیف تکمیل شده است'}

    if order_total < discount.min_order_amount:
        return {
            'valid': False,
            'message': f'حداقل مبلغ سفارش برای این کد {discount.min_order_amount:,} تومان است'
        }

    if discount.users.exists() and not discount.users.filter(id=user.id).exists():
        return {'valid': False, 'message': 'این کد تخفیف برای شما معتبر نیست'}

    # Calculate discount amount
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
        'used_year': today.year if discount.is_birthday_type else None,
    }

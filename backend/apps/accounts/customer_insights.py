"""
منطق مشترک «آمار مشتری» — بین لیست کاربران (نشان دادن برچسب سطح)، صفحه‌ی جزئیات
مشتری، و لیست «در معرض ریزش» به‌کار می‌رود؛ تا تعریف «مشتری واقعی/VIP/چند روز
بی‌فعالیتی» یک‌جا و یکسان بماند، نه در چند کپی جداگانه.
"""
from django.db.models import Sum, Count, Max, Q

# آستانه‌های سطح‌بندی — فعلاً ثابت (نه قابل تنظیم از پنل)، بر اساس مقیاس یک کافه‌ی
# تکی تخمین زده شده؛ اگر لازم شد بعداً می‌تواند به یک تنظیمات ادمین تبدیل شود
VIP_MIN_SPENT = 3_000_000
VIP_MIN_ORDERS = 10
REGULAR_MIN_ORDERS = 2

# برای «در معرض ریزش»: حداقل این تعداد سفارش واقعی داشته (یعنی واقعاً مشتری بوده،
# نه یک‌بار امتحان‌کننده) و آخرین سفارشش حداقل این تعداد روز پیش بوده باشد
CHURN_MIN_ORDERS = 2
CHURN_INACTIVE_DAYS = 21


def _real_order_filter():
    from apps.orders.models import Order
    return Q(orders__is_paid=True) & ~Q(orders__status__in=[Order.Status.CANCELLED, Order.Status.REJECTED])


def annotate_customer_stats(queryset):
    """به‌ازای هر User در queryset، چهار فیلد اضافه می‌کند: orders_count، total_spent،
    last_order_at (فقط بر اساس سفارش‌های واقعاً پرداخت‌شده و لغو/ردنشده)، و wallet_balance.
    wallet_balance هم با Max (نه دسترسی مستقیم) می‌آید — چون در همین annotate با aggregateهای
    روی رابطه‌ی orders (یک‌به‌چند) ترکیب می‌شود؛ Max از یک OneToOne همیشه همان تک‌مقدار
    (یا NULL اگر کاربر هنوز Wallet نداشته) را برمی‌گرداند، بدون ریسک fan-out بین دو join."""
    real_q = _real_order_filter()
    return queryset.annotate(
        orders_count=Count('orders', filter=real_q, distinct=True),
        total_spent=Sum('orders__final_price', filter=real_q),
        last_order_at=Max('orders__created_at', filter=real_q),
        wallet_balance=Max('wallet__balance'),
    )


def tier_for(orders_count, total_spent):
    total_spent = total_spent or 0
    orders_count = orders_count or 0
    if orders_count >= VIP_MIN_ORDERS or total_spent >= VIP_MIN_SPENT:
        return 'vip'
    if orders_count >= REGULAR_MIN_ORDERS:
        return 'regular'
    return 'new'


TIER_LABELS = {
    'vip': 'ویژه (VIP)',
    'regular': 'عادی',
    'new': 'جدید',
}

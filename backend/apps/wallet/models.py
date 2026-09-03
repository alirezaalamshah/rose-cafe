from django.db import models
from apps.accounts.models import User
from apps.business.models import CachedSingletonModel


class Wallet(models.Model):
    """موجودی کیف‌پول هر کاربر. مقدار همیشه از طریق WalletTransaction تغییر می‌کند،
    هیچ‌وقت مستقیم مقداردهی نشود — تا دفتر تراکنش‌ها همیشه با موجودی واقعی همخوان بماند."""
    user = models.OneToOneField(
        User, on_delete=models.CASCADE,
        related_name='wallet', verbose_name='کاربر',
    )
    balance = models.PositiveIntegerField(default=0, verbose_name='موجودی (تومان)')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'کیف پول'
        verbose_name_plural = 'کیف پول‌ها'

    def __str__(self):
        return f'کیف پول {self.user} — {self.balance:,} تومان'


class WalletTransaction(models.Model):
    class Type(models.TextChoices):
        TOPUP = 'topup', 'شارژ از درگاه'
        CASHBACK = 'cashback', 'بازگشت وجه سفارش'
        ORDER_PAYMENT = 'order_payment', 'پرداخت سفارش'
        ADMIN_ADJUSTMENT = 'admin_adjustment', 'تنظیم دستی ادمین'

    wallet = models.ForeignKey(
        Wallet, on_delete=models.CASCADE,
        related_name='transactions', verbose_name='کیف پول',
    )
    type = models.CharField(max_length=20, choices=Type.choices, verbose_name='نوع تراکنش')
    # مثبت = واریز، منفی = برداشت
    amount = models.IntegerField(verbose_name='مبلغ (تومان)')
    balance_after = models.PositiveIntegerField(verbose_name='موجودی پس از تراکنش')
    order = models.ForeignKey(
        'orders.Order', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='wallet_transactions', verbose_name='سفارش مرتبط',
    )
    description = models.CharField(max_length=255, blank=True, verbose_name='توضیحات')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='تاریخ')

    class Meta:
        verbose_name = 'تراکنش کیف پول'
        verbose_name_plural = 'تراکنش‌های کیف پول'
        # created_at به‌تنهایی برای مرتب‌سازی کافی نیست — دو تراکنش پشت‌سرهم می‌توانند
        # روی این دقت timestamp برابر شوند؛ id (به‌ترتیب واقعی درج) tiebreaker پایدار است
        ordering = ['-created_at', '-id']

    def __str__(self):
        return f'{self.get_type_display()} — {self.amount:,} تومان'


class WalletTopup(models.Model):
    """شارژ کیف‌پول از طریق درگاه زرین‌پال — مشابه Payment ولی بدون گره‌خوردن به Order."""
    class Status(models.TextChoices):
        INIT = 'init', 'شروع شده'
        PENDING = 'pending', 'در انتظار تأیید درگاه'
        SUCCESS = 'success', 'موفق'
        FAILED = 'failed', 'ناموفق'
        CANCELLED = 'cancelled', 'لغو شده'

    user = models.ForeignKey(
        User, on_delete=models.PROTECT,
        related_name='wallet_topups', verbose_name='کاربر',
    )
    amount = models.PositiveIntegerField(verbose_name='مبلغ (تومان)')
    status = models.CharField(
        max_length=20, choices=Status.choices,
        default=Status.INIT, verbose_name='وضعیت', db_index=True,
    )
    authority = models.CharField(max_length=100, blank=True, verbose_name='کد Authority زرین‌پال')
    ref_id = models.CharField(max_length=100, blank=True, verbose_name='کد پیگیری')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='تاریخ ایجاد')
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'شارژ کیف پول'
        verbose_name_plural = 'شارژهای کیف پول'
        ordering = ['-created_at']

    def __str__(self):
        return f'شارژ #{self.id} - {self.user} - {self.get_status_display()}'


class LoyaltySettings(CachedSingletonModel):
    """تنظیمات باشگاه مشتریان — تک ردیف، از پنل ادمین قابل تغییر."""
    is_enabled = models.BooleanField(default=False, verbose_name='فعال بودن بازگشت وجه')
    cashback_percentage = models.PositiveIntegerField(
        default=0, verbose_name='درصد بازگشت وجه',
        help_text='بعد از تکمیل (تحویل) هر سفارش، این درصد از مبلغ نهایی به کیف‌پول مشتری برمی‌گردد',
    )
    min_order_amount = models.PositiveIntegerField(
        default=0, verbose_name='حداقل مبلغ سفارش برای بازگشت وجه',
    )

    class Meta:
        verbose_name = 'تنظیمات باشگاه مشتریان'
        verbose_name_plural = 'تنظیمات باشگاه مشتریان'

    def __str__(self):
        return 'تنظیمات باشگاه مشتریان'

    @classmethod
    def get_settings(cls):
        return cls._get_or_create_cached({})

from django.db import models
from apps.accounts.models import User
from apps.business.models import CachedSingletonModel


class Discount(models.Model):
    class DiscountType(models.TextChoices):
        PERCENTAGE = 'percentage', 'درصدی'
        FIXED = 'fixed', 'مبلغ ثابت'

    code = models.CharField(max_length=50, unique=True, verbose_name='کد تخفیف')
    discount_type = models.CharField(
        max_length=20, choices=DiscountType.choices,
        default=DiscountType.PERCENTAGE, verbose_name='نوع تخفیف'
    )
    value = models.PositiveIntegerField(verbose_name='مقدار تخفیف')
    min_order_amount = models.PositiveIntegerField(default=0, verbose_name='حداقل مبلغ سفارش')
    max_discount_amount = models.PositiveIntegerField(
        null=True, blank=True, verbose_name='حداکثر مبلغ تخفیف'
    )
    usage_limit = models.PositiveIntegerField(null=True, blank=True, verbose_name='محدودیت استفاده')
    used_count = models.PositiveIntegerField(default=0, verbose_name='تعداد استفاده')
    is_active = models.BooleanField(default=True, verbose_name='فعال')
    is_birthday_type = models.BooleanField(default=False, verbose_name='تخفیف تولد')
    valid_from = models.DateTimeField(verbose_name='از تاریخ')
    valid_until = models.DateTimeField(verbose_name='تا تاریخ')
    users = models.ManyToManyField(
        User, blank=True,
        related_name='discounts', verbose_name='کاربران مجاز'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'کد تخفیف'
        verbose_name_plural = 'کدهای تخفیف'

    def __str__(self):
        return self.code


class DiscountUsage(models.Model):
    discount = models.ForeignKey(
        Discount, on_delete=models.CASCADE,
        related_name='usages', verbose_name='کد تخفیف'
    )
    user = models.ForeignKey(
        User, on_delete=models.CASCADE,
        related_name='discount_usages', verbose_name='کاربر'
    )
    order_id = models.PositiveIntegerField(verbose_name='شناسه سفارش')
    used_at = models.DateTimeField(auto_now_add=True)
    used_year = models.PositiveIntegerField(null=True, blank=True, verbose_name='سال استفاده')

    class Meta:
        verbose_name = 'استفاده از تخفیف'
        verbose_name_plural = 'استفاده‌های تخفیف'


class WinBackSettings(CachedSingletonModel):
    """تنظیمات پیامک/تخفیف «دلتنگی» برای مشتریان در معرض ریزش — تک ردیف، از پنل
    ادمین قابل تغییر. مقدار تخفیف هر بار که دکمه‌ی ارسال زده می‌شود همین مقدار
    فعلی است (نه چیزی که در لحظه‌ی ساخت کد تخفیف قبلی ثابت شده باشد)."""
    discount_type = models.CharField(
        max_length=20, choices=Discount.DiscountType.choices,
        default=Discount.DiscountType.PERCENTAGE, verbose_name='نوع تخفیف',
    )
    value = models.PositiveIntegerField(default=10, verbose_name='مقدار تخفیف')
    valid_days = models.PositiveSmallIntegerField(
        default=14, verbose_name='مدت اعتبار کد (روز)',
        help_text='از لحظه‌ی ارسال پیامک، کد تخفیف تا چند روز معتبر بماند',
    )

    class Meta:
        verbose_name = 'تنظیمات پیامک دلتنگی'
        verbose_name_plural = 'تنظیمات پیامک دلتنگی'

    def __str__(self):
        return 'تنظیمات پیامک دلتنگی'

    @classmethod
    def get_settings(cls):
        return cls._get_or_create_cached({})
import jdatetime
from django.db import models, transaction
from django.utils import timezone
from apps.accounts.models import User, Address
from apps.menu.models import MenuItem, MenuItemVariant, MenuItemAddon


class DailyOrderCounter(models.Model):
    """
    شمارنده‌ی سفارش برای هر روز شمسی — پایه‌ی ساخت شماره‌ی خوانای سفارش
    (تاریخ شمسی + شماره‌ی ترتیبی همان روز، مثلاً 140505151 برای اولین سفارش 1405/05/15).
    select_for_update در generate_order_number از تکراری شدن شماره در ثبت هم‌زمان دو سفارش جلوگیری می‌کند.
    """
    jalali_date = models.CharField(max_length=8, unique=True, verbose_name='تاریخ شمسی (YYYYMMDD)')
    last_number = models.PositiveIntegerField(default=0, verbose_name='آخرین شماره صادرشده')

    class Meta:
        verbose_name = 'شمارنده روزانه سفارش'
        verbose_name_plural = 'شمارنده‌های روزانه سفارش'

    def __str__(self):
        return f'{self.jalali_date} — {self.last_number} سفارش'


def generate_order_number() -> str:
    # timezone.localdate از TIME_ZONE تنظیم‌شده (آسیا/تهران) استفاده می‌کند، نه ساعت سیستم هاست
    today_jalali = jdatetime.date.fromgregorian(date=timezone.localdate())
    date_prefix = f'{today_jalali.year:04d}{today_jalali.month:02d}{today_jalali.day:02d}'

    # atomic تودرتو: چه این تابع از داخل یک تراکنش دیگر صدا زده شود چه نشود، صحیح کار می‌کند
    with transaction.atomic():
        counter, _ = DailyOrderCounter.objects.select_for_update().get_or_create(
            jalali_date=date_prefix, defaults={'last_number': 0}
        )
        counter.last_number += 1
        counter.save(update_fields=['last_number'])
        return f'{date_prefix}{counter.last_number}'


class Order(models.Model):
    class Status(models.TextChoices):
        WAITING_PAYMENT = 'waiting_payment', 'در انتظار پرداخت'
        PAID = 'paid', 'پرداخت شده — در صف آماده‌سازی'
        PREPARING = 'preparing', 'در حال آماده‌سازی'
        READY = 'ready', 'آماده تحویل'
        DELIVERED = 'delivered', 'تحویل داده شد'
        CANCELLED = 'cancelled', 'لغو شده'

    class DeliveryType(models.TextChoices):
        TAKEAWAY = 'takeaway', 'تحویل در محل (برون‌بر)'
        DELIVERY = 'delivery', 'ارسال با پیک'
        DINE_IN = 'dine_in', 'سرو در کافه'

    class PaymentMethod(models.TextChoices):
        ONLINE = 'online', 'پرداخت آنلاین'
        CASH = 'cash', 'پرداخت در محل'

    user = models.ForeignKey(
        User, on_delete=models.PROTECT,
        related_name='orders', verbose_name='کاربر'
    )
    status = models.CharField(
        max_length=20, choices=Status.choices,
        default=Status.WAITING_PAYMENT, verbose_name='وضعیت', db_index=True
    )
    delivery_type = models.CharField(
        max_length=20, choices=DeliveryType.choices,
        default=DeliveryType.TAKEAWAY, verbose_name='نوع تحویل'
    )
    address = models.ForeignKey(
        Address, on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='orders', verbose_name='آدرس تحویل'
    )
    table = models.ForeignKey(
        'reservations.Table', on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='orders', verbose_name='میز'
    )
    payment_method = models.CharField(
        max_length=10, choices=PaymentMethod.choices,
        default=PaymentMethod.ONLINE, verbose_name='روش پرداخت'
    )
    is_paid = models.BooleanField(default=False, verbose_name='پرداخت شده')
    note = models.TextField(blank=True, verbose_name='توضیحات سفارش')
    total_price = models.PositiveIntegerField(default=0, verbose_name='مبلغ کل')
    delivery_cost = models.PositiveIntegerField(default=0, verbose_name='هزینه ارسال')
    packaging_cost = models.PositiveIntegerField(default=0, verbose_name='هزینه بسته‌بندی')
    discount_amount = models.PositiveIntegerField(default=0, verbose_name='مبلغ تخفیف')
    final_price = models.PositiveIntegerField(default=0, verbose_name='مبلغ نهایی')
    discount_code = models.CharField(max_length=50, blank=True, verbose_name='کد تخفیف')
    order_number = models.CharField(
        max_length=20, unique=True, blank=True, editable=False, db_index=True,
        verbose_name='شماره سفارش',
        help_text='بر اساس تاریخ شمسی روز ثبت + شماره ترتیبی همان روز — خودکار ساخته می‌شود',
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='تاریخ ثبت', db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'سفارش'
        verbose_name_plural = 'سفارش‌ها'
        ordering = ['-created_at']

    def __str__(self):
        return f'سفارش #{self.order_number or self.id} - {self.user}'

    def save(self, *args, **kwargs):
        if not self.order_number:
            self.order_number = generate_order_number()
        super().save(*args, **kwargs)

    def calculate_totals(self):
        self.total_price = sum(
            item.subtotal for item in self.items.all()
        )
        self.final_price = self.total_price + self.delivery_cost + self.packaging_cost - self.discount_amount
        self.save(update_fields=['total_price', 'final_price'])


class OrderItem(models.Model):
    order = models.ForeignKey(
        Order, on_delete=models.CASCADE,
        related_name='items', verbose_name='سفارش'
    )
    menu_item = models.ForeignKey(
        MenuItem, on_delete=models.PROTECT,
        related_name='order_items', verbose_name='آیتم منو'
    )
    variant = models.ForeignKey(
        MenuItemVariant, on_delete=models.SET_NULL,
        null=True, blank=True, verbose_name='نوع'
    )
    variant_name = models.CharField(max_length=100, blank=True, verbose_name='نام نوع')
    quantity = models.PositiveIntegerField(default=1, verbose_name='تعداد')
    unit_price = models.PositiveIntegerField(verbose_name='قیمت واحد')

    class Meta:
        verbose_name = 'آیتم سفارش'
        verbose_name_plural = 'آیتم‌های سفارش'

    def __str__(self):
        return f'{self.menu_item.name} × {self.quantity}'

    @property
    def subtotal(self):
        addons_total = sum(a.price for a in self.addons.all())
        return (self.unit_price + addons_total) * self.quantity


class OrderItemAddon(models.Model):
    """
    افزودنی انتخاب‌شده روی یک ردیف سفارش — نام و قیمت لحظه‌ی سفارش snapshot می‌شود
    (نه ارجاع زنده به MenuItemAddon) تا اگر بعداً قیمت افزودنی تغییر کرد یا حذف شد،
    سفارش‌های قبلی دست‌نخورده بمانند؛ دقیقاً همان الگوی variant_name در OrderItem.
    """
    order_item = models.ForeignKey(
        OrderItem, on_delete=models.CASCADE,
        related_name='addons', verbose_name='آیتم سفارش'
    )
    addon = models.ForeignKey(
        MenuItemAddon, on_delete=models.SET_NULL,
        null=True, blank=True, verbose_name='افزودنی'
    )
    name = models.CharField(max_length=100, verbose_name='نام افزودنی')
    price = models.PositiveIntegerField(verbose_name='قیمت افزودنی')

    class Meta:
        verbose_name = 'افزودنی سفارش'
        verbose_name_plural = 'افزودنی‌های سفارش'

    def __str__(self):
        return f'{self.name} (+{self.price})'
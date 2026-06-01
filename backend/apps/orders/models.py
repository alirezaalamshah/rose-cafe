from django.db import models
from apps.accounts.models import User, Address
from apps.menu.models import MenuItem


class Order(models.Model):
    class Status(models.TextChoices):
        PENDING = 'pending', 'در انتظار پرداخت'
        CONFIRMED = 'confirmed', 'تایید شده'
        PREPARING = 'preparing', 'در حال آماده‌سازی'
        READY = 'ready', 'آماده تحویل'
        DELIVERED = 'delivered', 'تحویل داده شد'
        CANCELLED = 'cancelled', 'لغو شده'

    class DeliveryType(models.TextChoices):
        TAKEAWAY = 'takeaway', 'تحویل در محل'
        DELIVERY = 'delivery', 'ارسال با پیک'

    user = models.ForeignKey(
        User, on_delete=models.PROTECT,
        related_name='orders', verbose_name='کاربر'
    )
    status = models.CharField(
        max_length=20, choices=Status.choices,
        default=Status.PENDING, verbose_name='وضعیت'
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
    note = models.TextField(blank=True, verbose_name='توضیحات سفارش')
    total_price = models.PositiveIntegerField(default=0, verbose_name='مبلغ کل')
    delivery_cost = models.PositiveIntegerField(default=0, verbose_name='هزینه ارسال')
    discount_amount = models.PositiveIntegerField(default=0, verbose_name='مبلغ تخفیف')
    final_price = models.PositiveIntegerField(default=0, verbose_name='مبلغ نهایی')
    discount_code = models.CharField(max_length=50, blank=True, verbose_name='کد تخفیف')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='تاریخ ثبت')
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'سفارش'
        verbose_name_plural = 'سفارش‌ها'
        ordering = ['-created_at']

    def __str__(self):
        return f'سفارش #{self.id} - {self.user}'

    def calculate_totals(self):
        self.total_price = sum(
            item.subtotal for item in self.items.all()
        )
        self.final_price = self.total_price + self.delivery_cost - self.discount_amount
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
    quantity = models.PositiveIntegerField(default=1, verbose_name='تعداد')
    unit_price = models.PositiveIntegerField(verbose_name='قیمت واحد')

    class Meta:
        verbose_name = 'آیتم سفارش'
        verbose_name_plural = 'آیتم‌های سفارش'

    def __str__(self):
        return f'{self.menu_item.name} × {self.quantity}'

    @property
    def subtotal(self):
        return self.unit_price * self.quantity
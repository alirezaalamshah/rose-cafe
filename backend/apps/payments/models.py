from django.db import models
from apps.accounts.models import User
from apps.orders.models import Order


class Payment(models.Model):
    class Status(models.TextChoices):
        INIT = 'init', 'شروع شده'
        PENDING = 'pending', 'در انتظار تأیید درگاه'
        SUCCESS = 'success', 'موفق'
        FAILED = 'failed', 'ناموفق'
        CANCELLED = 'cancelled', 'لغو شده'

    order = models.OneToOneField(
        Order, on_delete=models.PROTECT,
        related_name='payment', verbose_name='سفارش'
    )
    user = models.ForeignKey(
        User, on_delete=models.PROTECT,
        related_name='payments', verbose_name='کاربر'
    )
    amount = models.PositiveIntegerField(verbose_name='مبلغ (تومان)')
    status = models.CharField(
        max_length=20, choices=Status.choices,
        default=Status.INIT, verbose_name='وضعیت', db_index=True
    )
    authority = models.CharField(
        max_length=100, blank=True, verbose_name='کد Authority زرین‌پال'
    )
    ref_id = models.CharField(
        max_length=100, blank=True, verbose_name='کد پیگیری'
    )
    card_pan = models.CharField(
        max_length=20, blank=True, verbose_name='شماره کارت (Mask)'
    )
    card_hash = models.CharField(
        max_length=100, blank=True, verbose_name='هش کارت'
    )
    zarinpal_status = models.IntegerField(
        null=True, blank=True, verbose_name='کد وضعیت زرین‌پال'
    )
    description = models.TextField(blank=True, verbose_name='توضیحات')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='تاریخ ایجاد')
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'پرداخت'
        verbose_name_plural = 'پرداخت‌ها'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['status', 'created_at'], name='payment_status_created_idx'),
        ]

    def __str__(self):
        return f'پرداخت #{self.id} - سفارش #{self.order_id} - {self.get_status_display()}'
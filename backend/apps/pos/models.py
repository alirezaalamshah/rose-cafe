from django.db import models
from django.utils import timezone
from apps.business.models import CachedSingletonModel


class ReceiptSettings(CachedSingletonModel):
    """متن‌های آزاد و غیرمرتبط با داده‌ی سفارش روی فیش چاپی — تک ردیف، از پنل
    ادمین قابل تغییر. بخش‌های وابسته به سفارش (شماره/آیتم‌ها/قیمت‌ها/تاریخ) همیشه
    ثابت‌الگو هستند و اینجا نیستند، چون تصمیم سلیقه‌ای نیستند."""
    header_text = models.CharField(
        max_length=200, blank=True, verbose_name='متن بالای فیش',
        help_text='خالی بماند یعنی فقط نام کافه (از تنظیمات اطلاعات کافه) چاپ شود',
    )
    footer_text = models.CharField(
        max_length=200, default='با تشکر 🌹', verbose_name='متن پایین فیش',
    )
    show_customer_name = models.BooleanField(default=True, verbose_name='نمایش نام مشتری روی فیش')
    show_customer_phone = models.BooleanField(default=False, verbose_name='نمایش شماره تماس مشتری روی فیش')

    class Meta:
        verbose_name = 'تنظیمات فیش چاپی'
        verbose_name_plural = 'تنظیمات فیش چاپی'

    def __str__(self):
        return 'تنظیمات فیش چاپی'

    @classmethod
    def get_settings(cls):
        return cls._get_or_create_cached({})


class PrintJob(models.Model):
    """صف چاپ فیش — هر بار سفارشی به وضعیت «تأیید شده» می‌رسد (چه با تأیید دستی
    پرسنل، چه ثبت حضوری که مستقیم تأیید‌شده ساخته می‌شود)، یک رکورد اینجا اضافه
    می‌شود. Print Agent (برنامه‌ی محلی داخل کافه، خارج از این ریپازیتوری) هر چند
    ثانیه لیست pending را poll و بعد از چاپ موفق ack می‌کند — سرور مستقیم به
    پرینتر دسترسی ندارد چون روی هاست ابری بیرون از کافه است."""
    class Status(models.TextChoices):
        PENDING = 'pending', 'در انتظار چاپ'
        PRINTED = 'printed', 'چاپ شد'

    order = models.OneToOneField(
        'orders.Order', on_delete=models.CASCADE,
        related_name='print_job', verbose_name='سفارش',
    )
    status = models.CharField(
        max_length=10, choices=Status.choices, default=Status.PENDING, verbose_name='وضعیت',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    printed_at = models.DateTimeField(null=True, blank=True, verbose_name='زمان چاپ')

    class Meta:
        verbose_name = 'صف چاپ فیش'
        verbose_name_plural = 'صف چاپ فیش'
        ordering = ['created_at']

    def __str__(self):
        return f'فیش سفارش #{self.order.order_number} — {self.get_status_display()}'

    def mark_printed(self):
        self.status = self.Status.PRINTED
        self.printed_at = timezone.now()
        self.save(update_fields=['status', 'printed_at'])

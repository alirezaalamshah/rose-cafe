import hashlib

from django.db import models
from apps.accounts.models import User


class SMSLog(models.Model):
    class Status(models.TextChoices):
        SENT = 'sent', 'ارسال شد'
        FAILED = 'failed', 'ناموفق'
        SKIPPED = 'skipped', 'غیرفعال (موقتاً خاموش)'

    phone = models.CharField(max_length=20, verbose_name='شماره موبایل')
    message = models.TextField(verbose_name='متن پیام')
    status = models.CharField(
        max_length=10, choices=Status.choices,
        default=Status.SENT, verbose_name='وضعیت'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'لاگ پیامک'
        verbose_name_plural = 'لاگ پیامک‌ها'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.phone} - {self.get_status_display()}'


class PushSubscription(models.Model):
    """
    اشتراک Web Push یک مرورگر/گوشی مشخص برای یک کاربر — هر کاربر می‌تواند چند اشتراک
    (چند گوشی/مرورگر) هم‌زمان داشته باشد. endpoint شناسه‌ی یکتای هر مرورگر/دستگاه است
    که خود مرورگر موقع subscribe شدن می‌سازد.
    """
    user = models.ForeignKey(
        User, on_delete=models.CASCADE,
        related_name='push_subscriptions', verbose_name='کاربر',
    )
    # endpoint واقعی می‌تواند بلند باشد (خصوصاً FCM/Mozilla) — یونیک‌بودنش را مستقیم روی
    # این فیلد ایندکس نمی‌کنیم چون MySQL/MariaDB روی این هاست برای ایندکس یکتای
    # utf8mb4 با طول زیاد خطای «Specified key was too long» می‌دهد (قبلاً برای
    # django_cache_table هم پیش آمد) — به‌جایش هش SHA-256 ثابت‌طولش را ایندکس می‌کنیم
    endpoint = models.URLField(max_length=500, verbose_name='آدرس اشتراک')
    endpoint_hash = models.CharField(max_length=64, unique=True, editable=False, verbose_name='هش آدرس اشتراک')
    p256dh = models.CharField(max_length=255, verbose_name='کلید p256dh')
    auth = models.CharField(max_length=255, verbose_name='کلید auth')
    user_agent = models.CharField(max_length=255, blank=True, verbose_name='مرورگر/دستگاه')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'اشتراک نوتیفیکیشن'
        verbose_name_plural = 'اشتراک‌های نوتیفیکیشن'
        ordering = ['-created_at']

    def save(self, *args, **kwargs):
        self.endpoint_hash = hashlib.sha256(self.endpoint.encode()).hexdigest()
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.user} - {self.user_agent or self.endpoint[:40]}'
from django.db import models
from apps.accounts.models import User


class SMSLog(models.Model):
    class Status(models.TextChoices):
        SENT = 'sent', 'ارسال شد'
        FAILED = 'failed', 'ناموفق'

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
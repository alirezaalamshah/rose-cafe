from django.db import models
from django.core.exceptions import ValidationError
from django.utils import timezone
from apps.accounts.models import User


class Table(models.Model):
    class Location(models.TextChoices):
        INDOOR = 'indoor', 'داخل کافه'
        OUTDOOR = 'outdoor', 'فضای باز'
        VIP = 'vip', 'VIP'

    number = models.PositiveIntegerField(unique=True, verbose_name='شماره میز')
    capacity = models.PositiveIntegerField(verbose_name='ظرفیت')
    location = models.CharField(
        max_length=20, choices=Location.choices,
        default=Location.INDOOR, verbose_name='موقعیت'
    )
    is_active = models.BooleanField(default=True, verbose_name='فعال')
    description = models.CharField(max_length=200, blank=True, verbose_name='توضیحات')

    class Meta:
        verbose_name = 'میز'
        verbose_name_plural = 'میزها'
        ordering = ['number']

    def __str__(self):
        return f'میز {self.number} ({self.capacity} نفره)'


class Reservation(models.Model):
    class Status(models.TextChoices):
        PENDING = 'pending', 'در انتظار تایید'
        CONFIRMED = 'confirmed', 'تایید شده'
        CANCELLED = 'cancelled', 'لغو شده'
        COMPLETED = 'completed', 'انجام شده'
        NO_SHOW = 'no_show', 'حضور نیافت'

    user = models.ForeignKey(
        User, on_delete=models.PROTECT,
        related_name='reservations', verbose_name='کاربر'
    )
    table = models.ForeignKey(
        Table, on_delete=models.PROTECT,
        related_name='reservations', verbose_name='میز'
    )
    date = models.DateField(verbose_name='تاریخ')
    start_time = models.TimeField(verbose_name='ساعت شروع')
    end_time = models.TimeField(verbose_name='ساعت پایان')
    guests_count = models.PositiveIntegerField(verbose_name='تعداد نفرات')
    status = models.CharField(
        max_length=20, choices=Status.choices,
        default=Status.PENDING, verbose_name='وضعیت'
    )
    note = models.TextField(blank=True, verbose_name='توضیحات')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'رزرو'
        verbose_name_plural = 'رزروها'
        ordering = ['-date', '-start_time']

    def __str__(self):
        return f'رزرو {self.user} - میز {self.table.number} - {self.date}'

    def clean(self):
        # بررسی تناقض زمانی
        if self.date and self.start_time and self.end_time:
            if self.start_time >= self.end_time:
                raise ValidationError('ساعت پایان باید بعد از ساعت شروع باشد')

            if self.date < timezone.now().date():
                raise ValidationError('تاریخ رزرو نمیتواند در گذشته باشد')

            conflict = Reservation.objects.filter(
                table=self.table,
                date=self.date,
                status__in=[self.Status.PENDING, self.Status.CONFIRMED],
                start_time__lt=self.end_time,
                end_time__gt=self.start_time,
            ).exclude(pk=self.pk)

            if conflict.exists():
                raise ValidationError('این میز در بازه زمانی انتخابی رزرو شده است')

        if self.table and self.guests_count:
            if self.guests_count > self.table.capacity:
                raise ValidationError(
                    f'ظرفیت میز {self.table.capacity} نفر است'
                )

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)
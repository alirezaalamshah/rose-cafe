from django.db import models
from apps.accounts.models import User


class StaffActionLog(models.Model):
    """
    ثبت هر اکشنی که یک کارمند (گارسون یا ادمین) روی سفارش/رزرو/پول انجام می‌دهد —
    تا ادمین بتواند ببیند کدام کارمند چه‌کاری انجام داده.
    """
    class Action(models.TextChoices):
        ORDER_APPROVED = 'order_approved', 'تأیید سفارش'
        ORDER_REJECTED = 'order_rejected', 'رد سفارش'
        ORDER_STATUS_CHANGED = 'order_status_changed', 'تغییر وضعیت سفارش'
        CASH_COLLECTED = 'cash_collected', 'وصول نقدی'
        RESERVATION_CONFIRMED = 'reservation_confirmed', 'تأیید رزرو'
        RESERVATION_COMPLETED = 'reservation_completed', 'اتمام رزرو'
        RESERVATION_NO_SHOW = 'reservation_no_show', 'عدم حضور مشتری'
        RESERVATION_CANCELLED = 'reservation_cancelled', 'لغو رزرو'

    user = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True,
        related_name='action_logs', verbose_name='کارمند',
    )
    action = models.CharField(max_length=30, choices=Action.choices, verbose_name='نوع اکشن')
    order = models.ForeignKey(
        'orders.Order', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='action_logs', verbose_name='سفارش',
    )
    reservation = models.ForeignKey(
        'reservations.Reservation', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='action_logs', verbose_name='رزرو',
    )
    detail = models.CharField(max_length=255, verbose_name='توضیح')
    created_at = models.DateTimeField(auto_now_add=True, db_index=True, verbose_name='زمان')

    class Meta:
        verbose_name = 'گزارش فعالیت کارمند'
        verbose_name_plural = 'گزارش فعالیت کارکنان'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.user} — {self.get_action_display()} — {self.created_at:%Y-%m-%d %H:%M}'


def log_staff_action(user, action, detail, order=None, reservation=None):
    """کمک‌کننده‌ی ساده برای ثبت یک اکشن — از هر ویویی که کارمند کاری انجام می‌دهد صدا زده می‌شود."""
    StaffActionLog.objects.create(
        user=user, action=action, detail=detail, order=order, reservation=reservation,
    )

from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.orders.models import Order
from apps.notifications.push import notify_unpaid_cash

REMINDER_DELAY_MINUTES = 15


class Command(BaseCommand):
    help = (
        'Push reminder for cash orders delivered more than %d minutes ago but still not '
        'marked as paid. Meant to run periodically via cron (e.g. every 5-10 minutes).'
        % REMINDER_DELAY_MINUTES
    )

    def handle(self, *args, **options):
        threshold = timezone.now() - timedelta(minutes=REMINDER_DELAY_MINUTES)
        orders = Order.objects.filter(
            payment_method=Order.PaymentMethod.CASH,
            is_paid=False,
            status=Order.Status.DELIVERED,
            delivered_at__lte=threshold,
            cash_reminder_sent_at__isnull=True,
        )

        sent_count = 0
        for order in orders:
            notify_unpaid_cash(order)
            order.cash_reminder_sent_at = timezone.now()
            order.save(update_fields=['cash_reminder_sent_at'])
            sent_count += 1

        self.stdout.write(self.style.SUCCESS(f'Sent {sent_count} cash reminder(s)'))

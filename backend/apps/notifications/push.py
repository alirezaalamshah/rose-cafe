import json
import logging
from django.conf import settings
from django.db.models import Q
from pywebpush import webpush, WebPushException

logger = logging.getLogger(__name__)


def _send_to_subscription(subscription, payload: dict) -> bool:
    """
    یک اشتراک واحد را push می‌کند. اگر مرورگر بگوید اشتراک دیگر معتبر نیست (404/410 —
    یعنی کاربر اپ را حذف کرده یا اشتراک منقضی شده)، خودش را از دیتابیس پاک می‌کند تا
    دیگر تلاش بیهوده برایش نشود.
    """
    try:
        webpush(
            subscription_info={
                'endpoint': subscription.endpoint,
                'keys': {'p256dh': subscription.p256dh, 'auth': subscription.auth},
            },
            data=json.dumps(payload),
            vapid_private_key=settings.VAPID_PRIVATE_KEY,
            vapid_claims={'sub': settings.VAPID_ADMIN_EMAIL},
        )
        return True
    except WebPushException as e:
        status_code = e.response.status_code if e.response is not None else None
        if status_code in (404, 410):
            subscription.delete()
        else:
            logger.error(f'Push send failed (status={status_code}): {e}')
        return False


def send_push_to_user(user, title: str, body: str, url: str = '/') -> None:
    if not settings.VAPID_PRIVATE_KEY:
        logger.info(f'[PUSH DISABLED — VAPID not configured] {user}: {title}')
        return
    payload = {'title': title, 'body': body, 'url': url}
    for subscription in list(user.push_subscriptions.all()):
        _send_to_subscription(subscription, payload)


def send_push_to_users(users, title: str, body: str, url: str = '/') -> None:
    for user in users:
        send_push_to_user(user, title, body, url)


def get_notification_recipients(permission_field: str):
    """
    ادمین‌ها (همیشه) + گارسون‌هایی که دسترسی مشخص‌شده (مثلاً can_manage_orders) را دارند.
    """
    from apps.accounts.models import User

    return User.objects.filter(
        Q(is_staff=True)
        | Q(role=User.Role.WAITER, **{f'waiter_permissions__{permission_field}': True})
    ).distinct()


def notify_new_order(order) -> None:
    """
    نوتیفیکیشن Push به ادمین‌ها + گارسون‌های دارای دسترسی مدیریت سفارش — سفارش تازه در
    انتظار تأیید است. لینک هرکدام به صفحه‌ی سفارشات پنل خودشان می‌رود (مسیرها فرق دارند).
    """
    title = 'سفارش جدید'
    body = f'سفارش #{order.order_number} در انتظار تأیید است'
    recipients = list(get_notification_recipients('can_manage_orders'))
    send_push_to_users([u for u in recipients if u.is_staff], title, body, url='/admin/orders')
    send_push_to_users(
        [u for u in recipients if not u.is_staff], title, body,
        url='/waiter/orders?status=pending_confirmation',
    )


def notify_unpaid_cash(order) -> None:
    """
    یادآوری Push به گارسون مسئول سفارش (یا اگر هیچ گارسونی مسئولش نبود، به همه‌ی
    ادمین‌ها/گارسون‌های دارای دسترسی سفارش) — یک سفارش نقدی تحویل‌شده که هنوز وجهش
    وصول ثبت نشده است.
    """
    title = 'یادآوری وصول نقدی'
    body = f'سفارش #{order.order_number} تحویل داده شده ولی وجه نقدش هنوز وصول نشده'
    if order.assigned_waiter_id:
        recipients = [order.assigned_waiter]
    else:
        recipients = list(get_notification_recipients('can_manage_orders'))
    send_push_to_users(
        [u for u in recipients if u.is_staff], title, body, url='/admin/orders',
    )
    send_push_to_users(
        [u for u in recipients if not u.is_staff], title, body, url='/waiter/orders',
    )


def notify_new_reservation(reservation) -> None:
    """نوتیفیکیشن Push به ادمین‌ها + گارسون‌های دارای دسترسی مدیریت رزرو — رزرو تازه ثبت شده است."""
    title = 'رزرو جدید'
    date_str = str(reservation.date)
    time_str = str(reservation.start_time)[:5]
    body = f'رزرو جدید برای {date_str} ساعت {time_str}'
    recipients = list(get_notification_recipients('can_manage_reservations'))
    send_push_to_users([u for u in recipients if u.is_staff], title, body, url='/admin/reservations')
    send_push_to_users([u for u in recipients if not u.is_staff], title, body, url='/waiter/reservations')

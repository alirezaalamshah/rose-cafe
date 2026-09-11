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


def _pending_badge_count_for(user) -> int:
    """همان شمارش pending_badge_count ولی برای فراخوانی داخلی (نه یک درخواست HTTP جدا) —
    تا هر Push خودش عدد فعلی badge کاربر را همراه ببرد و service worker بتواند
    navigator.setAppBadge را حتی وقتی هیچ تبی از اپ باز نیست به‌روز کند."""
    from apps.orders.models import Order
    from apps.reservations.models import Reservation

    perm = getattr(user, 'waiter_permissions', None)
    can_see_orders = user.is_staff or (perm and perm.can_manage_orders)
    can_see_reservations = user.is_staff or (perm and perm.can_manage_reservations)

    count = 0
    if can_see_orders:
        count += Order.objects.filter(status=Order.Status.PENDING_CONFIRMATION).count()
    if can_see_reservations:
        count += Reservation.objects.filter(status=Reservation.Status.PENDING).count()
    return count


def send_push_to_user(user, title: str, body: str, url: str = '/', notif_type: str = '') -> None:
    if not settings.VAPID_PRIVATE_KEY:
        logger.info(f'[PUSH DISABLED — VAPID not configured] {user}: {title}')
        return
    # type برای این است که وقتی اپ باز است، service worker بداند کدام صدای اختصاصی
    # (سفارش جدید/رزرو جدید/یادآوری نقدی) را به تب‌های باز پخش کند. badge هم همین‌جا
    # محاسبه می‌شود تا حتی بدون هیچ تب بازی، عدد روی آیکون اپ به‌روز بماند.
    payload = {
        'title': title, 'body': body, 'url': url, 'type': notif_type,
        'badge': _pending_badge_count_for(user),
    }
    for subscription in list(user.push_subscriptions.all()):
        _send_to_subscription(subscription, payload)


def send_push_to_users(users, title: str, body: str, url: str = '/', notif_type: str = '') -> None:
    for user in users:
        send_push_to_user(user, title, body, url, notif_type)


def get_notification_recipients(permission_field: str):
    """
    ادمین‌ها (همیشه) + گارسون‌هایی که دسترسی مشخص‌شده (مثلاً can_manage_orders) را دارند.
    """
    from apps.accounts.models import User

    return User.objects.filter(
        Q(is_staff=True)
        | Q(role=User.Role.WAITER, **{f'waiter_permissions__{permission_field}': True})
    ).distinct()


def _order_context_label(order) -> str:
    """میز/نوع تحویل سفارش، به‌صورت یک عبارت کوتاه برای نمایش در متن نوتیفیکیشن —
    تا سرپرست سالن بدون باز کردن اپ بداند این سفارش برای کدام میز/چه نوع تحویلی است."""
    if order.delivery_type == order.DeliveryType.DINE_IN:
        return f'میز {order.table.number}' if order.table_id else 'سرو در کافه'
    if order.delivery_type == order.DeliveryType.DELIVERY:
        return 'ارسال با پیک'
    return 'بیرون‌بر'


def notify_new_order(order) -> None:
    """
    نوتیفیکیشن Push به ادمین‌ها + گارسون‌های دارای دسترسی مدیریت سفارش — سفارش تازه در
    انتظار تأیید است. لینک هرکدام به صفحه‌ی سفارشات پنل خودشان می‌رود (مسیرها فرق دارند).
    متن شامل میز/نوع تحویل و نام مشتری است تا پیام روی نوتیفیکیشن گوشی به‌تنهایی
    کافی باشد و نیازی به باز کردن اپ برای فهمیدن «این سفارش چیست» نباشد.
    """
    title = 'سفارش جدید'
    customer_name = order.user.full_name or str(order.user.phone)
    body = f'سفارش #{order.order_number} — {_order_context_label(order)} — {customer_name}'
    recipients = list(get_notification_recipients('can_manage_orders'))
    send_push_to_users(
        [u for u in recipients if u.is_staff], title, body, url='/admin/orders', notif_type='new_order',
    )
    send_push_to_users(
        [u for u in recipients if not u.is_staff], title, body,
        url='/waiter/orders?status=pending_confirmation', notif_type='new_order',
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
        [u for u in recipients if u.is_staff], title, body, url='/admin/orders', notif_type='cash_reminder',
    )
    send_push_to_users(
        [u for u in recipients if not u.is_staff], title, body, url='/waiter/orders', notif_type='cash_reminder',
    )


def notify_courier_issue(order, message: str) -> None:
    """نوتیفیکیشن Push به ادمین‌ها + گارسون‌های دارای دسترسی مدیریت سفارش — یک رویداد
    نگران‌کننده در ارسال پیک اسنپ‌باکس (پیک لغو کرد/تحویل ناموفق بود). notif_type
    'snapp_courier_issue' یک صدای اختصاصی دارد (فایل courier-alert.mp3، فقط وقتی اپ باز
    است)؛ وقتی اپ بسته/پس‌زمینه است، صدای پیش‌فرض سیستم‌عامل پخش می‌شود (محدودیت پلتفرم)."""
    title = 'مشکل در ارسال پیک'
    body = f'سفارش #{order.order_number}: {message}'
    recipients = list(get_notification_recipients('can_manage_orders'))
    send_push_to_users(
        [u for u in recipients if u.is_staff], title, body,
        url='/admin/orders', notif_type='snapp_courier_issue',
    )
    send_push_to_users(
        [u for u in recipients if not u.is_staff], title, body,
        url='/waiter/orders', notif_type='snapp_courier_issue',
    )


def notify_courier_delivered(order) -> None:
    """نوتیفیکیشن Push به ادمین‌ها + گارسون‌های دارای دسترسی مدیریت سفارش — پیک
    اسنپ‌باکس تحویل سفارش به مشتری را با موفقیت گزارش کرد (رویداد ORDER_STATUS_UPDATE
    با orderStatus=DELIVERED). notif_type جدا از 'snapp_courier_issue' است چون این
    خبر خوب است نه هشدار — صدای پیش‌فرض نوتیف را پخش می‌کند، نه صدای اختصاصی هشدار."""
    title = 'تحویل سفارش'
    body = f'سفارش #{order.order_number} توسط پیک به مشتری تحویل داده شد'
    recipients = list(get_notification_recipients('can_manage_orders'))
    send_push_to_users(
        [u for u in recipients if u.is_staff], title, body,
        url='/admin/orders', notif_type='snapp_courier_delivered',
    )
    send_push_to_users(
        [u for u in recipients if not u.is_staff], title, body,
        url='/waiter/orders', notif_type='snapp_courier_delivered',
    )


def notify_new_reservation(reservation) -> None:
    """نوتیفیکیشن Push به ادمین‌ها + گارسون‌های دارای دسترسی مدیریت رزرو — رزرو تازه ثبت شده است.
    شامل میز و نام مشتری تا از روی خود نوتیفیکیشن هم مشخص باشد چه رزروی است."""
    title = 'رزرو جدید'
    date_str = str(reservation.date)
    time_str = str(reservation.start_time)[:5]
    customer_name = reservation.user.full_name or str(reservation.user.phone)
    body = f'میز {reservation.table.number} — {date_str} ساعت {time_str} — {customer_name}'
    recipients = list(get_notification_recipients('can_manage_reservations'))
    send_push_to_users(
        [u for u in recipients if u.is_staff], title, body,
        url='/admin/reservations', notif_type='new_reservation',
    )
    send_push_to_users(
        [u for u in recipients if not u.is_staff], title, body,
        url='/waiter/reservations', notif_type='new_reservation',
    )

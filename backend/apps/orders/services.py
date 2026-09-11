from django.db import transaction
from .models import Order, OrderItem, OrderItemAddon
from apps.menu.models import MenuItemVariant, MenuItemAddon
from apps.discounts.utils import apply_discount


class OrderCreationError(Exception):
    """خطای قابل‌نمایش به کاربر هنگام ساخت سفارش (مثلاً کد تخفیف نامعتبر، موجودی کیف‌پول ناکافی)."""

    def __init__(self, message):
        self.message = message
        super().__init__(message)


@transaction.atomic
def create_order(
    *, user, items, delivery_type, payment_method, address=None, table=None,
    note='', discount_code='', walk_in_customer_name='', force_status=None,
):
    """
    منطق مشترک ساخت سفارش — هم مسیر سفارش آنلاین مشتری (OrderListCreateView) و هم
    ثبت سفارش حضوری توسط پرسنل (apps.pos) از این استفاده می‌کنند تا محاسبه‌ی قیمت/
    بسته‌بندی/ارسال/تخفیف یک‌جا نگه‌داشته شود. items یک لیست از dict با کلیدهای
    menu_item, quantity, variant_id (اختیاری), addon_ids (اختیاری) است.
    force_status اگر داده شود (مثلاً Order.Status.PAID برای سفارش حضوری که خودِ
    پرسنل ثبت می‌کند) به‌جای منطق پیش‌فرض وضعیت اولیه استفاده می‌شود.
    در خطا (کد تخفیف نامعتبر، موجودی کیف‌پول ناکافی) OrderCreationError raise می‌شود
    و کل تراکنش rollback می‌شود.
    """
    total = 0
    items_to_create = []
    for item_data in items:
        menu_item = item_data['menu_item']
        variant = None
        variant_name = ''
        if item_data.get('variant_id'):
            try:
                variant = MenuItemVariant.objects.get(
                    id=item_data['variant_id'], item=menu_item
                )
                variant_name = variant.name
                unit_price = variant.final_price
            except MenuItemVariant.DoesNotExist:
                unit_price = menu_item.final_price
        else:
            unit_price = menu_item.final_price

        addon_ids = item_data.get('addon_ids') or []
        addons = list(
            MenuItemAddon.objects.filter(id__in=addon_ids, item=menu_item, is_available=True)
        ) if addon_ids else []
        addons_total = sum(a.price for a in addons)

        qty = item_data['quantity']
        total += (unit_price + addons_total) * qty
        items_to_create.append({
            'menu_item': menu_item,
            'variant': variant,
            'variant_name': variant_name,
            'quantity': qty,
            'unit_price': unit_price,
            'addons': addons,
        })

    from apps.business.models import DeliverySettings
    delivery_settings = DeliverySettings.get_settings()
    if delivery_type == Order.DeliveryType.DELIVERY:
        threshold = delivery_settings.free_delivery_threshold
        if threshold and total >= threshold:
            delivery_cost = 0
        else:
            delivery_cost = delivery_settings.delivery_cost
    else:
        delivery_cost = 0

    total_quantity = sum(item_p['quantity'] for item_p in items_to_create)
    if delivery_type == Order.DeliveryType.TAKEAWAY:
        packaging_cost = delivery_settings.takeaway_packaging_cost * total_quantity
    elif delivery_type == Order.DeliveryType.DELIVERY:
        packaging_cost = delivery_settings.delivery_packaging_cost * total_quantity
    else:
        packaging_cost = 0

    discount_amount = 0
    applied_discount_result = None
    if discount_code:
        result = apply_discount(discount_code, total, user)
        if not result['valid']:
            raise OrderCreationError(result['message'])
        discount_amount = result['discount_amount']
        applied_discount_result = result

    order = Order.objects.create(
        user=user,
        delivery_type=delivery_type,
        payment_method=payment_method,
        address=address,
        table=table,
        note=note,
        walk_in_customer_name=walk_in_customer_name,
        delivery_cost=delivery_cost,
        packaging_cost=packaging_cost,
    )

    for item_p in items_to_create:
        order_item = OrderItem.objects.create(
            order=order,
            menu_item=item_p['menu_item'],
            variant=item_p['variant'],
            variant_name=item_p['variant_name'],
            quantity=item_p['quantity'],
            unit_price=item_p['unit_price'],
        )
        for addon in item_p['addons']:
            OrderItemAddon.objects.create(
                order_item=order_item, addon=addon, name=addon.name, price=addon.price,
            )

    order.total_price = total
    if applied_discount_result:
        order.discount_code = discount_code
        order.discount_amount = discount_amount

    order.final_price = total + delivery_cost + packaging_cost - discount_amount

    if force_status:
        order.status = force_status
    elif payment_method in (Order.PaymentMethod.CASH, Order.PaymentMethod.WALLET):
        # سفارش نقدی/کیف‌پول بلافاصله در انتظار تأیید کافه قرار می‌گیرد — پیش از آماده‌سازی
        # باید گارسون/ادمین تأیید کند (ممکن است کافه امکان آماده کردنش را نداشته باشد)
        order.status = Order.Status.PENDING_CONFIRMATION

    order.save()

    if payment_method == Order.PaymentMethod.WALLET:
        if order.final_price > 0:
            from apps.wallet.services import debit, InsufficientBalanceError
            from apps.wallet.models import WalletTransaction
            try:
                debit(
                    user, order.final_price, WalletTransaction.Type.ORDER_PAYMENT,
                    order=order, description=f'پرداخت سفارش #{order.order_number}',
                )
            except InsufficientBalanceError:
                raise OrderCreationError('موجودی کیف‌پول کافی نیست')
        order.is_paid = True
        order.save(update_fields=['is_paid'])

    if order.status == Order.Status.PENDING_CONFIRMATION:
        from apps.notifications.push import notify_new_order
        notify_new_order(order)

    if applied_discount_result:
        from apps.discounts.models import DiscountUsage
        disc_obj = applied_discount_result['discount']
        DiscountUsage.objects.create(
            discount=disc_obj,
            user=user,
            order_id=order.id,
            used_year=applied_discount_result.get('used_year'),
        )
        disc_obj.used_count += 1
        disc_obj.save(update_fields=['used_count'])

    if order.status == Order.Status.PAID:
        from apps.pos.services import queue_print_job
        queue_print_job(order)

    return order

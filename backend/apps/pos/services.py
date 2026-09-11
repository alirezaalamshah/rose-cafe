from .models import PrintJob

WALK_IN_CUSTOMER_PHONE = '+989000000000'


def get_walk_in_customer():
    """کاربر مشترک «مشتری حضوری» — همه‌ی سفارش‌های ثبت‌شده توسط پرسنل برای مشتریان
    بدون حساب کاربری به همین یک کاربر متصل می‌شوند؛ نام واقعی مشتری (اگر پرسنل
    گرفته باشد) روی خودِ سفارش (Order.walk_in_customer_name) ذخیره می‌شود، نه اینجا.
    lazy get_or_create به‌جای migration داده، چون هیچ نیازی به وجودش قبل از اولین
    سفارش حضوری نیست."""
    from apps.accounts.models import User
    user, _ = User.objects.get_or_create(
        phone=WALK_IN_CUSTOMER_PHONE,
        defaults={'full_name': 'مشتری حضوری'},
    )
    return user


def queue_print_job(order) -> None:
    """سفارش تازه تأیید‌شده (status=PAID) را به صف چاپ فیش اضافه می‌کند. هر مسیری
    که یک سفارش را PAID می‌کند (تأیید دستی پرسنل، یا ثبت مستقیم سفارش حضوری) باید
    صریحاً این تابع را صدا بزند — مثل الگوی _maybe_dispatch_to_snapp در
    apps.orders.views. get_or_create چون Order.OneToOneField اجازه‌ی رکورد
    دوم برای همان سفارش را نمی‌دهد؛ اگر به هر دلیل (مثلاً رد شدن و دوباره
    تأییدشدن) already وجود داشت، آن یکی نادیده گرفته می‌شود، نه خطا."""
    PrintJob.objects.get_or_create(order=order)


RECEIPT_LINE_WIDTH = 32  # عرض استاندارد فیش پرینترهای حرارتی ۵۸ میلی‌متری با فونت پایه


def _center(text: str, width: int = RECEIPT_LINE_WIDTH) -> str:
    return text.center(width)


def _kv_line(label: str, value: str, width: int = RECEIPT_LINE_WIDTH) -> str:
    """یک ردیف «برچسب ..... مقدار» با نقطه‌چین پرکننده تا عرض فیش."""
    gap = width - len(label) - len(value)
    return f'{label}{"." * max(gap, 1)}{value}' if gap > 0 else f'{label} {value}'


def render_receipt_text(order) -> str:
    """Order را به متن monospace قابل چاپ روی پرینتر حرارتی تبدیل می‌کند — بخش‌های
    وابسته به داده‌ی سفارش (شماره/آیتم‌ها/قیمت/تاریخ) همیشه ثابت‌الگو هستند؛ فقط
    header_text/footer_text/نمایش نام و تلفن مشتری از ReceiptSettings خوانده
    می‌شوند (تنها بخش‌هایی که ادمین از پنل قابل تغییر گذاشته است)."""
    import jdatetime
    from django.utils import timezone
    from .models import ReceiptSettings
    from apps.business.models import CafeInfo

    settings_obj = ReceiptSettings.get_settings()
    cafe = CafeInfo.get_info()

    lines = []
    lines.append(_center(settings_obj.header_text or cafe.name))
    if cafe.address:
        lines.append(_center(cafe.address))
    if cafe.phone:
        lines.append(_center(cafe.phone))
    lines.append('-' * RECEIPT_LINE_WIDTH)

    lines.append(_kv_line('شماره سفارش', order.order_number))
    created_local = timezone.localtime(order.created_at)
    jalali = jdatetime.date.fromgregorian(date=created_local.date())
    lines.append(_kv_line('تاریخ', f'{jalali.strftime("%Y/%m/%d")} {created_local.strftime("%H:%M")}'))
    lines.append(_kv_line('نوع تحویل', order.get_delivery_type_display()))
    if order.table_id:
        lines.append(_kv_line('میز', str(order.table.number)))

    customer_name = order.walk_in_customer_name or order.user.full_name
    if settings_obj.show_customer_name and customer_name:
        lines.append(_kv_line('مشتری', customer_name))
    if settings_obj.show_customer_phone and not order.walk_in_customer_name:
        lines.append(_kv_line('تلفن', str(order.user.phone)))

    lines.append('-' * RECEIPT_LINE_WIDTH)

    for item in order.items.all():
        name = item.menu_item.name
        if item.variant_name:
            name = f'{name} ({item.variant_name})'
        lines.append(f'{name} × {item.quantity}')
        lines.append(_kv_line('', f'{item.subtotal:,} تومان'))
        for addon in item.addons.all():
            lines.append(f'  + {addon.name} ({addon.price:,})')

    lines.append('-' * RECEIPT_LINE_WIDTH)
    lines.append(_kv_line('جمع اقلام', f'{order.total_price:,} تومان'))
    if order.packaging_cost:
        lines.append(_kv_line('بسته‌بندی', f'{order.packaging_cost:,} تومان'))
    if order.delivery_cost:
        lines.append(_kv_line('ارسال', f'{order.delivery_cost:,} تومان'))
    if order.discount_amount:
        lines.append(_kv_line('تخفیف', f'-{order.discount_amount:,} تومان'))
    lines.append(_kv_line('مبلغ نهایی', f'{order.final_price:,} تومان'))
    lines.append(_kv_line('پرداخت', order.get_payment_method_display()))

    if order.note:
        lines.append('-' * RECEIPT_LINE_WIDTH)
        lines.append(f'توضیحات: {order.note}')

    if settings_obj.footer_text:
        lines.append('-' * RECEIPT_LINE_WIDTH)
        lines.append(_center(settings_obj.footer_text))

    return '\n'.join(lines)

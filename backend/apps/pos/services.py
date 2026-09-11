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


def _text(text, align='right', bold=False):
    return {'type': 'text', 'text': text, 'align': align, 'bold': bold}


def _row(left, right, bold=False):
    return {'type': 'row', 'left': left, 'right': right, 'bold': bold}


def _divider():
    return {'type': 'divider'}


def build_receipt_data(order) -> list:
    """Order را به یک لیست از بلوک‌های ساختاریافته (نه متن تخت) تبدیل می‌کند —
    چون فونت فارسی روی پرینتر proportional است (نه monospace)، وسط‌چین‌کردن و
    ردیف‌های دوطرفه باید توسط Print Agent با چیدمان واقعی canvas رسم شوند، نه با
    فاصله‌گذاری کاراکتری اینجا. هر بلوک یک type مشخص دارد: text (یک خط، با
    align)، row (برچسب راست + مقدار چپ، مثل جدول)، divider (خط افقی کامل).
    بخش‌های وابسته به داده‌ی سفارش (شماره/آیتم‌ها/قیمت/تاریخ) همیشه ثابت‌الگو
    هستند؛ فقط header_text/footer_text/نمایش نام و تلفن مشتری از ReceiptSettings
    خوانده می‌شوند (تنها بخش‌هایی که ادمین از پنل قابل تغییر گذاشته است)."""
    import jdatetime
    from django.utils import timezone
    from .models import ReceiptSettings
    from apps.business.models import CafeInfo

    settings_obj = ReceiptSettings.get_settings()
    cafe = CafeInfo.get_info()

    blocks = []
    blocks.append(_text(settings_obj.header_text or cafe.name, align='center', bold=True))
    if cafe.address:
        blocks.append(_text(cafe.address, align='center'))
    if cafe.phone:
        blocks.append(_text(cafe.phone, align='center'))
    blocks.append(_divider())

    blocks.append(_row('شماره سفارش', order.order_number))
    created_local = timezone.localtime(order.created_at)
    jalali = jdatetime.date.fromgregorian(date=created_local.date())
    blocks.append(_row('تاریخ', f'{jalali.strftime("%Y/%m/%d")} {created_local.strftime("%H:%M")}'))
    blocks.append(_row('نوع تحویل', order.get_delivery_type_display()))
    if order.table_id:
        blocks.append(_row('میز', str(order.table.number)))

    customer_name = order.walk_in_customer_name or order.user.full_name
    if settings_obj.show_customer_name and customer_name:
        blocks.append(_row('مشتری', customer_name))
    if settings_obj.show_customer_phone and not order.walk_in_customer_name:
        blocks.append(_row('تلفن', str(order.user.phone)))

    blocks.append(_divider())

    for item in order.items.all():
        name = item.menu_item.name
        if item.variant_name:
            name = f'{name} ({item.variant_name})'
        blocks.append(_row(f'{name} × {item.quantity}', f'{item.subtotal:,} تومان'))
        for addon in item.addons.all():
            blocks.append(_text(f'+ {addon.name} ({addon.price:,})', align='right'))

    blocks.append(_divider())
    blocks.append(_row('جمع اقلام', f'{order.total_price:,} تومان'))
    if order.packaging_cost:
        blocks.append(_row('بسته‌بندی', f'{order.packaging_cost:,} تومان'))
    if order.delivery_cost:
        blocks.append(_row('ارسال', f'{order.delivery_cost:,} تومان'))
    if order.discount_amount:
        blocks.append(_row('تخفیف', f'-{order.discount_amount:,} تومان'))
    blocks.append(_row('مبلغ نهایی', f'{order.final_price:,} تومان', bold=True))
    blocks.append(_row('پرداخت', order.get_payment_method_display()))

    if order.note:
        blocks.append(_divider())
        blocks.append(_text(f'توضیحات: {order.note}', align='right'))

    if settings_obj.footer_text:
        blocks.append(_divider())
        blocks.append(_text(settings_obj.footer_text, align='center'))

    return blocks

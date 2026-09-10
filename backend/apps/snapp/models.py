from django.db import models
from django.utils import timezone
from apps.business.models import CachedSingletonModel


class SnappSettings(CachedSingletonModel):
    """
    تنظیمات یکپارچه‌سازی با اسنپ‌باکس (ارسال پیک). یک ردیف singleton، مثل
    DeliverySettings/CafeInfo. client_id/client_secret واقعی در .env نگه داشته
    می‌شوند (نه اینجا) — این مدل فقط رفتار/مبدا را نگه می‌دارد.
    """
    class DispatchMode(models.TextChoices):
        MANUAL = 'manual', 'دستی — فقط با دکمه‌ی صریح ادمین/سرپرست سالن'
        AUTO_ON_CONFIRM = 'auto_on_confirm', 'خودکار — بلافاصله پس از تأیید سفارش'
        AUTO_ON_READY = 'auto_on_ready', 'خودکار — پس از آماده شدن سفارش'

    is_enabled = models.BooleanField(default=False, verbose_name='یکپارچه‌سازی با اسنپ‌باکس فعال است')
    dispatch_mode = models.CharField(
        max_length=20, choices=DispatchMode.choices, default=DispatchMode.MANUAL,
        verbose_name='نحوه‌ی ارسال به پیک',
    )
    default_delivery_category = models.CharField(
        # 'bike' یعنی پیک با باکس — برای این کافه لازم است چون محصول (نوشیدنی/غذا) نیاز
        # به جابه‌جایی ایمن با باکس دارد؛ 'bike-without-box' موتور بدون باکس است
        max_length=50, default='bike', verbose_name='دسته‌بندی پیش‌فرض ارسال',
        help_text='مثلاً bike (با باکس)، bike-without-box، van — طبق مستندات اسنپ‌باکس (یا از لیست واقعی زیر انتخاب کنید)',
    )

    # مبدا ثابت سفارش‌ها (خود کافه) — یک‌بار توسط ادمین (از روی نقشه) وارد می‌شود
    # و برای همه‌ی سفارش‌ها یکسان است
    store_city = models.CharField(
        max_length=50, default='dezful', verbose_name='شهر (برای API اسنپ‌باکس)',
        help_text='نام لاتین شهر طبق مستندات اسنپ‌باکس، مثلاً dezful',
    )
    store_address = models.CharField(max_length=255, blank=True, verbose_name='آدرس مبدا (کافه)')
    store_latitude = models.CharField(max_length=30, blank=True, verbose_name='عرض جغرافیایی مبدا')
    store_longitude = models.CharField(max_length=30, blank=True, verbose_name='طول جغرافیایی مبدا')
    store_contact_name = models.CharField(max_length=100, blank=True, verbose_name='نام تحویل‌دهنده در مبدا')
    store_contact_phone = models.CharField(max_length=20, blank=True, verbose_name='شماره تماس مبدا')

    # شعاع مجاز ثبت آدرس حول مبدا (کافه) — جلوگیری از ثبت آدرس در شهر/منطقه‌ای خیلی
    # دور که عملاً غیرقابل‌تحویل با پیک است (چه دستی چه از طریق اسنپ‌باکس)
    max_delivery_radius_km = models.PositiveSmallIntegerField(
        default=15, verbose_name='حداکثر شعاع مجاز ثبت آدرس (کیلومتر)',
        help_text='آدرس‌های دورتر از این فاصله (خط مستقیم) از مبدا، قابل ثبت نیستند',
    )

    # حالت اضطراری خودکار (circuit breaker) — وقتی در یک بازه‌ی زمانی کوتاه پشت‌سرهم
    # به تعداد مشخصی خطا خوردیم، خودمان یکپارچه‌سازی را موقتاً خاموش می‌کنیم تا هم
    # کاربر با خطای تکراری معطل نشود، هم لاگ پر از خطای بی‌فایده نشود
    circuit_breaker_max_failures = models.PositiveSmallIntegerField(
        default=5, verbose_name='حداکثر خطای پیاپی مجاز',
        help_text='بعد از این تعداد خطای پشت‌سرهم در بازه‌ی زیر، یکپارچه‌سازی موقتاً غیرفعال می‌شود',
    )
    circuit_breaker_window_minutes = models.PositiveSmallIntegerField(
        default=15, verbose_name='بازه‌ی زمانی شمارش خطا (دقیقه)',
    )
    circuit_breaker_tripped_at = models.DateTimeField(
        null=True, blank=True, verbose_name='زمان فعال‌شدن حالت اضطراری',
    )

    class Meta:
        verbose_name = 'تنظیمات اسنپ‌باکس'
        verbose_name_plural = 'تنظیمات اسنپ‌باکس'

    def __str__(self):
        return 'تنظیمات اسنپ‌باکس'

    @classmethod
    def get_settings(cls):
        return cls._get_or_create_cached({})

    @property
    def store_ready(self):
        """قبل از هر ارسال سفارش باید چک شود — بدون مبدا، ساخت سفارش در اسنپ بی‌معناست."""
        return bool(self.store_address and self.store_latitude and self.store_longitude)

    @property
    def circuit_breaker_tripped(self):
        return self.circuit_breaker_tripped_at is not None

    def trip_circuit_breaker(self):
        self.circuit_breaker_tripped_at = timezone.now()
        self.save(update_fields=['circuit_breaker_tripped_at'])

    def reset_circuit_breaker(self):
        self.circuit_breaker_tripped_at = None
        self.save(update_fields=['circuit_breaker_tripped_at'])


class SnappFailureLog(models.Model):
    """
    ثبت هر خطای ارسال به اسنپ‌باکس — فقط برای شمارش خطای پیاپی در بازه‌ی زمانی
    circuit breaker استفاده می‌شود (نه یک گزارش کامل خطا)؛ رکوردهای قدیمی‌تر از
    بازه هیچ‌وقت پاک نمی‌شوند چون حجمشان ناچیز است (فقط در زمان خطای واقعی نوشته می‌شوند).
    """
    message = models.CharField(max_length=255, blank=True, verbose_name='پیام خطا')
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        verbose_name = 'خطای اسنپ‌باکس'
        verbose_name_plural = 'خطاهای اسنپ‌باکس'
        ordering = ['-created_at']


class SnappCourierOrder(models.Model):
    """
    آینه‌ی وضعیت یک سفارش پیک اسنپ‌باکس — هر Order حداکثر یک رکورد دارد (اگر لغو/رد
    شد و دوباره ارسال شد، همین رکورد بازنویسی می‌شود، نه رکورد جدید؛ چون customerRefId
    ثابت -order.order_number- تکراری بودنش را در سمت اسنپ به همان سفارش قبلی نگاشت می‌کند).
    """
    class Status(models.TextChoices):
        PENDING = 'PENDING', 'در انتظار تخصیص پیک'
        ACCEPTED = 'ACCEPTED', 'پیک تخصیص یافت'
        PICKED_UP = 'PICKED_UP', 'بسته توسط پیک دریافت شد'
        DELIVERED = 'DELIVERED', 'تحویل داده شد'
        CANCELLED = 'CANCELLED', 'لغو شده'
        PREPENDING = 'PREPENDING', 'در حال ثبت'
        BATCHED = 'BATCHED', 'در صف تجمیع'
        VERIFICATION = 'VERIFICATION', 'در انتظار تأیید کد'
        RESERVED = 'RESERVED', 'رزرو شده'
        FAILED = 'FAILED', 'ناموفق'
        BIDDING = 'BIDDING', 'در حال مزایده'

    order = models.OneToOneField(
        'orders.Order', on_delete=models.CASCADE,
        related_name='snapp_courier', verbose_name='سفارش',
    )
    snapp_order_id = models.CharField(max_length=50, blank=True, db_index=True, verbose_name='شناسه سفارش در اسنپ')
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.PENDING, verbose_name='وضعیت پیک',
    )
    tracking_url = models.URLField(blank=True, verbose_name='لینک رهگیری زنده')
    delivery_fare = models.PositiveIntegerField(null=True, blank=True, verbose_name='هزینه واقعی پیک (تومان)')
    biker_name = models.CharField(max_length=100, blank=True, verbose_name='نام پیک')
    biker_phone = models.CharField(max_length=20, blank=True, verbose_name='شماره پیک')
    biker_photo_url = models.URLField(blank=True, verbose_name='عکس پیک')
    cancel_reason = models.CharField(max_length=255, blank=True, verbose_name='دلیل لغو')
    retry_count = models.PositiveSmallIntegerField(
        default=0, verbose_name='تعداد ارسال مجدد',
        help_text='هر بار که بعد از لغو/ناموفق‌شدن دوباره به پیک ارسال شود، یکی اضافه می‌شود',
    )
    current_latitude = models.CharField(max_length=30, blank=True, verbose_name='عرض جغرافیایی لحظه‌ای پیک')
    current_longitude = models.CharField(max_length=30, blank=True, verbose_name='طول جغرافیایی لحظه‌ای پیک')
    location_updated_at = models.DateTimeField(null=True, blank=True, verbose_name='آخرین بروزرسانی موقعیت')
    dispatched_at = models.DateTimeField(auto_now_add=True, verbose_name='زمان ارسال به اسنپ')
    last_webhook_at = models.DateTimeField(null=True, blank=True, verbose_name='آخرین بروزرسانی از وبهوک')
    raw_last_response = models.JSONField(null=True, blank=True, verbose_name='آخرین پاسخ خام (برای دیباگ)')

    class Meta:
        verbose_name = 'سفارش پیک اسنپ‌باکس'
        verbose_name_plural = 'سفارش‌های پیک اسنپ‌باکس'
        ordering = ['-dispatched_at']

    # وضعیت‌هایی که یعنی «تمام شد، دیگر پیگیری/رهگیری زنده معنی ندارد»
    TERMINAL_STATUSES = (Status.DELIVERED, Status.CANCELLED, Status.FAILED)
    # وضعیت‌هایی که ارسال دوباره (retry) را مجاز می‌کنند
    RETRYABLE_STATUSES = (Status.CANCELLED, Status.FAILED)

    def __str__(self):
        return f'پیک سفارش #{self.order.order_number} — {self.get_status_display()}'

    @property
    def is_terminal(self):
        return self.status in self.TERMINAL_STATUSES

    @property
    def is_trackable(self):
        """فقط وقتی که پیک واقعاً تخصیص یافته و در حال حمل است، رهگیری زنده معنی دارد."""
        return self.status in (self.Status.ACCEPTED, self.Status.PICKED_UP)

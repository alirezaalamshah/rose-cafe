from django.db import models
from django.utils import timezone
from django.core.cache import cache
from apps.common.image_processing import process_image

# ۱۵ دقیقه — کافی برای کاهش چشمگیر بار DB روی ریکوئست‌های عمومی پرترافیک،
# ولی کوتاه‌تر از آن که تغییرات ادمین را برای مدت طولانی نامرئی نگه دارد
# (هرچند save() هم صریحاً کش را همان لحظه باطل می‌کند)
SETTINGS_CACHE_SECONDS = 60 * 15


class CachedSingletonModel(models.Model):
    """
    برای مدل‌های singleton (فقط یک ردیف با pk=1) که هر ریکوئست دوباره از DB
    خوانده می‌شدند (اطلاعات کافه، تنظیمات ارسال، تنظیمات رزرو) — این‌ها تقریباً
    هیچ‌وقت تغییر نمی‌کنند، پس کش کردن‌شان امن و پرسود است.
    """
    class Meta:
        abstract = True

    @classmethod
    def _cache_key(cls):
        return f'singleton:{cls.__name__}'

    @classmethod
    def _get_or_create_cached(cls, defaults):
        obj = cache.get(cls._cache_key())
        if obj is not None:
            return obj
        obj, _ = cls.objects.get_or_create(pk=1, defaults=defaults)
        cache.set(cls._cache_key(), obj, SETTINGS_CACHE_SECONDS)
        return obj

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        cache.delete(self._cache_key())

# 0=Monday … 6=Sunday  (Python weekday() convention)
WEEKDAY_NAMES = {
    0: 'دوشنبه',
    1: 'سه‌شنبه',
    2: 'چهارشنبه',
    3: 'پنجشنبه',
    4: 'جمعه',
    5: 'شنبه',
    6: 'یکشنبه',
}

DAY_CHOICES = [(k, v) for k, v in WEEKDAY_NAMES.items()]


class BusinessHours(models.Model):
    day_of_week = models.IntegerField(
        choices=DAY_CHOICES,
        unique=True,
        verbose_name='روز هفته',
    )
    is_open = models.BooleanField(default=True, verbose_name='باز')
    open_time = models.TimeField(null=True, blank=True, verbose_name='ساعت باز شدن')
    close_time = models.TimeField(null=True, blank=True, verbose_name='ساعت بسته شدن')

    class Meta:
        verbose_name = 'ساعات کاری'
        verbose_name_plural = 'ساعات کاری هفتگی'
        ordering = ['day_of_week']

    def __str__(self):
        return WEEKDAY_NAMES.get(self.day_of_week, str(self.day_of_week))


class SpecialDay(models.Model):
    date = models.DateField(unique=True, verbose_name='تاریخ')
    is_closed = models.BooleanField(default=True, verbose_name='تعطیل')
    open_time = models.TimeField(null=True, blank=True, verbose_name='ساعت باز شدن')
    close_time = models.TimeField(null=True, blank=True, verbose_name='ساعت بسته شدن')
    note = models.CharField(max_length=200, blank=True, verbose_name='توضیحات')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'روز خاص'
        verbose_name_plural = 'روزهای خاص'
        ordering = ['date']

    def __str__(self):
        status = 'تعطیل' if self.is_closed else 'ساعت خاص'
        return f'{self.date} — {status}'


class DeliverySettings(CachedSingletonModel):
    delivery_cost = models.PositiveIntegerField(default=35000, verbose_name='هزینه ارسال (تومان)')
    free_delivery_threshold = models.PositiveIntegerField(
        null=True, blank=True,
        verbose_name='حداقل مبلغ برای ارسال رایگان',
        help_text='سفارش‌هایی با مبلغ بیشتر از این مقدار ارسال رایگان دارند. خالی = همیشه هزینه دارد',
    )
    takeaway_packaging_cost = models.PositiveIntegerField(
        default=0, verbose_name='هزینه بسته‌بندی سفارش بیرون‌بر (تومان)',
    )
    delivery_packaging_cost = models.PositiveIntegerField(
        default=0, verbose_name='هزینه بسته‌بندی سفارش ارسالی (تومان)',
    )

    class Meta:
        verbose_name = 'تنظیمات ارسال'
        verbose_name_plural = 'تنظیمات ارسال'

    def __str__(self):
        return f'هزینه ارسال: {self.delivery_cost:,} تومان'

    @classmethod
    def get_settings(cls):
        return cls._get_or_create_cached({'delivery_cost': 35000})


class CafeInfo(CachedSingletonModel):
    name = models.CharField(max_length=100, default='است', verbose_name='نام کافه')
    tagline = models.CharField(max_length=200, blank=True, verbose_name='شعار کافه')
    phone = models.CharField(max_length=20, blank=True, verbose_name='شماره تماس')
    address = models.TextField(blank=True, verbose_name='آدرس')

    class Meta:
        verbose_name = 'اطلاعات کافه'
        verbose_name_plural = 'اطلاعات کافه'

    def __str__(self):
        return self.name

    @classmethod
    def get_info(cls):
        return cls._get_or_create_cached({'name': 'است'})


class SocialLink(models.Model):
    """
    شبکه‌ی اجتماعی نمایش‌داده‌شده در فوتر. چند مورد از یک پلتفرم هم مجاز است
    (مثلاً دو اکانت اینستاگرام). URL نهایی از روی platform + account ساخته می‌شود
    تا ادمین فقط آیدی را وارد کند، نه لینک کامل.
    """
    class Platform(models.TextChoices):
        INSTAGRAM = 'instagram', 'اینستاگرام'
        TELEGRAM = 'telegram', 'تلگرام'
        WHATSAPP = 'whatsapp', 'واتساپ'
        TWITTER = 'twitter', 'ایکس (توییتر)'
        LINKEDIN = 'linkedin', 'لینکدین'
        YOUTUBE = 'youtube', 'یوتیوب'
        TIKTOK = 'tiktok', 'تیک‌تاک'
        WEBSITE = 'website', 'وب‌سایت / سایر'

    URL_TEMPLATES = {
        Platform.INSTAGRAM: 'https://instagram.com/{}',
        Platform.TELEGRAM: 'https://t.me/{}',
        Platform.WHATSAPP: 'https://wa.me/{}',
        Platform.TWITTER: 'https://x.com/{}',
        Platform.LINKEDIN: 'https://linkedin.com/in/{}',
        Platform.YOUTUBE: 'https://youtube.com/@{}',
        Platform.TIKTOK: 'https://tiktok.com/@{}',
    }

    platform = models.CharField(max_length=20, choices=Platform.choices, verbose_name='نوع شبکه')
    account = models.CharField(
        max_length=200, verbose_name='آیدی / اکانت',
        help_text='برای «وب‌سایت» آدرس کامل را وارد کنید؛ برای بقیه فقط آیدی (بدون @)',
    )
    order = models.PositiveIntegerField(default=0, verbose_name='ترتیب نمایش')
    is_active = models.BooleanField(default=True, verbose_name='فعال')

    class Meta:
        ordering = ['order', 'id']
        verbose_name = 'شبکه اجتماعی'
        verbose_name_plural = 'شبکه‌های اجتماعی'

    def __str__(self):
        return f'{self.get_platform_display()} — {self.account}'

    @property
    def url(self):
        clean = self.account.strip().lstrip('@')
        if self.platform == self.Platform.WEBSITE:
            return clean if clean.startswith('http') else f'https://{clean}'
        template = self.URL_TEMPLATES.get(self.platform)
        return template.format(clean) if template else clean


class Banner(models.Model):
    image = models.ImageField(upload_to='banners/', verbose_name='تصویر')
    # نقطه‌ی کانونی (درصد از عرض/ارتفاع) — تعیین می‌کند کدام بخش از عکس همیشه
    # داخل قاب اسلایدر (با هر نسبت صفحه‌ای) دیده شود
    focal_x = models.PositiveSmallIntegerField(default=50, verbose_name='نقطه کانونی افقی (٪)')
    focal_y = models.PositiveSmallIntegerField(default=50, verbose_name='نقطه کانونی عمودی (٪)')
    title = models.CharField(max_length=100, blank=True, verbose_name='عنوان (اختیاری)')
    link = models.CharField(max_length=300, blank=True, verbose_name='لینک (اختیاری)')
    start_date = models.DateField(null=True, blank=True, verbose_name='تاریخ شروع نمایش')
    end_date = models.DateField(null=True, blank=True, verbose_name='تاریخ پایان نمایش')
    order = models.PositiveIntegerField(default=0, verbose_name='ترتیب نمایش')
    is_active = models.BooleanField(default=True, verbose_name='فعال')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'بنر تبلیغاتی'
        verbose_name_plural = 'بنرهای تبلیغاتی'
        ordering = ['order', '-created_at']

    def __str__(self):
        return self.title or f'بنر #{self.pk}'

    def save(self, *args, **kwargs):
        if self.image and not self.image._committed:
            processed, _ = process_image(self.image.file, max_dimension=1920, base_name=self.image.name)
            self.image = processed
        super().save(*args, **kwargs)

    @classmethod
    def visible_now(cls):
        today = timezone.localdate()
        return cls.objects.filter(is_active=True).filter(
            models.Q(start_date__isnull=True) | models.Q(start_date__lte=today)
        ).filter(
            models.Q(end_date__isnull=True) | models.Q(end_date__gte=today)
        )


class ReservationSettings(CachedSingletonModel):
    max_reservation_hours = models.PositiveIntegerField(
        default=3,
        verbose_name='حداکثر ساعت رزرو میز',
        help_text='کاربران می‌توانند حداکثر تا این تعداد ساعت میز رزرو کنند',
    )

    class Meta:
        verbose_name = 'تنظیمات رزرو'
        verbose_name_plural = 'تنظیمات رزرو'

    def __str__(self):
        return f'حداکثر رزرو: {self.max_reservation_hours} ساعت'

    @classmethod
    def get_settings(cls):
        return cls._get_or_create_cached({'max_reservation_hours': 3})

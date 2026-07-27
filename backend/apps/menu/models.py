from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from apps.common.image_processing import process_image, process_image_with_thumbnail


class Category(models.Model):
    name = models.CharField(max_length=100, verbose_name='نام دسته‌بندی')
    slug = models.SlugField(unique=True, allow_unicode=True, verbose_name='اسلاگ')
    icon = models.CharField(max_length=50, blank=True, verbose_name='آیکون')
    image = models.ImageField(upload_to='categories/', blank=True, null=True, verbose_name='تصویر')
    description = models.TextField(blank=True, verbose_name='توضیحات')
    order = models.PositiveIntegerField(default=0, verbose_name='ترتیب نمایش')
    is_active = models.BooleanField(default=True, verbose_name='فعال', db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'دسته‌بندی'
        verbose_name_plural = 'دسته‌بندی‌ها'
        ordering = ['order', 'name']

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if self.image and not self.image._committed:
            processed, _ = process_image(self.image.file, base_name=self.image.name)
            self.image = processed

        # اگر دسته از فعال به غیرفعال تغییر کرد، همه‌ی آیتم‌های آن هم غیرفعال شوند
        just_deactivated = False
        if self.pk:
            was_active = Category.objects.filter(pk=self.pk).values_list('is_active', flat=True).first()
            just_deactivated = bool(was_active) and not self.is_active

        super().save(*args, **kwargs)

        if just_deactivated:
            self.items.exclude(status=MenuItem.Status.UNAVAILABLE).update(status=MenuItem.Status.UNAVAILABLE)


class MenuItem(models.Model):
    class Status(models.TextChoices):
        AVAILABLE = 'available', 'موجود'
        UNAVAILABLE = 'unavailable', 'ناموجود'
        COMING_SOON = 'coming_soon', 'به زودی'

    category = models.ForeignKey(
        Category, on_delete=models.PROTECT,
        related_name='items', verbose_name='دسته‌بندی'
    )
    name = models.CharField(max_length=150, verbose_name='نام آیتم')
    slug = models.SlugField(unique=True, allow_unicode=True, verbose_name='اسلاگ')
    description = models.TextField(blank=True, verbose_name='توضیحات')
    price = models.PositiveIntegerField(verbose_name='قیمت (تومان)')
    discounted_price = models.PositiveIntegerField(
        null=True, blank=True, verbose_name='قیمت با تخفیف'
    )
    image = models.ImageField(upload_to='menu/', blank=True, null=True, verbose_name='تصویر')
    image_thumbnail = models.ImageField(
        upload_to='menu/thumbnails/', blank=True, null=True, editable=False,
        verbose_name='بندانگشتی (خودکار)',
    )
    status = models.CharField(
        max_length=20, choices=Status.choices,
        default=Status.AVAILABLE, verbose_name='وضعیت', db_index=True
    )
    is_featured = models.BooleanField(default=False, verbose_name='ویژه', db_index=True)
    is_vegetarian = models.BooleanField(default=False, verbose_name='گیاهی')
    calories = models.PositiveIntegerField(null=True, blank=True, verbose_name='کالری')
    preparation_time = models.PositiveIntegerField(
        default=10, verbose_name='زمان آماده‌سازی (دقیقه)'
    )
    order = models.PositiveIntegerField(default=0, verbose_name='ترتیب نمایش')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'آیتم منو'
        verbose_name_plural = 'آیتم‌های منو'
        # ابتدا بر اساس ترتیب دسته‌بندی گروه‌بندی می‌شود، سپس ترتیب داخل همان دسته
        ordering = ['category__order', 'category__name', 'order', 'name']

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if self.image and not self.image._committed:
            main_file, thumb_file = process_image_with_thumbnail(self.image.file, base_name=self.image.name)
            self.image = main_file
            self.image_thumbnail = thumb_file
        super().save(*args, **kwargs)

        if self.category_id:
            if self.status == self.Status.AVAILABLE:
                # با فعال شدن حتی یک آیتم، دسته‌بندی‌اش هم خودکار فعال می‌شود
                Category.objects.filter(pk=self.category_id, is_active=False).update(is_active=True)
            else:
                # اگر دیگر هیچ آیتم موجودی در این دسته نماند، دسته هم خودکار غیرفعال می‌شود
                has_available = MenuItem.objects.filter(
                    category_id=self.category_id, status=self.Status.AVAILABLE
                ).exists()
                if not has_available:
                    Category.objects.filter(pk=self.category_id, is_active=True).update(is_active=False)

    @property
    def final_price(self):
        return self.discounted_price if self.discounted_price else self.price

    @property
    def has_discount(self):
        return bool(self.discounted_price and self.discounted_price < self.price)


class MenuItemVariant(models.Model):
    item = models.ForeignKey(
        MenuItem, on_delete=models.CASCADE,
        related_name='variants', verbose_name='آیتم'
    )
    name = models.CharField(max_length=100, verbose_name='نام')
    price = models.PositiveIntegerField(verbose_name='قیمت')
    discounted_price = models.PositiveIntegerField(null=True, blank=True, verbose_name='قیمت با تخفیف')
    is_available = models.BooleanField(default=True, verbose_name='موجود')
    order = models.PositiveIntegerField(default=0, verbose_name='ترتیب')

    class Meta:
        ordering = ['order', 'id']
        verbose_name = 'نوع آیتم'
        verbose_name_plural = 'انواع آیتم'

    def __str__(self):
        return f"{self.item.name} — {self.name}"

    @property
    def final_price(self):
        return self.discounted_price if self.discounted_price else self.price

    @property
    def has_discount(self):
        return bool(self.discounted_price and self.discounted_price < self.price)


class MenuItemAddon(models.Model):
    """
    افزودنی مستقل و اختیاری روی یک آیتم (مثل «خامه اضافه» روی لاته) —
    برخلاف MenuItemVariant که تک‌انتخابی و جایگزین قیمت پایه است،
    چند افزودنی را می‌شود هم‌زمان انتخاب کرد و همه به قیمت پایه/نوع اضافه می‌شوند.
    """
    item = models.ForeignKey(
        MenuItem, on_delete=models.CASCADE,
        related_name='addons', verbose_name='آیتم'
    )
    name = models.CharField(max_length=100, verbose_name='نام افزودنی')
    price = models.PositiveIntegerField(verbose_name='قیمت افزودنی (تومان)')
    is_available = models.BooleanField(default=True, verbose_name='موجود')
    order = models.PositiveIntegerField(default=0, verbose_name='ترتیب')

    class Meta:
        ordering = ['order', 'id']
        verbose_name = 'افزودنی آیتم'
        verbose_name_plural = 'افزودنی‌های آیتم'

    def __str__(self):
        return f'{self.item.name} — {self.name}'


class MenuItemImage(models.Model):
    item = models.ForeignKey(
        MenuItem, on_delete=models.CASCADE,
        related_name='extra_images', verbose_name='آیتم'
    )
    image = models.ImageField(upload_to='menu/gallery/', verbose_name='تصویر')
    image_thumbnail = models.ImageField(
        upload_to='menu/gallery/thumbnails/', blank=True, null=True, editable=False,
        verbose_name='بندانگشتی (خودکار)',
    )
    order = models.PositiveIntegerField(default=0)

    class Meta:
        verbose_name = 'تصویر آیتم'
        verbose_name_plural = 'تصاویر آیتم'
        ordering = ['order']

    def save(self, *args, **kwargs):
        if self.image and not self.image._committed:
            main_file, thumb_file = process_image_with_thumbnail(self.image.file, base_name=self.image.name)
            self.image = main_file
            self.image_thumbnail = thumb_file
        super().save(*args, **kwargs)
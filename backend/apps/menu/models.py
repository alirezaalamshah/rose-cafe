from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator


class Category(models.Model):
    name = models.CharField(max_length=100, verbose_name='نام دسته‌بندی')
    slug = models.SlugField(unique=True, allow_unicode=True, verbose_name='اسلاگ')
    icon = models.CharField(max_length=50, blank=True, verbose_name='آیکون')
    image = models.ImageField(upload_to='categories/', blank=True, null=True, verbose_name='تصویر')
    description = models.TextField(blank=True, verbose_name='توضیحات')
    order = models.PositiveIntegerField(default=0, verbose_name='ترتیب نمایش')
    is_active = models.BooleanField(default=True, verbose_name='فعال')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'دسته‌بندی'
        verbose_name_plural = 'دسته‌بندی‌ها'
        ordering = ['order', 'name']

    def __str__(self):
        return self.name


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
    status = models.CharField(
        max_length=20, choices=Status.choices,
        default=Status.AVAILABLE, verbose_name='وضعیت'
    )
    is_featured = models.BooleanField(default=False, verbose_name='ویژه')
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
        ordering = ['order', 'name']

    def __str__(self):
        return self.name

    @property
    def final_price(self):
        return self.discounted_price if self.discounted_price else self.price

    @property
    def has_discount(self):
        return bool(self.discounted_price and self.discounted_price < self.price)

    @property
    def average_rating(self):
        reviews = self.reviews.filter(is_approved=True)
        if reviews.exists():
            return round(reviews.aggregate(
                avg=models.Avg('rating')
            )['avg'], 1)
        return None

    @property
    def review_count(self):
        return self.reviews.filter(is_approved=True).count()


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


class MenuItemImage(models.Model):
    item = models.ForeignKey(
        MenuItem, on_delete=models.CASCADE,
        related_name='extra_images', verbose_name='آیتم'
    )
    image = models.ImageField(upload_to='menu/gallery/', verbose_name='تصویر')
    order = models.PositiveIntegerField(default=0)

    class Meta:
        verbose_name = 'تصویر آیتم'
        verbose_name_plural = 'تصاویر آیتم'
        ordering = ['order']
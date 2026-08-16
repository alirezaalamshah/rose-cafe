from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
from phonenumber_field.modelfields import PhoneNumberField
from apps.common.image_processing import process_image


class UserManager(BaseUserManager):
    def create_user(self, phone, full_name='', password=None):
        if not phone:
            raise ValueError('شماره موبایل الزامی است')
        user = self.model(phone=phone, full_name=full_name)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save(using=self._db)
        return user

    def create_superuser(self, phone, full_name='', password=None):
        user = self.create_user(phone, full_name, password)
        user.is_staff = True
        user.is_superuser = True
        user.save(using=self._db)
        return user


class User(AbstractBaseUser, PermissionsMixin):
    class Role(models.TextChoices):
        CUSTOMER = 'customer', 'مشتری'
        WAITER = 'waiter', 'سرپرست سالن'
        ADMIN = 'admin', 'مدیر'

    class Gender(models.TextChoices):
        MALE = 'male', 'آقا'
        FEMALE = 'female', 'خانم'

    class MaritalStatus(models.TextChoices):
        SINGLE = 'single', 'مجرد'
        MARRIED = 'married', 'متاهل'

    phone = PhoneNumberField(unique=True, verbose_name='شماره موبایل')
    full_name = models.CharField(max_length=100, blank=True, verbose_name='نام کامل')
    email = models.EmailField(blank=True, verbose_name='ایمیل')
    avatar = models.ImageField(upload_to='avatars/', blank=True, null=True, verbose_name='تصویر پروفایل')
    gender = models.CharField(max_length=10, choices=Gender.choices, blank=True, verbose_name='جنسیت')
    marital_status = models.CharField(max_length=10, choices=MaritalStatus.choices, blank=True, verbose_name='وضعیت تأهل')
    food_interests = models.CharField(max_length=255, blank=True, verbose_name='علایق غذایی')
    is_active = models.BooleanField(default=True, verbose_name='فعال')
    is_staff = models.BooleanField(default=False, verbose_name='کارمند')
    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.CUSTOMER,
        verbose_name='نقش',
    )
    birthday = models.DateField(null=True, blank=True, verbose_name='تاریخ تولد')
    birthday_set_at = models.DateTimeField(null=True, blank=True, verbose_name='زمان ثبت تاریخ تولد')
    date_joined = models.DateTimeField(auto_now_add=True, verbose_name='تاریخ عضویت')
    updated_at = models.DateTimeField(auto_now=True)

    objects = UserManager()

    USERNAME_FIELD = 'phone'
    REQUIRED_FIELDS = []

    class Meta:
        verbose_name = 'کاربر'
        verbose_name_plural = 'کاربران'

    def __str__(self):
        return str(self.phone)

    def save(self, *args, **kwargs):
        if self.avatar and not self.avatar._committed:
            processed, _ = process_image(self.avatar.file, max_dimension=600, base_name=self.avatar.name)
            self.avatar = processed
        super().save(*args, **kwargs)

    @property
    def is_admin(self):
        return self.is_staff

    @property
    def is_waiter(self):
        return self.role == self.Role.WAITER


class WaiterPermission(models.Model):
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name='waiter_permissions',
        verbose_name='کاربر',
    )
    can_manage_orders = models.BooleanField(default=True, verbose_name='مدیریت سفارشات')
    can_manage_reservations = models.BooleanField(default=False, verbose_name='مدیریت رزروها')
    can_manage_tables = models.BooleanField(default=False, verbose_name='مدیریت میزها')
    can_manage_menu_availability = models.BooleanField(default=False, verbose_name='مدیریت موجودی منو')
    can_force_close_cafe = models.BooleanField(default=False, verbose_name='بستن فوری کافه')
    can_view_own_performance = models.BooleanField(default=False, verbose_name='مشاهده عملکرد خود')

    class Meta:
        verbose_name = 'دسترسی سرپرست سالن'
        verbose_name_plural = 'دسترسی‌های سرپرست سالن'

    def __str__(self):
        return f'دسترسی‌های {self.user}'


class Address(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='addresses', verbose_name='کاربر')
    title = models.CharField(max_length=50, verbose_name='عنوان آدرس')
    province = models.CharField(max_length=50, blank=True, verbose_name='استان')
    city = models.CharField(max_length=50, verbose_name='شهر')
    street = models.CharField(max_length=200, verbose_name='خیابان')
    detail = models.TextField(blank=True, verbose_name='جزئیات آدرس')
    postal_code = models.CharField(max_length=10, blank=True, verbose_name='کد پستی')
    is_default = models.BooleanField(default=False, verbose_name='آدرس پیش‌فرض')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'آدرس'
        verbose_name_plural = 'آدرس‌ها'

    def __str__(self):
        return f'{self.user} - {self.title}'

    def save(self, *args, **kwargs):
        if self.is_default:
            Address.objects.filter(user=self.user, is_default=True).update(is_default=False)
        super().save(*args, **kwargs)
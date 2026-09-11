from rest_framework import serializers
from django.conf import settings
from .models import User, Address, WaiterPermission


def _normalize_phone(value: str) -> str:
    value = value.strip().replace(' ', '')
    if not value.startswith('+98') and not value.startswith('09'):
        raise serializers.ValidationError('فرمت شماره موبایل صحیح نیست (مثال: 09123456789)')
    if value.startswith('09'):
        value = '+98' + value[1:]
    return value


class SendOTPSerializer(serializers.Serializer):
    phone = serializers.CharField(max_length=15)

    def validate_phone(self, value):
        return _normalize_phone(value)


class VerifyOTPSerializer(serializers.Serializer):
    phone = serializers.CharField(max_length=15)
    otp = serializers.CharField(max_length=6, min_length=6)

    def validate_phone(self, value):
        return _normalize_phone(value)


# ─── Auth جدید: ثبت‌نام / ورود / فراموشی رمز ────────────────────────────────

class RegisterSerializer(serializers.Serializer):
    phone = serializers.CharField(max_length=15)

    def validate_phone(self, value):
        value = _normalize_phone(value)
        user = User.objects.filter(phone=value).first()
        if user and user.has_usable_password():
            raise serializers.ValidationError('این شماره قبلاً ثبت‌نام کرده — وارد شوید یا رمز را فراموش کرده‌اید؟')
        return value


class RegisterVerifySerializer(serializers.Serializer):
    phone = serializers.CharField(max_length=15)
    otp = serializers.CharField(max_length=6, min_length=6)
    password = serializers.CharField(min_length=8, write_only=True)
    password_confirm = serializers.CharField(min_length=8, write_only=True)

    def validate_phone(self, value):
        return _normalize_phone(value)

    def validate(self, data):
        if data['password'] != data['password_confirm']:
            raise serializers.ValidationError({'password_confirm': 'رمز عبور با تکرار آن مطابقت ندارد'})
        return data


class LoginSerializer(serializers.Serializer):
    phone = serializers.CharField(max_length=15)
    password = serializers.CharField(write_only=True)

    def validate_phone(self, value):
        return _normalize_phone(value)


class ForgotPasswordSerializer(serializers.Serializer):
    phone = serializers.CharField(max_length=15)

    def validate_phone(self, value):
        value = _normalize_phone(value)
        if not User.objects.filter(phone=value).exists():
            raise serializers.ValidationError('کاربری با این شماره یافت نشد')
        return value


class ResetPasswordSerializer(serializers.Serializer):
    phone = serializers.CharField(max_length=15)
    otp = serializers.CharField(max_length=6, min_length=6)
    password = serializers.CharField(min_length=8, write_only=True)
    password_confirm = serializers.CharField(min_length=8, write_only=True)

    def validate_phone(self, value):
        return _normalize_phone(value)

    def validate(self, data):
        if data['password'] != data['password_confirm']:
            raise serializers.ValidationError({'password_confirm': 'رمز عبور با تکرار آن مطابقت ندارد'})
        return data


class ChangePasswordSerializer(serializers.Serializer):
    """تغییر رمز عبور برای کاربر لاگین‌شده. current_password اختیاری است چون
    کاربرانی که اصلاً رمز ندارند (فقط با OTP وارد شده‌اند) باید بتوانند
    بدون آن، اولین رمز خود را تنظیم کنند."""
    current_password = serializers.CharField(write_only=True, required=False, allow_blank=True)
    password = serializers.CharField(min_length=8, write_only=True)
    password_confirm = serializers.CharField(min_length=8, write_only=True)

    def validate(self, data):
        if data['password'] != data['password_confirm']:
            raise serializers.ValidationError({'password_confirm': 'رمز عبور جدید با تکرار آن مطابقت ندارد'})
        return data


class WaiterPermissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = WaiterPermission
        fields = [
            'can_manage_orders', 'can_manage_reservations', 'can_manage_tables',
            'can_manage_menu_availability', 'can_force_close_cafe', 'can_view_own_performance',
        ]


class UserSerializer(serializers.ModelSerializer):
    phone = serializers.SerializerMethodField()
    has_password = serializers.SerializerMethodField()
    waiter_permissions = WaiterPermissionSerializer(read_only=True)

    class Meta:
        model = User
        fields = [
            'id', 'phone', 'full_name', 'email', 'avatar', 'is_staff', 'role',
            'waiter_permissions', 'birthday', 'birthday_set_at', 'date_joined',
            'gender', 'marital_status', 'food_interests', 'has_password',
        ]
        read_only_fields = ['id', 'phone', 'is_staff', 'date_joined', 'birthday_set_at']

    def get_phone(self, obj):
        return str(obj.phone)

    def get_has_password(self, obj):
        return obj.has_usable_password()


class UserUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['full_name', 'email', 'avatar', 'birthday', 'gender', 'marital_status', 'food_interests']

    def validate_birthday(self, value):
        if value is None:
            return value
        instance = self.instance
        if instance and instance.birthday is not None:
            raise serializers.ValidationError('تاریخ تولد قبلاً ثبت شده و قابل تغییر نیست')
        return value

    def update(self, instance, validated_data):
        from django.utils import timezone
        if 'birthday' in validated_data and validated_data['birthday'] is not None:
            validated_data['birthday_set_at'] = timezone.now()
        return super().update(instance, validated_data)


class AdminUserSerializer(serializers.ModelSerializer):
    phone = serializers.SerializerMethodField()
    waiter_permissions = WaiterPermissionSerializer(read_only=True)
    has_password = serializers.SerializerMethodField()
    # این سه فیلد فقط وقتی queryset با annotate_customer_stats() ساخته شده باشد پر
    # می‌شوند (مثلاً لیست کاربران)؛ در غیر این صورت None برمی‌گردند نه خطا
    orders_count = serializers.SerializerMethodField()
    total_spent = serializers.SerializerMethodField()
    last_order_at = serializers.SerializerMethodField()
    wallet_balance = serializers.SerializerMethodField()
    tier = serializers.SerializerMethodField()
    active_discount_codes_count = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'phone', 'full_name', 'email', 'role', 'is_staff', 'is_active', 'date_joined',
            'waiter_permissions', 'birthday', 'birthday_set_at', 'gender', 'marital_status', 'food_interests',
            'has_password', 'admin_note', 'orders_count', 'total_spent', 'last_order_at', 'wallet_balance', 'tier',
            'active_discount_codes_count',
        ]
        read_only_fields = ['id', 'phone', 'date_joined', 'has_password']

    def get_orders_count(self, obj):
        return getattr(obj, 'orders_count', None)

    def get_total_spent(self, obj):
        return getattr(obj, 'total_spent', None)

    def get_last_order_at(self, obj):
        value = getattr(obj, 'last_order_at', None)
        return value.isoformat() if value else None

    def get_wallet_balance(self, obj):
        # None یعنی «این queryset اصلاً annotate نشده» (مثلاً retrieve تکی)، نه اینکه موجودی صفر است
        value = getattr(obj, 'wallet_balance', None)
        return None if not hasattr(obj, 'wallet_balance') else (value or 0)

    def get_tier(self, obj):
        if not hasattr(obj, 'orders_count'):
            return None
        from .customer_insights import tier_for
        return tier_for(obj.orders_count, obj.total_spent)

    def get_active_discount_codes_count(self, obj):
        # فقط وقتی annotate شده مقدار دارد (مثلاً لیست مشتریان در معرض ریزش) — تا
        # ادمین قبل از کلیک روی «کدهای تخفیف» بداند از قبل چند کد فعال دارد
        return getattr(obj, 'active_discount_codes_count', None)

    def get_phone(self, obj):
        return str(obj.phone)

    def get_has_password(self, obj):
        return obj.has_usable_password()

    def update(self, instance, validated_data):
        new_role = validated_data.get('role', instance.role)

        # Sync is_staff and WaiterPermission based on role
        if new_role == User.Role.ADMIN:
            validated_data['is_staff'] = True
            WaiterPermission.objects.filter(user=instance).delete()
        elif new_role == User.Role.WAITER:
            validated_data['is_staff'] = False
            WaiterPermission.objects.get_or_create(user=instance)
        else:  # customer
            validated_data['is_staff'] = False
            WaiterPermission.objects.filter(user=instance).delete()

        return super().update(instance, validated_data)


class AddressSerializer(serializers.ModelSerializer):
    class Meta:
        model = Address
        fields = '__all__'
        read_only_fields = ['user', 'created_at']

    def validate(self, data):
        # مختصات نقشه اجباری است — بدون آن سفارش پیک (apps.snapp) اصلاً امکان ثبت
        # مقصد واقعی ندارد؛ چک روی حاصل نهایی (instance موجود + داده‌ی جدید) انجام
        # می‌شود تا PATCH جزئی هم نتواند یک آدرس را بدون مختصات باقی بگذارد
        latitude = data.get('latitude', getattr(self.instance, 'latitude', ''))
        longitude = data.get('longitude', getattr(self.instance, 'longitude', ''))
        if not latitude or not longitude:
            raise serializers.ValidationError('لطفاً موقعیت آدرس را روی نقشه مشخص کنید')

        # جلوگیری از ثبت آدرس در شهر/منطقه‌ای خیلی دور از کافه — عملاً غیرقابل‌تحویل
        # با پیک است. فقط وقتی مبدا و شعاع در تنظیمات اسنپ‌باکس مشخص شده باشد چک می‌شود
        from apps.snapp.models import SnappSettings
        from apps.common.utils import haversine_distance_km

        snapp_settings = SnappSettings.get_settings()
        if snapp_settings.store_latitude and snapp_settings.store_longitude:
            distance = haversine_distance_km(
                snapp_settings.store_latitude, snapp_settings.store_longitude, latitude, longitude,
            )
            if distance > snapp_settings.max_delivery_radius_km:
                raise serializers.ValidationError(
                    f'موقعیت انتخاب‌شده حدود {round(distance)} کیلومتر با کافه فاصله دارد — '
                    f'فقط آدرس‌های تا {snapp_settings.max_delivery_radius_km} کیلومتری قابل ثبت هستند'
                )
        return data

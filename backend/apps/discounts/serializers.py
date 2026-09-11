from django.utils import timezone
from rest_framework import serializers
from .models import Discount, DiscountUsage, WinBackSettings


class DiscountCheckSerializer(serializers.Serializer):
    code = serializers.CharField()
    order_total = serializers.IntegerField(min_value=0)


class DiscountSerializer(serializers.ModelSerializer):
    class Meta:
        model = Discount
        fields = '__all__'


class DiscountUsageSerializer(serializers.ModelSerializer):
    discount_code = serializers.CharField(source='discount.code', read_only=True)
    discount_type = serializers.CharField(source='discount.discount_type', read_only=True)
    discount_value = serializers.IntegerField(source='discount.value', read_only=True)
    # order_id عمداً ForeignKey نیست (تا با حذف احتمالی سفارش گم نشود) — پس این دو فیلد
    # توسط ویو (نه ORM) از روی Order.objects.filter(id__in=...) پر می‌شوند
    order_number = serializers.SerializerMethodField()
    order_discount_amount = serializers.SerializerMethodField()

    class Meta:
        model = DiscountUsage
        fields = [
            'id', 'discount_code', 'discount_type', 'discount_value',
            'order_id', 'order_number', 'order_discount_amount', 'used_at',
        ]
        read_only_fields = fields

    def get_order_number(self, obj):
        return self.context.get('order_lookup', {}).get(obj.order_id, {}).get('order_number')

    def get_order_discount_amount(self, obj):
        return self.context.get('order_lookup', {}).get(obj.order_id, {}).get('discount_amount')


class UserAssignedDiscountSerializer(serializers.ModelSerializer):
    """برای مودال «کدهای تخفیف» یک مشتری خاص — وضعیت واقعی هر کد (استفاده‌شده/
    منقضی/فعال) و روزهای باقی‌مانده، تا ادمین قبل از ارسال دوباره‌ی پیام دلتنگی
    تصمیم بگیرد که کد قبلی هنوز زنده است یا نه."""
    status = serializers.SerializerMethodField()
    days_remaining = serializers.SerializerMethodField()

    class Meta:
        model = Discount
        fields = [
            'id', 'code', 'discount_type', 'value', 'is_active',
            'valid_from', 'valid_until', 'status', 'days_remaining', 'created_at',
        ]
        read_only_fields = fields

    def get_status(self, obj):
        used_ids = self.context.get('used_discount_ids', set())
        if obj.id in used_ids:
            return 'used'
        if not obj.is_active or timezone.now() > obj.valid_until:
            return 'expired'
        return 'active'

    def get_days_remaining(self, obj):
        delta = obj.valid_until - timezone.now()
        return max(delta.days, 0)


class WinBackSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = WinBackSettings
        fields = ['discount_type', 'value', 'max_discount_amount', 'valid_days']

    def validate(self, attrs):
        discount_type = attrs.get('discount_type', getattr(self.instance, 'discount_type', None))
        value = attrs.get('value', getattr(self.instance, 'value', None))
        if discount_type == Discount.DiscountType.PERCENTAGE and value is not None and value > 100:
            raise serializers.ValidationError({'value': 'درصد تخفیف نمی‌تواند بیشتر از ۱۰۰ باشد'})
        return attrs
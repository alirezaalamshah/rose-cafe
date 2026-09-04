from rest_framework import serializers
from .models import Discount, DiscountUsage


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
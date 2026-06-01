from rest_framework import serializers
from .models import Discount


class DiscountCheckSerializer(serializers.Serializer):
    code = serializers.CharField()
    order_total = serializers.IntegerField(min_value=0)


class DiscountSerializer(serializers.ModelSerializer):
    class Meta:
        model = Discount
        fields = '__all__'
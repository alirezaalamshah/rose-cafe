from rest_framework import serializers
from .models import Payment


class PaymentRequestSerializer(serializers.Serializer):
    order_id = serializers.IntegerField()
    callback_url = serializers.URLField(required=False)


class PaymentSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    order_id = serializers.IntegerField(source='order.id', read_only=True)
    order_number = serializers.CharField(source='order.order_number', read_only=True)

    class Meta:
        model = Payment
        fields = [
            'id', 'order_id', 'order_number', 'amount', 'status', 'status_display',
            'ref_id', 'authority', 'description', 'created_at',
        ]
        read_only_fields = fields
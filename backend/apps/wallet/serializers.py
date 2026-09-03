from rest_framework import serializers
from .models import Wallet, WalletTransaction, WalletTopup, LoyaltySettings


class WalletSerializer(serializers.ModelSerializer):
    class Meta:
        model = Wallet
        fields = ['balance']
        read_only_fields = fields


class WalletTransactionSerializer(serializers.ModelSerializer):
    type_display = serializers.CharField(source='get_type_display', read_only=True)
    order_number = serializers.CharField(source='order.order_number', read_only=True, default=None)

    class Meta:
        model = WalletTransaction
        fields = [
            'id', 'type', 'type_display', 'amount', 'balance_after',
            'order', 'order_number', 'description', 'created_at',
        ]
        read_only_fields = fields


class WalletTopupRequestSerializer(serializers.Serializer):
    amount = serializers.IntegerField(min_value=10000)
    callback_url = serializers.URLField(required=False)


class WalletTopupSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = WalletTopup
        fields = ['id', 'amount', 'status', 'status_display', 'ref_id', 'created_at']
        read_only_fields = fields


class LoyaltySettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = LoyaltySettings
        fields = ['is_enabled', 'cashback_percentage', 'min_order_amount']

    def validate_cashback_percentage(self, value):
        if value > 100:
            raise serializers.ValidationError('درصد بازگشت وجه نمی‌تواند بیشتر از ۱۰۰ باشد')
        return value

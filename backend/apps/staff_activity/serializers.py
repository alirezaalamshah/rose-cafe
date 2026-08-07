from rest_framework import serializers
from .models import StaffActionLog


class StaffActionLogSerializer(serializers.ModelSerializer):
    user_name = serializers.SerializerMethodField()
    user_phone = serializers.SerializerMethodField()
    action_display = serializers.CharField(source='get_action_display', read_only=True)
    order_number = serializers.SerializerMethodField()

    class Meta:
        model = StaffActionLog
        fields = [
            'id', 'user_name', 'user_phone', 'action', 'action_display',
            'order', 'order_number', 'reservation',
            'detail', 'created_at',
        ]

    def get_user_name(self, obj):
        if not obj.user:
            return 'کاربر حذف‌شده'
        return obj.user.full_name or str(obj.user.phone)

    def get_user_phone(self, obj):
        return str(obj.user.phone) if obj.user else ''

    def get_order_number(self, obj):
        return obj.order.order_number if obj.order else None

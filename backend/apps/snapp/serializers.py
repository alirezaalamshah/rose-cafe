from rest_framework import serializers
from .models import SnappSettings, SnappCourierOrder


class SnappSettingsSerializer(serializers.ModelSerializer):
    circuit_breaker_tripped = serializers.BooleanField(read_only=True)

    class Meta:
        model = SnappSettings
        fields = [
            'is_enabled', 'dispatch_mode', 'default_delivery_category', 'store_city',
            'store_address', 'store_latitude', 'store_longitude',
            'store_contact_name', 'store_contact_phone', 'max_delivery_radius_km',
            'circuit_breaker_max_failures', 'circuit_breaker_window_minutes',
            'circuit_breaker_tripped', 'circuit_breaker_tripped_at',
        ]
        read_only_fields = ['circuit_breaker_tripped_at']


class SnappCourierOrderSerializer(serializers.ModelSerializer):
    status_label = serializers.CharField(source='get_status_display', read_only=True)
    is_trackable = serializers.BooleanField(read_only=True)
    is_terminal = serializers.BooleanField(read_only=True)

    class Meta:
        model = SnappCourierOrder
        fields = [
            'id', 'snapp_order_id', 'status', 'status_label', 'tracking_url',
            'delivery_fare', 'biker_name', 'biker_phone', 'biker_photo_url',
            'cancel_reason', 'retry_count', 'is_trackable', 'is_terminal',
            'current_latitude', 'current_longitude', 'location_updated_at',
            'dispatched_at', 'last_webhook_at',
        ]

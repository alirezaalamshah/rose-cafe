from rest_framework import serializers
from apps.common.image_processing import validate_image_size
from .models import (
    BusinessHours, SpecialDay, DeliverySettings, CafeInfo,
    ReservationSettings, Banner, SocialLink, WEEKDAY_NAMES,
)


class BusinessHoursSerializer(serializers.ModelSerializer):
    day_name = serializers.SerializerMethodField()

    class Meta:
        model = BusinessHours
        fields = ['id', 'day_of_week', 'day_name', 'is_open', 'open_time', 'close_time']

    def get_day_name(self, obj):
        return WEEKDAY_NAMES.get(obj.day_of_week, '')


class SpecialDaySerializer(serializers.ModelSerializer):
    class Meta:
        model = SpecialDay
        fields = ['id', 'date', 'is_closed', 'open_time', 'close_time', 'note', 'created_at']
        read_only_fields = ['created_at']

    def validate(self, data):
        is_closed = data.get('is_closed', getattr(self.instance, 'is_closed', True))
        if not is_closed:
            if not data.get('open_time') and not getattr(self.instance, 'open_time', None):
                raise serializers.ValidationError('برای روز باز با ساعت خاص، ساعت باز شدن الزامی است')
            if not data.get('close_time') and not getattr(self.instance, 'close_time', None):
                raise serializers.ValidationError('برای روز باز با ساعت خاص، ساعت بسته شدن الزامی است')
        return data


class DeliverySettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = DeliverySettings
        fields = [
            'delivery_cost', 'free_delivery_threshold',
            'takeaway_packaging_cost', 'delivery_packaging_cost',
        ]


class CafeInfoSerializer(serializers.ModelSerializer):
    class Meta:
        model = CafeInfo
        fields = ['name', 'tagline', 'phone', 'address']


class SocialLinkSerializer(serializers.ModelSerializer):
    platform_display = serializers.CharField(source='get_platform_display', read_only=True)
    url = serializers.CharField(read_only=True)

    class Meta:
        model = SocialLink
        fields = ['id', 'platform', 'platform_display', 'account', 'url', 'order', 'is_active']

    def validate_account(self, value):
        if not value.strip():
            raise serializers.ValidationError('آیدی/اکانت نمی‌تواند خالی باشد')
        return value


class ReservationSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReservationSettings
        fields = ['max_reservation_hours']


class BannerSerializer(serializers.ModelSerializer):
    """نمایش عمومی — فقط فیلدهای لازم برای اسلایدر"""
    class Meta:
        model = Banner
        fields = ['id', 'image', 'focal_x', 'focal_y', 'title', 'link']


class BannerAdminSerializer(serializers.ModelSerializer):
    class Meta:
        model = Banner
        fields = '__all__'

    def validate_image(self, value):
        return validate_image_size(value)

    def validate(self, data):
        start = data.get('start_date', getattr(self.instance, 'start_date', None))
        end = data.get('end_date', getattr(self.instance, 'end_date', None))
        if start and end and start > end:
            raise serializers.ValidationError({'end_date': 'تاریخ پایان باید بعد از تاریخ شروع باشد'})
        return data

from rest_framework import serializers
from django.utils import timezone
from .models import Table, Reservation


class TableSerializer(serializers.ModelSerializer):
    location_display = serializers.CharField(source='get_location_display', read_only=True)

    class Meta:
        model = Table
        fields = ['id', 'number', 'capacity', 'location', 'location_display', 'description']


class ReservationSerializer(serializers.ModelSerializer):
    table_detail = TableSerializer(source='table', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    user_phone = serializers.CharField(source='user.phone', read_only=True)

    class Meta:
        model = Reservation
        fields = [
            'id', 'table', 'table_detail', 'date', 'start_time', 'end_time',
            'guests_count', 'status', 'status_display', 'note',
            'user_phone', 'created_at',
        ]
        read_only_fields = ['status', 'created_at', 'user_phone']

    def validate_date(self, value):
        if value < timezone.now().date():
            raise serializers.ValidationError('تاریخ رزرو نمیتواند در گذشته باشد')
        return value

    def validate(self, data):
        if data.get('start_time') and data.get('end_time'):
            if data['start_time'] >= data['end_time']:
                raise serializers.ValidationError('ساعت پایان باید بعد از ساعت شروع باشد')
        return data


class ReservationCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Reservation
        fields = ['table', 'date', 'start_time', 'end_time', 'guests_count', 'note']

    def validate_date(self, value):
        if value < timezone.now().date():
            raise serializers.ValidationError('تاریخ رزرو نمیتواند در گذشته باشد')
        return value

    def validate(self, data):
        if data.get('start_time') and data.get('end_time'):
            if data['start_time'] >= data['end_time']:
                raise serializers.ValidationError('ساعت پایان باید بعد از ساعت شروع باشد')

        table = data.get('table')
        guests = data.get('guests_count')
        if table and guests and guests > table.capacity:
            raise serializers.ValidationError(
                f'ظرفیت میز {table.capacity} نفر است'
            )
        return data


class AvailableTablesSerializer(serializers.Serializer):
    date = serializers.DateField()
    start_time = serializers.TimeField()
    end_time = serializers.TimeField()
    guests_count = serializers.IntegerField(min_value=1)


class AdminReservationSerializer(serializers.ModelSerializer):
    table_detail = TableSerializer(source='table', read_only=True)
    user_phone = serializers.CharField(source='user.phone', read_only=True)
    user_name = serializers.CharField(source='user.full_name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = Reservation
        fields = '__all__'
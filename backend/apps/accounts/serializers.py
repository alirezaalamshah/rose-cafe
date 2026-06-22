from rest_framework import serializers
from django.conf import settings
from .models import User, Address


class SendOTPSerializer(serializers.Serializer):
    phone = serializers.CharField(max_length=15)

    def validate_phone(self, value):
        value = value.strip().replace(' ', '')
        if not value.startswith('+98') and not value.startswith('09'):
            raise serializers.ValidationError('فرمت شماره موبایل صحیح نیست')
        if value.startswith('09'):
            value = '+98' + value[1:]
        return value


class VerifyOTPSerializer(serializers.Serializer):
    phone = serializers.CharField(max_length=15)
    otp = serializers.CharField(max_length=6, min_length=6)

    def validate_phone(self, value):
        value = value.strip().replace(' ', '')
        if value.startswith('09'):
            value = '+98' + value[1:]
        return value


class UserSerializer(serializers.ModelSerializer):
    phone = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'phone', 'full_name', 'email', 'avatar', 'date_joined']
        read_only_fields = ['id', 'phone', 'date_joined']

    def get_phone(self, obj):
        return str(obj.phone)


class UserUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['full_name', 'email', 'avatar']


class AddressSerializer(serializers.ModelSerializer):
    class Meta:
        model = Address
        fields = '__all__'
        read_only_fields = ['user', 'created_at']
from rest_framework import serializers
from .models import Review, CafeReview


class ReviewSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='user.full_name', read_only=True)
    user_phone = serializers.SerializerMethodField()
    menu_item_name = serializers.CharField(source='menu_item.name', read_only=True)

    class Meta:
        model = Review
        fields = [
            'id', 'user_name', 'user_phone', 'menu_item', 'menu_item_name',
            'rating', 'comment', 'is_approved', 'created_at',
        ]
        read_only_fields = ['is_approved', 'created_at', 'user_name', 'user_phone']

    def get_user_phone(self, obj):
        phone = str(obj.user.phone)
        # فقط ۴ رقم آخر نشون بده
        return f'*******{phone[-4:]}'


class ReviewCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Review
        fields = ['menu_item', 'rating', 'comment']

    def validate_rating(self, value):
        if not 1 <= value <= 5:
            raise serializers.ValidationError('امتیاز باید بین ۱ تا ۵ باشد')
        return value

    def validate(self, data):
        request = self.context.get('request')
        if request and Review.objects.filter(
            user=request.user,
            menu_item=data['menu_item']
        ).exists():
            raise serializers.ValidationError('شما قبلاً برای این آیتم نظر ثبت کرده‌اید')
        return data


class CafeReviewSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='user.full_name', read_only=True)
    user_phone = serializers.SerializerMethodField()

    class Meta:
        model = CafeReview
        fields = ['id', 'user_name', 'user_phone', 'rating', 'comment', 'created_at']
        read_only_fields = ['created_at', 'user_name', 'user_phone']

    def get_user_phone(self, obj):
        phone = str(obj.user.phone)
        return f'*******{phone[-4:]}'


class CafeReviewCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = CafeReview
        fields = ['rating', 'comment']

    def validate(self, data):
        request = self.context.get('request')
        if request and CafeReview.objects.filter(user=request.user).exists():
            raise serializers.ValidationError('شما قبلاً نظر خود را ثبت کرده‌اید')
        return data


class AdminReviewSerializer(serializers.ModelSerializer):
    user_phone = serializers.CharField(source='user.phone', read_only=True)
    menu_item_name = serializers.CharField(source='menu_item.name', read_only=True)

    class Meta:
        model = Review
        fields = '__all__'


class AdminCafeReviewSerializer(serializers.ModelSerializer):
    user_phone = serializers.CharField(source='user.phone', read_only=True)

    class Meta:
        model = CafeReview
        fields = '__all__'
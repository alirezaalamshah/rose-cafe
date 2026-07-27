from rest_framework import serializers
from apps.common.image_processing import validate_image_size
from .models import Category, MenuItem, MenuItemImage, MenuItemVariant, MenuItemAddon


class CategorySerializer(serializers.ModelSerializer):
    # روی get_queryset() ویو annotate می‌شود (بدون کوئری جدا به‌ازای هر دسته)
    item_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Category
        fields = ['id', 'name', 'slug', 'icon', 'image', 'description', 'order', 'item_count']


class MenuItemVariantSerializer(serializers.ModelSerializer):
    final_price = serializers.SerializerMethodField()
    has_discount = serializers.SerializerMethodField()

    class Meta:
        model = MenuItemVariant
        fields = ['id', 'name', 'price', 'discounted_price', 'final_price', 'has_discount', 'is_available', 'order']

    def get_final_price(self, obj):
        return obj.discounted_price if obj.discounted_price else obj.price

    def get_has_discount(self, obj):
        return bool(obj.discounted_price and obj.discounted_price < obj.price)


class MenuItemAddonSerializer(serializers.ModelSerializer):
    class Meta:
        model = MenuItemAddon
        fields = ['id', 'name', 'price', 'is_available', 'order']


class MenuItemImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = MenuItemImage
        fields = ['id', 'image', 'image_thumbnail', 'order']

    def validate_image(self, value):
        return validate_image_size(value)


class MenuItemListSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)
    final_price = serializers.IntegerField(read_only=True)
    has_discount = serializers.BooleanField(read_only=True)
    average_rating = serializers.FloatField(read_only=True)
    review_count = serializers.IntegerField(read_only=True)
    variants = MenuItemVariantSerializer(many=True, read_only=True)
    addons = MenuItemAddonSerializer(many=True, read_only=True)

    class Meta:
        model = MenuItem
        fields = [
            'id', 'name', 'slug', 'category', 'category_name',
            'description', 'price', 'discounted_price', 'final_price',
            'has_discount', 'image', 'image_thumbnail', 'status', 'is_featured',
            'is_vegetarian', 'calories', 'preparation_time',
            'average_rating', 'review_count', 'variants', 'addons',
        ]


class MenuItemDetailSerializer(MenuItemListSerializer):
    extra_images = MenuItemImageSerializer(many=True, read_only=True)

    class Meta(MenuItemListSerializer.Meta):
        fields = MenuItemListSerializer.Meta.fields + ['extra_images', 'created_at']


class MenuItemAdminSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)
    variants = MenuItemVariantSerializer(many=True, read_only=True)
    addons = MenuItemAddonSerializer(many=True, read_only=True)

    class Meta:
        model = MenuItem
        fields = '__all__'
        read_only_fields = ['image_thumbnail']

    def validate_image(self, value):
        return validate_image_size(value)


class CategoryAdminSerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = '__all__'

    def validate_image(self, value):
        return validate_image_size(value)

from rest_framework import serializers
from .models import Category, MenuItem, MenuItemImage, MenuItemVariant


class CategorySerializer(serializers.ModelSerializer):
    item_count = serializers.SerializerMethodField()

    class Meta:
        model = Category
        fields = ['id', 'name', 'slug', 'icon', 'image', 'description', 'order', 'item_count']

    def get_item_count(self, obj):
        return obj.items.filter(status=MenuItem.Status.AVAILABLE).count()


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


class MenuItemImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = MenuItemImage
        fields = ['id', 'image', 'order']


class MenuItemListSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)
    final_price = serializers.IntegerField(read_only=True)
    has_discount = serializers.BooleanField(read_only=True)
    average_rating = serializers.FloatField(read_only=True)
    review_count = serializers.IntegerField(read_only=True)
    variants = MenuItemVariantSerializer(many=True, read_only=True)

    class Meta:
        model = MenuItem
        fields = [
            'id', 'name', 'slug', 'category', 'category_name',
            'description', 'price', 'discounted_price', 'final_price',
            'has_discount', 'image', 'status', 'is_featured',
            'is_vegetarian', 'calories', 'preparation_time',
            'average_rating', 'review_count', 'variants',
        ]


class MenuItemDetailSerializer(MenuItemListSerializer):
    extra_images = MenuItemImageSerializer(many=True, read_only=True)

    class Meta(MenuItemListSerializer.Meta):
        fields = MenuItemListSerializer.Meta.fields + ['extra_images', 'created_at']


class MenuItemAdminSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)
    variants = MenuItemVariantSerializer(many=True, read_only=True)

    class Meta:
        model = MenuItem
        fields = '__all__'


class CategoryAdminSerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = '__all__'

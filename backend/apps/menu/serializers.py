from rest_framework import serializers
from .models import Category, MenuItem, MenuItemImage


class CategorySerializer(serializers.ModelSerializer):
    item_count = serializers.SerializerMethodField()

    class Meta:
        model = Category
        fields = ['id', 'name', 'slug', 'icon', 'image', 'description', 'order', 'item_count']

    def get_item_count(self, obj):
        return obj.items.filter(status=MenuItem.Status.AVAILABLE).count()


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

    class Meta:
        model = MenuItem
        fields = [
            'id', 'name', 'slug', 'category', 'category_name',
            'description', 'price', 'discounted_price', 'final_price',
            'has_discount', 'image', 'status', 'is_featured',
            'is_vegetarian', 'calories', 'preparation_time',
            'average_rating', 'review_count',
        ]


class MenuItemDetailSerializer(MenuItemListSerializer):
    extra_images = MenuItemImageSerializer(many=True, read_only=True)

    class Meta(MenuItemListSerializer.Meta):
        fields = MenuItemListSerializer.Meta.fields + ['extra_images', 'created_at']


class MenuItemAdminSerializer(serializers.ModelSerializer):
    class Meta:
        model = MenuItem
        fields = '__all__'


class CategoryAdminSerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = '__all__'
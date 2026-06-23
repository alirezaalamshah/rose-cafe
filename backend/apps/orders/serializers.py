from rest_framework import serializers
from .models import Order, OrderItem
from apps.menu.models import MenuItem
from apps.menu.serializers import MenuItemListSerializer
from apps.accounts.serializers import AddressSerializer
from apps.discounts.utils import apply_discount


class OrderItemSerializer(serializers.ModelSerializer):
    menu_item_detail = MenuItemListSerializer(source='menu_item', read_only=True)
    subtotal = serializers.IntegerField(read_only=True)

    class Meta:
        model = OrderItem
        fields = ['id', 'menu_item', 'menu_item_detail', 'quantity', 'unit_price', 'subtotal', 'variant_name']
        read_only_fields = ['unit_price', 'variant_name']


class OrderItemCreateSerializer(serializers.Serializer):
    menu_item = serializers.PrimaryKeyRelatedField(queryset=MenuItem.objects.all())
    quantity = serializers.IntegerField(min_value=1, max_value=20)
    variant_id = serializers.IntegerField(required=False, allow_null=True)


class OrderCreateSerializer(serializers.Serializer):
    items = OrderItemCreateSerializer(many=True)
    delivery_type = serializers.ChoiceField(choices=Order.DeliveryType.choices)
    address = serializers.IntegerField(required=False, allow_null=True)
    note = serializers.CharField(required=False, allow_blank=True)
    discount_code = serializers.CharField(required=False, allow_blank=True)

    def validate(self, data):
        if data.get('delivery_type') == Order.DeliveryType.DELIVERY and not data.get('address'):
            raise serializers.ValidationError('برای ارسال با پیک، آدرس الزامی است')
        if not data.get('items'):
            raise serializers.ValidationError('حداقل یک آیتم باید انتخاب شود')
        return data


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    address_detail = AddressSerializer(source='address', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    delivery_type_display = serializers.CharField(source='get_delivery_type_display', read_only=True)

    class Meta:
        model = Order
        fields = [
            'id', 'status', 'status_display', 'delivery_type',
            'delivery_type_display', 'address', 'address_detail',
            'note', 'total_price', 'delivery_cost', 'discount_amount',
            'final_price', 'discount_code', 'items', 'created_at',
        ]


class AdminOrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    user_phone = serializers.CharField(source='user.phone', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = Order
        fields = '__all__'


class OrderStatusUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Order
        fields = ['status']
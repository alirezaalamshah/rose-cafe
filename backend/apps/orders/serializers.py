from rest_framework import serializers
from .models import Order, OrderItem, OrderItemAddon
from apps.menu.models import MenuItem
from apps.accounts.serializers import AddressSerializer
from apps.discounts.utils import apply_discount
from apps.reservations.models import Table


class OrderItemAddonSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderItemAddon
        fields = ['id', 'name', 'price']


class OrderMenuItemSerializer(serializers.ModelSerializer):
    """
    نسخه‌ی سبک منو برای نمایش داخل سفارش — چون قیمت/نوع/افزودنی واقعی همان لحظه‌ی سفارش
    در خود OrderItem (unit_price, variant_name, addons) اسنپ‌شات شده، نیازی به variants/addons/rating نیست.
    """
    class Meta:
        model = MenuItem
        fields = ['id', 'name', 'slug', 'image', 'image_thumbnail']


class OrderItemSerializer(serializers.ModelSerializer):
    menu_item_detail = OrderMenuItemSerializer(source='menu_item', read_only=True)
    subtotal = serializers.IntegerField(read_only=True)
    addons = OrderItemAddonSerializer(many=True, read_only=True)

    class Meta:
        model = OrderItem
        fields = ['id', 'menu_item', 'menu_item_detail', 'quantity', 'unit_price', 'subtotal', 'variant_name', 'addons']
        read_only_fields = ['unit_price', 'variant_name']


class OrderItemCreateSerializer(serializers.Serializer):
    menu_item = serializers.PrimaryKeyRelatedField(queryset=MenuItem.objects.all())
    quantity = serializers.IntegerField(min_value=1, max_value=20)
    variant_id = serializers.IntegerField(required=False, allow_null=True)
    addon_ids = serializers.ListField(
        child=serializers.IntegerField(), required=False, default=list,
    )


class TableSimpleSerializer(serializers.ModelSerializer):
    location_display = serializers.CharField(source='get_location_display', read_only=True)

    class Meta:
        model = Table
        fields = ['id', 'number', 'capacity', 'location', 'location_display', 'description']


class OrderCreateSerializer(serializers.Serializer):
    items = OrderItemCreateSerializer(many=True)
    delivery_type = serializers.ChoiceField(choices=Order.DeliveryType.choices)
    payment_method = serializers.ChoiceField(
        choices=Order.PaymentMethod.choices,
        default=Order.PaymentMethod.ONLINE,
    )
    address = serializers.IntegerField(required=False, allow_null=True)
    table = serializers.IntegerField(required=False, allow_null=True)
    note = serializers.CharField(required=False, allow_blank=True)
    discount_code = serializers.CharField(required=False, allow_blank=True)

    def validate(self, data):
        if not data.get('items'):
            raise serializers.ValidationError('حداقل یک آیتم باید انتخاب شود')
        if data.get('delivery_type') == Order.DeliveryType.DELIVERY and not data.get('address'):
            raise serializers.ValidationError('برای ارسال با پیک، آدرس الزامی است')
        if data.get('delivery_type') == Order.DeliveryType.DINE_IN and not data.get('table'):
            raise serializers.ValidationError('برای سرو در کافه، انتخاب میز الزامی است')
        if (data.get('delivery_type') == Order.DeliveryType.DELIVERY and
                data.get('payment_method') == Order.PaymentMethod.CASH):
            raise serializers.ValidationError('ارسال با پیک فقط با پرداخت آنلاین امکان‌پذیر است')
        return data


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    address_detail = AddressSerializer(source='address', read_only=True)
    table_detail = TableSimpleSerializer(source='table', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    delivery_type_display = serializers.CharField(source='get_delivery_type_display', read_only=True)

    class Meta:
        model = Order
        fields = [
            'id', 'status', 'status_display', 'delivery_type',
            'delivery_type_display', 'payment_method', 'is_paid',
            'address', 'address_detail', 'table', 'table_detail',
            'note', 'total_price', 'delivery_cost', 'packaging_cost', 'discount_amount',
            'final_price', 'discount_code', 'items', 'created_at',
        ]


class AdminOrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    user_phone = serializers.CharField(source='user.phone', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    delivery_type_display = serializers.CharField(source='get_delivery_type_display', read_only=True)
    table_detail = TableSimpleSerializer(source='table', read_only=True)

    class Meta:
        model = Order
        fields = '__all__'


class OrderStatusUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Order
        fields = ['status']
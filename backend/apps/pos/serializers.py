from rest_framework import serializers
from .models import ReceiptSettings, PrintJob
from apps.orders.models import Order
from apps.orders.serializers import OrderItemCreateSerializer


class ReceiptSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReceiptSettings
        fields = ['header_text', 'footer_text', 'show_customer_name', 'show_customer_phone']


class WalkInOrderCreateSerializer(serializers.Serializer):
    """ثبت سفارش حضوری توسط پرسنل — بدون آدرس/پیک (مشتری حضوری است)، بدون کد
    تخفیف (سفارش دستی پرسنل است، نه سفارش خودِ مشتری از اپ). فقط بیرون‌بر یا
    سرو در کافه معنا دارد."""
    items = OrderItemCreateSerializer(many=True)
    delivery_type = serializers.ChoiceField(
        choices=[Order.DeliveryType.TAKEAWAY, Order.DeliveryType.DINE_IN],
    )
    table = serializers.IntegerField(required=False, allow_null=True)
    customer_name = serializers.CharField(required=False, allow_blank=True, max_length=100)
    note = serializers.CharField(required=False, allow_blank=True)

    def validate(self, data):
        if not data.get('items'):
            raise serializers.ValidationError('حداقل یک آیتم باید انتخاب شود')
        if data.get('delivery_type') == Order.DeliveryType.DINE_IN and not data.get('table'):
            raise serializers.ValidationError('برای سرو در کافه، انتخاب میز الزامی است')
        return data


class PrintJobSerializer(serializers.ModelSerializer):
    """برای Print Agent — شامل متن آماده‌ی چاپ، نه فقط داده‌ی خام."""
    receipt_text = serializers.SerializerMethodField()
    order_number = serializers.CharField(source='order.order_number', read_only=True)

    class Meta:
        model = PrintJob
        fields = ['id', 'order_number', 'receipt_text', 'created_at']

    def get_receipt_text(self, obj):
        from .services import render_receipt_text
        return render_receipt_text(obj.order)

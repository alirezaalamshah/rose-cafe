from django.contrib import admin
from .models import Order, OrderItem


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0
    readonly_fields = ['subtotal']


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ['order_number', 'user', 'status', 'delivery_type', 'final_price', 'created_at']
    list_filter = ['status', 'delivery_type', 'created_at']
    list_editable = ['status']
    search_fields = ['user__phone', 'id', 'order_number']
    readonly_fields = ['total_price', 'final_price', 'discount_amount']
    inlines = [OrderItemInline]
    ordering = ['-created_at']
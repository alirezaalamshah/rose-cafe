from django.contrib import admin
from .models import Discount, DiscountUsage


@admin.register(Discount)
class DiscountAdmin(admin.ModelAdmin):
    list_display = ['code', 'discount_type', 'value', 'used_count', 'usage_limit', 'is_active', 'valid_until']
    list_editable = ['is_active']
    list_filter = ['discount_type', 'is_active']
    search_fields = ['code']


@admin.register(DiscountUsage)
class DiscountUsageAdmin(admin.ModelAdmin):
    list_display = ['discount', 'user', 'order_id', 'used_at']
    readonly_fields = ['used_at']
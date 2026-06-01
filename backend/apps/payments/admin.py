from django.contrib import admin
from .models import Payment


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ['id', 'order', 'user', 'amount', 'status', 'ref_id', 'created_at']
    list_filter = ['status', 'created_at']
    search_fields = ['order__id', 'user__phone', 'ref_id', 'authority']
    readonly_fields = ['authority', 'ref_id', 'zarinpal_status', 'created_at', 'updated_at']
    ordering = ['-created_at']
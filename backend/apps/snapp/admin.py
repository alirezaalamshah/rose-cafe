from django.contrib import admin
from .models import SnappSettings, SnappCourierOrder, SnappFailureLog


@admin.register(SnappSettings)
class SnappSettingsAdmin(admin.ModelAdmin):
    list_display = ['is_enabled', 'dispatch_mode', 'store_ready', 'circuit_breaker_tripped']

    def has_add_permission(self, request):
        return not SnappSettings.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(SnappFailureLog)
class SnappFailureLogAdmin(admin.ModelAdmin):
    list_display = ['message', 'created_at']
    readonly_fields = ['message', 'created_at']

    def has_add_permission(self, request):
        return False


@admin.register(SnappCourierOrder)
class SnappCourierOrderAdmin(admin.ModelAdmin):
    list_display = ['order', 'status', 'retry_count', 'biker_name', 'dispatched_at', 'last_webhook_at']
    list_filter = ['status']
    search_fields = ['order__order_number', 'snapp_order_id', 'biker_name', 'biker_phone']
    readonly_fields = [
        'order', 'snapp_order_id', 'retry_count', 'dispatched_at', 'last_webhook_at', 'raw_last_response',
    ]

    def has_add_permission(self, request):
        # این رکوردها فقط از طریق apps.snapp.services.dispatch_order ساخته می‌شوند
        return False

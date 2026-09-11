from django.contrib import admin
from .models import ReceiptSettings, PrintJob


@admin.register(ReceiptSettings)
class ReceiptSettingsAdmin(admin.ModelAdmin):
    list_display = ['footer_text', 'show_customer_name', 'show_customer_phone']

    def has_add_permission(self, request):
        return not ReceiptSettings.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(PrintJob)
class PrintJobAdmin(admin.ModelAdmin):
    list_display = ['order', 'status', 'created_at', 'printed_at']
    list_filter = ['status']
    readonly_fields = ['order', 'created_at', 'printed_at']

    def has_add_permission(self, request):
        return False

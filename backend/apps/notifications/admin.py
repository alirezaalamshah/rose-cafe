from django.contrib import admin
from .models import SMSLog


@admin.register(SMSLog)
class SMSLogAdmin(admin.ModelAdmin):
    list_display = ['phone', 'status', 'created_at']
    list_filter = ['status']
    search_fields = ['phone']
    readonly_fields = ['phone', 'message', 'status', 'created_at']
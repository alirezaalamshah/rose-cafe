from django.contrib import admin
from .models import SMSLog, PushSubscription


@admin.register(SMSLog)
class SMSLogAdmin(admin.ModelAdmin):
    list_display = ['phone', 'status', 'created_at']
    list_filter = ['status']
    search_fields = ['phone']
    readonly_fields = ['phone', 'message', 'status', 'created_at']


@admin.register(PushSubscription)
class PushSubscriptionAdmin(admin.ModelAdmin):
    list_display = ['user', 'user_agent', 'created_at']
    search_fields = ['user__phone', 'user__full_name', 'user_agent']
    readonly_fields = ['user', 'endpoint', 'p256dh', 'auth', 'user_agent', 'created_at']
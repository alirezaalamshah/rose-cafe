from django.contrib import admin
from .models import StaffActionLog


@admin.register(StaffActionLog)
class StaffActionLogAdmin(admin.ModelAdmin):
    list_display = ['created_at', 'user', 'action', 'order', 'reservation', 'detail']
    list_filter = ['action', 'created_at']
    search_fields = ['user__phone', 'user__full_name', 'detail']
    readonly_fields = ['user', 'action', 'order', 'reservation', 'detail', 'created_at']
    ordering = ['-created_at']

    def has_add_permission(self, request):
        return False

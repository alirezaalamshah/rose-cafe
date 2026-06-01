from django.contrib import admin
from .models import Table, Reservation


@admin.register(Table)
class TableAdmin(admin.ModelAdmin):
    list_display = ['number', 'capacity', 'location', 'is_active']
    list_editable = ['is_active']
    list_filter = ['location', 'is_active']


@admin.register(Reservation)
class ReservationAdmin(admin.ModelAdmin):
    list_display = ['id', 'user', 'table', 'date', 'start_time', 'end_time', 'guests_count', 'status']
    list_filter = ['status', 'date']
    list_editable = ['status']
    search_fields = ['user__phone', 'table__number']
    ordering = ['-date', '-start_time']
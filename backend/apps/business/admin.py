from django.contrib import admin
from .models import BusinessHours, SpecialDay, DeliverySettings, CafeInfo, ReservationSettings, Banner, SocialLink


@admin.register(CafeInfo)
class CafeInfoAdmin(admin.ModelAdmin):
    list_display = ['name', 'phone']
    fieldsets = [
        ('اطلاعات اصلی', {'fields': ['name', 'tagline']}),
        ('تماس', {'fields': ['phone']}),
        ('آدرس', {'fields': ['address']}),
    ]

    def has_add_permission(self, request):
        return not CafeInfo.objects.exists()


@admin.register(DeliverySettings)
class DeliverySettingsAdmin(admin.ModelAdmin):
    list_display = ['delivery_cost', 'free_delivery_threshold']

    def has_add_permission(self, request):
        return not DeliverySettings.objects.exists()


@admin.register(BusinessHours)
class BusinessHoursAdmin(admin.ModelAdmin):
    list_display = ['day_of_week', 'is_open', 'open_time', 'close_time']
    list_editable = ['is_open', 'open_time', 'close_time']


@admin.register(SpecialDay)
class SpecialDayAdmin(admin.ModelAdmin):
    list_display = ['date', 'is_closed', 'open_time', 'close_time', 'note']
    list_filter = ['is_closed']
    ordering = ['date']


@admin.register(Banner)
class BannerAdmin(admin.ModelAdmin):
    list_display = ['title', 'is_active', 'start_date', 'end_date', 'order']
    list_filter = ['is_active']
    ordering = ['order']


@admin.register(ReservationSettings)
class ReservationSettingsAdmin(admin.ModelAdmin):
    list_display = ['max_reservation_hours']

    def has_add_permission(self, request):
        return not ReservationSettings.objects.exists()


@admin.register(SocialLink)
class SocialLinkAdmin(admin.ModelAdmin):
    list_display = ['platform', 'account', 'is_active', 'order']
    list_filter = ['platform', 'is_active']
    ordering = ['order']

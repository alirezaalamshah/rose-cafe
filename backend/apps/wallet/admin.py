from django.contrib import admin
from .models import Wallet, WalletTransaction, WalletTopup, LoyaltySettings


class WalletTransactionInline(admin.TabularInline):
    model = WalletTransaction
    extra = 0
    fields = ['type', 'amount', 'balance_after', 'order', 'description', 'created_at']
    readonly_fields = fields
    can_delete = False
    ordering = ['-created_at']


@admin.register(Wallet)
class WalletAdmin(admin.ModelAdmin):
    list_display = ['user', 'balance', 'updated_at']
    search_fields = ['user__phone', 'user__full_name']
    readonly_fields = ['balance', 'created_at', 'updated_at']
    inlines = [WalletTransactionInline]


@admin.register(WalletTransaction)
class WalletTransactionAdmin(admin.ModelAdmin):
    list_display = ['wallet', 'type', 'amount', 'balance_after', 'order', 'created_at']
    list_filter = ['type']
    search_fields = ['wallet__user__phone', 'description']
    readonly_fields = ['wallet', 'type', 'amount', 'balance_after', 'order', 'description', 'created_at']

    def has_add_permission(self, request):
        # تراکنش‌ها فقط از طریق apps.wallet.services ساخته می‌شوند، نه دستی از پنل ادمین —
        # ساخت دستی از اینجا دفتر تراکنش‌ها را با موجودی واقعی ناهمخوان می‌کند
        return False


@admin.register(WalletTopup)
class WalletTopupAdmin(admin.ModelAdmin):
    list_display = ['id', 'user', 'amount', 'status', 'ref_id', 'created_at']
    list_filter = ['status']
    search_fields = ['user__phone', 'authority', 'ref_id']
    readonly_fields = ['user', 'amount', 'status', 'authority', 'ref_id', 'created_at', 'updated_at']


@admin.register(LoyaltySettings)
class LoyaltySettingsAdmin(admin.ModelAdmin):
    list_display = ['is_enabled', 'cashback_percentage', 'min_order_amount']

    def has_add_permission(self, request):
        return not LoyaltySettings.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False

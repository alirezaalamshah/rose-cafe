from django.contrib import admin
from .models import Review, CafeReview


@admin.register(Review)
class ReviewAdmin(admin.ModelAdmin):
    list_display = ['user', 'menu_item', 'rating', 'is_approved', 'created_at']
    list_editable = ['is_approved']
    list_filter = ['is_approved', 'rating']
    search_fields = ['user__phone', 'menu_item__name', 'comment']
    ordering = ['-created_at']
    actions = ['approve_reviews', 'reject_reviews']

    def approve_reviews(self, request, queryset):
        queryset.update(is_approved=True)
    approve_reviews.short_description = 'تایید نظرات انتخاب شده'

    def reject_reviews(self, request, queryset):
        queryset.update(is_approved=False)
    reject_reviews.short_description = 'رد نظرات انتخاب شده'


@admin.register(CafeReview)
class CafeReviewAdmin(admin.ModelAdmin):
    list_display = ['user', 'rating', 'is_approved', 'created_at']
    list_editable = ['is_approved']
    list_filter = ['is_approved', 'rating']
    search_fields = ['user__phone', 'comment']
    ordering = ['-created_at']
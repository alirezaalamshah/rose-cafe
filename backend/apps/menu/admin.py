from django.contrib import admin
from .models import Category, MenuItem, MenuItemImage, MenuItemVariant


class MenuItemImageInline(admin.TabularInline):
    model = MenuItemImage
    extra = 1


class MenuItemVariantInline(admin.TabularInline):
    model = MenuItemVariant
    extra = 1
    fields = ['name', 'price', 'discounted_price', 'is_available', 'order']


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ['name', 'slug', 'order', 'is_active']
    list_editable = ['order', 'is_active']
    prepopulated_fields = {'slug': ('name',)}
    search_fields = ['name']


@admin.register(MenuItem)
class MenuItemAdmin(admin.ModelAdmin):
    list_display = ['name', 'category', 'price', 'discounted_price', 'status', 'is_featured', 'order']
    list_editable = ['price', 'status', 'is_featured', 'order']
    list_filter = ['category', 'status', 'is_featured', 'is_vegetarian']
    search_fields = ['name', 'description']
    prepopulated_fields = {'slug': ('name',)}
    inlines = [MenuItemVariantInline, MenuItemImageInline]
    fieldsets = (
        ('اطلاعات اصلی', {'fields': ('category', 'name', 'slug', 'description', 'image')}),
        ('قیمت‌گذاری', {'fields': ('price', 'discounted_price')}),
        ('مشخصات', {'fields': ('status', 'is_featured', 'is_vegetarian', 'calories', 'preparation_time', 'order')}),
    )
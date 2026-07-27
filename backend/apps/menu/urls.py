from django.urls import path, register_converter
from apps.common.converters import UnicodeSlugConverter
from .views import (
    CategoryListView, MenuItemListView, MenuItemDetailView,
    FeaturedItemsView, AdminMenuItemListCreateView,
    AdminMenuItemDetailView, AdminCategoryListCreateView,
    AdminCategoryDetailView, AdminMenuItemVariantView,
    AdminMenuItemVariantDetailView,
    AdminMenuItemAddonView, AdminMenuItemAddonDetailView,
    AdminMenuBulkPriceUpdateView, AdminMenuBulkStatusUpdateView,
    AdminMenuBulkCategoryMoveView, AdminMenuBulkDeleteView,
    AdminCategoryBulkToggleView,
)

register_converter(UnicodeSlugConverter, 'uslug')

urlpatterns = [
    # Public
    path('categories/', CategoryListView.as_view(), name='categories'),
    path('items/', MenuItemListView.as_view(), name='menu-items'),
    path('items/featured/', FeaturedItemsView.as_view(), name='featured-items'),
    path('items/<uslug:slug>/', MenuItemDetailView.as_view(), name='menu-item-detail'),

    # Admin items
    path('admin/items/', AdminMenuItemListCreateView.as_view(), name='admin-items'),
    path('admin/items/<int:pk>/', AdminMenuItemDetailView.as_view(), name='admin-item-detail'),

    # Admin bulk actions
    path('admin/items/bulk-price/', AdminMenuBulkPriceUpdateView.as_view(), name='admin-items-bulk-price'),
    path('admin/items/bulk-status/', AdminMenuBulkStatusUpdateView.as_view(), name='admin-items-bulk-status'),
    path('admin/items/bulk-category/', AdminMenuBulkCategoryMoveView.as_view(), name='admin-items-bulk-category'),
    path('admin/items/bulk-delete/', AdminMenuBulkDeleteView.as_view(), name='admin-items-bulk-delete'),
    path('admin/categories/bulk-toggle/', AdminCategoryBulkToggleView.as_view(), name='admin-categories-bulk-toggle'),

    # Admin variants
    path('admin/items/<int:item_pk>/variants/', AdminMenuItemVariantView.as_view(), name='admin-item-variants'),
    path('admin/items/<int:item_pk>/variants/<int:pk>/', AdminMenuItemVariantDetailView.as_view(), name='admin-item-variant-detail'),
    path('admin/items/<int:item_pk>/addons/', AdminMenuItemAddonView.as_view(), name='admin-item-addons'),
    path('admin/items/<int:item_pk>/addons/<int:pk>/', AdminMenuItemAddonDetailView.as_view(), name='admin-item-addon-detail'),

    # Admin categories
    path('admin/categories/', AdminCategoryListCreateView.as_view(), name='admin-categories'),
    path('admin/categories/<int:pk>/', AdminCategoryDetailView.as_view(), name='admin-category-detail'),
]

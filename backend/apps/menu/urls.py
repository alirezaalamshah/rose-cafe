from django.urls import path
from .views import (
    CategoryListView, MenuItemListView, MenuItemDetailView,
    FeaturedItemsView, AdminMenuItemListCreateView,
    AdminMenuItemDetailView, AdminCategoryListCreateView,
    AdminCategoryDetailView,
)

urlpatterns = [
    # Public
    path('categories/', CategoryListView.as_view(), name='categories'),
    path('items/', MenuItemListView.as_view(), name='menu-items'),
    path('items/featured/', FeaturedItemsView.as_view(), name='featured-items'),
    path('items/<slug:slug>/', MenuItemDetailView.as_view(), name='menu-item-detail'),

    # Admin
    path('admin/items/', AdminMenuItemListCreateView.as_view(), name='admin-items'),
    path('admin/items/<int:pk>/', AdminMenuItemDetailView.as_view(), name='admin-item-detail'),
    path('admin/categories/', AdminCategoryListCreateView.as_view(), name='admin-categories'),
    path('admin/categories/<int:pk>/', AdminCategoryDetailView.as_view(), name='admin-category-detail'),
]
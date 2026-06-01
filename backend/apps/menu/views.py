from rest_framework import generics, permissions, filters
from rest_framework.response import Response
from rest_framework.views import APIView
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Avg

from .models import Category, MenuItem
from .serializers import (
    CategorySerializer, MenuItemListSerializer,
    MenuItemDetailSerializer, MenuItemAdminSerializer,
    CategoryAdminSerializer,
)
from .filters import MenuItemFilter


class CategoryListView(generics.ListAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = CategorySerializer
    queryset = Category.objects.filter(is_active=True)


class MenuItemListView(generics.ListAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = MenuItemListSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = MenuItemFilter
    search_fields = ['name', 'description']
    ordering_fields = ['price', 'order', 'created_at']
    ordering = ['order']

    def get_queryset(self):  # type: ignore[override]
        return MenuItem.objects.filter(
            status=MenuItem.Status.AVAILABLE
        ).select_related('category')


class MenuItemDetailView(generics.RetrieveAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = MenuItemDetailSerializer
    lookup_field = 'slug'

    def get_queryset(self):  # type: ignore[override]
        return MenuItem.objects.filter(
            status=MenuItem.Status.AVAILABLE
        ).select_related('category').prefetch_related('extra_images', 'reviews')


class FeaturedItemsView(generics.ListAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = MenuItemListSerializer

    def get_queryset(self):  # type: ignore[override]
        return MenuItem.objects.filter(
            is_featured=True,
            status=MenuItem.Status.AVAILABLE
        ).select_related('category')[:8]


# Admin Views
class AdminMenuItemListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAdminUser]
    serializer_class = MenuItemAdminSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    search_fields = ['name']

    def get_queryset(self):  # type: ignore[override]
        return MenuItem.objects.all().select_related('category')


class AdminMenuItemDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [permissions.IsAdminUser]
    serializer_class = MenuItemAdminSerializer

    def get_queryset(self):  # type: ignore[override]
        return MenuItem.objects.all()


class AdminCategoryListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAdminUser]
    serializer_class = CategoryAdminSerializer
    queryset = Category.objects.all()


class AdminCategoryDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [permissions.IsAdminUser]
    serializer_class = CategoryAdminSerializer

    def get_queryset(self):  # type: ignore[override]
        return Category.objects.all()
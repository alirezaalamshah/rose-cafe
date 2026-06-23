from rest_framework import generics, permissions, filters
from rest_framework.response import Response
from rest_framework.views import APIView
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Avg

from .models import Category, MenuItem, MenuItemVariant
from .serializers import (
    CategorySerializer, MenuItemListSerializer,
    MenuItemDetailSerializer, MenuItemAdminSerializer,
    CategoryAdminSerializer, MenuItemVariantSerializer,
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


def _sync_item_price(item_pk):
    """وقتی variant تغییر کرد، قیمت پایه آیتم را با کمترین قیمت variant sync می‌کند."""
    try:
        item = MenuItem.objects.get(pk=item_pk)
        variants = item.variants.filter(is_available=True)
        if variants.exists():
            min_price = variants.order_by('price').first().price
            if item.price != min_price:
                item.price = min_price
                item.save(update_fields=['price'])
    except MenuItem.DoesNotExist:
        pass


class AdminMenuItemVariantView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAdminUser]
    serializer_class = MenuItemVariantSerializer

    def get_queryset(self):  # type: ignore[override]
        return MenuItemVariant.objects.filter(item_id=self.kwargs['item_pk'])

    def perform_create(self, serializer):
        serializer.save(item_id=self.kwargs['item_pk'])
        _sync_item_price(self.kwargs['item_pk'])


class AdminMenuItemVariantDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [permissions.IsAdminUser]
    serializer_class = MenuItemVariantSerializer

    def get_queryset(self):  # type: ignore[override]
        return MenuItemVariant.objects.filter(item_id=self.kwargs['item_pk'])

    def perform_update(self, serializer):
        serializer.save()
        _sync_item_price(self.kwargs['item_pk'])

    def perform_destroy(self, instance):
        item_pk = self.kwargs['item_pk']
        instance.delete()
        _sync_item_price(item_pk)
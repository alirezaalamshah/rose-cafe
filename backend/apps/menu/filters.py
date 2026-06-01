from django_filters import rest_framework as filters
from .models import MenuItem


class MenuItemFilter(filters.FilterSet):
    min_price = filters.NumberFilter(field_name='price', lookup_expr='gte')
    max_price = filters.NumberFilter(field_name='price', lookup_expr='lte')
    category = filters.CharFilter(field_name='category__slug')
    is_vegetarian = filters.BooleanFilter()
    is_featured = filters.BooleanFilter()
    status = filters.CharFilter()

    class Meta:
        model = MenuItem
        fields = ['category', 'is_vegetarian', 'is_featured', 'status', 'min_price', 'max_price']
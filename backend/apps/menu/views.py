from rest_framework import generics, permissions, filters, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.exceptions import ValidationError
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Avg, Count, Q, ProtectedError
from django.db.models.functions import Round

from .models import Category, MenuItem, MenuItemVariant, MenuItemAddon
from .serializers import (
    CategorySerializer, MenuItemListSerializer,
    MenuItemDetailSerializer, MenuItemAdminSerializer,
    CategoryAdminSerializer, MenuItemVariantSerializer,
    MenuItemAddonSerializer,
)
from .filters import MenuItemFilter
from apps.accounts.permissions import IsWaiter


def _with_rating_annotations(queryset):
    """
    average_rating/review_count را در همان کوئری دیتابیس annotate می‌کند
    (به‌جای property که برای هر آیتم منو ۲-۳ کوئری جدا می‌زد).
    """
    return queryset.annotate(
        average_rating=Round(Avg('reviews__rating', filter=Q(reviews__is_approved=True)), 1),
        review_count=Count('reviews', filter=Q(reviews__is_approved=True)),
    )


class CategoryListView(generics.ListAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = CategorySerializer
    # annotate با aggregate می‌تواند ordering پیش‌فرض Meta را نادیده بگیرد،
    # پس صریح order_by می‌دهیم (وگرنه ترتیب نمایش دسته‌بندی‌ها در سایدبار به‌هم می‌ریزد)
    queryset = Category.objects.filter(is_active=True).annotate(
        item_count=Count('items', filter=Q(items__status=MenuItem.Status.AVAILABLE))
    ).order_by('order', 'name')


class MenuItemListView(generics.ListAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = MenuItemListSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = MenuItemFilter
    search_fields = ['name', 'description']
    ordering_fields = ['price', 'order', 'created_at']
    ordering = ['order']

    def get_queryset(self):  # type: ignore[override]
        qs = MenuItem.objects.filter(
            status=MenuItem.Status.AVAILABLE
        ).select_related('category').prefetch_related('variants', 'addons')
        return _with_rating_annotations(qs)

    def filter_queryset(self, queryset):  # type: ignore[override]
        queryset = super().filter_queryset(queryset)
        # حالت پیش‌فرض «ترتیب چیدمان منو»: ابتدا گروه‌بندی بر اساس ترتیب دسته‌بندی
        ordering_param = self.request.query_params.get('ordering', 'order')
        if ordering_param in ('order', '-order'):
            sign = '-' if ordering_param.startswith('-') else ''
            queryset = queryset.order_by(f'{sign}category__order', 'category__name', ordering_param)
        return queryset


class MenuItemDetailView(generics.RetrieveAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = MenuItemDetailSerializer
    lookup_field = 'slug'

    def get_queryset(self):  # type: ignore[override]
        qs = MenuItem.objects.filter(
            status=MenuItem.Status.AVAILABLE
        ).select_related('category').prefetch_related('extra_images', 'variants', 'addons')
        return _with_rating_annotations(qs)


class FeaturedItemsView(generics.ListAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = MenuItemListSerializer

    def get_queryset(self):  # type: ignore[override]
        # annotate با aggregate، ordering پیش‌فرض Meta را نادیده می‌گیرد؛ صریح order_by لازم است
        qs = MenuItem.objects.filter(
            is_featured=True,
            status=MenuItem.Status.AVAILABLE
        ).select_related('category').prefetch_related('variants', 'addons').order_by(
            'category__order', 'category__name', 'order', 'name'
        )
        return _with_rating_annotations(qs)[:8]


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

    def perform_destroy(self, instance):
        try:
            instance.delete()
        except ProtectedError:
            raise ValidationError(
                'این آیتم در سفارش‌های قبلی استفاده شده و برای حفظ سابقه‌ی سفارش‌ها قابل حذف نیست. '
                'به‌جای حذف، می‌توانید آن را غیرفعال کنید.'
            )


class AdminCategoryListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAdminUser]
    serializer_class = CategoryAdminSerializer
    queryset = Category.objects.all()


class AdminCategoryDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [permissions.IsAdminUser]
    serializer_class = CategoryAdminSerializer

    def get_queryset(self):  # type: ignore[override]
        return Category.objects.all()

    def perform_destroy(self, instance):
        try:
            instance.delete()
        except ProtectedError:
            raise ValidationError(
                'این دسته‌بندی شامل آیتم‌های منو است و قابل حذف نیست. '
                'ابتدا آیتم‌های آن را حذف یا به دسته‌ی دیگری منتقل کنید.'
            )


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


class AdminMenuItemAddonView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAdminUser]
    serializer_class = MenuItemAddonSerializer

    def get_queryset(self):  # type: ignore[override]
        return MenuItemAddon.objects.filter(item_id=self.kwargs['item_pk'])

    def perform_create(self, serializer):
        serializer.save(item_id=self.kwargs['item_pk'])


class AdminMenuItemAddonDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [permissions.IsAdminUser]
    serializer_class = MenuItemAddonSerializer

    def get_queryset(self):  # type: ignore[override]
        return MenuItemAddon.objects.filter(item_id=self.kwargs['item_pk'])


# Bulk admin actions
class AdminMenuBulkPriceUpdateView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def post(self, request):
        item_ids = request.data.get('item_ids')
        category_id = request.data.get('category_id')
        mode = request.data.get('mode')
        direction = request.data.get('direction')
        value = request.data.get('value')

        if mode not in ('percent', 'fixed') or direction not in ('increase', 'decrease'):
            return Response({'detail': 'پارامترهای نامعتبر است'}, status=400)
        try:
            value = float(value)
        except (TypeError, ValueError):
            return Response({'detail': 'مقدار وارد شده نامعتبر است'}, status=400)
        if value <= 0:
            return Response({'detail': 'مقدار باید بزرگتر از صفر باشد'}, status=400)

        if category_id:
            items = MenuItem.objects.filter(category_id=category_id)
        elif item_ids:
            items = MenuItem.objects.filter(pk__in=item_ids)
        else:
            return Response({'detail': 'هیچ آیتمی انتخاب نشده است'}, status=400)

        def new_price(old):
            if old is None:
                return None
            delta = old * value / 100 if mode == 'percent' else value
            result = old + delta if direction == 'increase' else old - delta
            return max(0, round(result))

        updated_count = 0
        for item in items:
            item.price = new_price(item.price)
            if item.discounted_price is not None:
                item.discounted_price = new_price(item.discounted_price)
            item.save(update_fields=['price', 'discounted_price'])
            for variant in item.variants.all():
                variant.price = new_price(variant.price)
                if variant.discounted_price is not None:
                    variant.discounted_price = new_price(variant.discounted_price)
                variant.save(update_fields=['price', 'discounted_price'])
            _sync_item_price(item.pk)
            updated_count += 1

        return Response({'updated': updated_count})


class AdminMenuBulkStatusUpdateView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def post(self, request):
        item_ids = request.data.get('item_ids')
        status_value = request.data.get('status')
        valid_statuses = [c[0] for c in MenuItem.Status.choices]

        if status_value not in valid_statuses:
            return Response({'detail': 'وضعیت نامعتبر است'}, status=400)
        if not item_ids:
            return Response({'detail': 'هیچ آیتمی انتخاب نشده است'}, status=400)

        items_qs = MenuItem.objects.filter(pk__in=item_ids)
        # دسته‌بندی‌های متعلق به همین آیتم‌ها را قبل از آپدیت گروهی نگه می‌داریم
        category_ids = list(items_qs.values_list('category_id', flat=True).distinct())
        updated = items_qs.update(status=status_value)

        # .update() بر خلاف save() سیگنال/منطق مدل را اجرا نمی‌کند — پس خودمان دستی
        # هم‌گام‌سازی می‌کنیم: فعال شدن یک آیتم → فعال شدن دسته، و برعکس
        if category_ids:
            if status_value == MenuItem.Status.AVAILABLE:
                Category.objects.filter(pk__in=category_ids, is_active=False).update(is_active=True)
            else:
                # دسته‌هایی که بعد از این تغییر دیگر هیچ آیتم موجودی ندارند، غیرفعال شوند
                still_available_cats = set(
                    MenuItem.objects.filter(
                        category_id__in=category_ids, status=MenuItem.Status.AVAILABLE,
                    ).values_list('category_id', flat=True).distinct()
                )
                empty_cats = [cid for cid in category_ids if cid not in still_available_cats]
                if empty_cats:
                    Category.objects.filter(pk__in=empty_cats, is_active=True).update(is_active=False)

        return Response({'updated': updated})


class AdminMenuBulkCategoryMoveView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def post(self, request):
        item_ids = request.data.get('item_ids')
        category_id = request.data.get('category_id')

        if not item_ids:
            return Response({'detail': 'هیچ آیتمی انتخاب نشده است'}, status=400)
        if not Category.objects.filter(pk=category_id).exists():
            return Response({'detail': 'دسته‌بندی نامعتبر است'}, status=400)

        updated = MenuItem.objects.filter(pk__in=item_ids).update(category_id=category_id)
        return Response({'updated': updated})


class AdminMenuBulkDeleteView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def post(self, request):
        item_ids = request.data.get('item_ids')
        if not item_ids:
            return Response({'detail': 'هیچ آیتمی انتخاب نشده است'}, status=400)

        try:
            deleted, _ = MenuItem.objects.filter(pk__in=item_ids).delete()
        except ProtectedError:
            return Response(
                {'detail': 'برخی از آیتم‌های انتخاب‌شده در سفارش‌های قبلی استفاده شده‌اند و قابل حذف نیستند.'},
                status=400,
            )
        return Response({'deleted': deleted})


# ─── Waiter Views ────────────────────────────────────────────────────────────
# فقط تغییر موجودی — نه ویرایش کامل (قیمت/نام/تصویر و...) که مختص ادمین می‌ماند

def _check_menu_permission(request):
    perm = getattr(request.user, 'waiter_permissions', None)
    if not perm or not perm.can_manage_menu_availability:
        return Response({'detail': 'دسترسی به مدیریت موجودی منو ندارید'}, status=status.HTTP_403_FORBIDDEN)
    return None


class WaiterMenuItemListView(generics.ListAPIView):
    """فهرست کامل آیتم‌های منو (نه فقط موجودها) تا سرپرست سالن بتواند وضعیت هرکدام را ببیند/تغییر دهد."""
    permission_classes = [IsWaiter]
    serializer_class = MenuItemAdminSerializer

    def get_queryset(self):  # type: ignore[override]
        return MenuItem.objects.all().select_related('category').prefetch_related('variants', 'addons')

    def list(self, request, *args, **kwargs):
        denied = _check_menu_permission(request)
        if denied:
            return denied
        return super().list(request, *args, **kwargs)


class WaiterMenuItemAvailabilityView(APIView):
    permission_classes = [IsWaiter]

    def patch(self, request, pk):
        denied = _check_menu_permission(request)
        if denied:
            return denied

        new_status = request.data.get('status')
        allowed = {MenuItem.Status.AVAILABLE, MenuItem.Status.UNAVAILABLE}
        if new_status not in allowed:
            return Response(
                {'detail': f'وضعیت باید یکی از {", ".join(allowed)} باشد'}, status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            item = MenuItem.objects.get(pk=pk)
        except MenuItem.DoesNotExist:
            return Response({'detail': 'آیتم یافت نشد'}, status=status.HTTP_404_NOT_FOUND)

        item.status = new_status
        item.save(update_fields=['status'])
        return Response(MenuItemAdminSerializer(item).data)


class WaiterMenuItemVariantAvailabilityView(APIView):
    permission_classes = [IsWaiter]

    def patch(self, request, pk):
        denied = _check_menu_permission(request)
        if denied:
            return denied

        if 'is_available' not in request.data:
            return Response({'detail': 'is_available الزامی است'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            variant = MenuItemVariant.objects.get(pk=pk)
        except MenuItemVariant.DoesNotExist:
            return Response({'detail': 'نوع آیتم یافت نشد'}, status=status.HTTP_404_NOT_FOUND)

        variant.is_available = bool(request.data.get('is_available'))
        variant.save(update_fields=['is_available'])
        _sync_item_price(variant.item_id)
        return Response(MenuItemVariantSerializer(variant).data)


class WaiterMenuItemAddonAvailabilityView(APIView):
    permission_classes = [IsWaiter]

    def patch(self, request, pk):
        denied = _check_menu_permission(request)
        if denied:
            return denied

        if 'is_available' not in request.data:
            return Response({'detail': 'is_available الزامی است'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            addon = MenuItemAddon.objects.get(pk=pk)
        except MenuItemAddon.DoesNotExist:
            return Response({'detail': 'افزودنی یافت نشد'}, status=status.HTTP_404_NOT_FOUND)

        addon.is_available = bool(request.data.get('is_available'))
        addon.save(update_fields=['is_available'])
        return Response(MenuItemAddonSerializer(addon).data)


class AdminCategoryBulkToggleView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def post(self, request):
        category_ids = request.data.get('category_ids')
        is_active = request.data.get('is_active')

        if not category_ids or is_active is None:
            return Response({'detail': 'پارامترهای نامعتبر است'}, status=400)

        is_active = bool(is_active)
        updated = Category.objects.filter(pk__in=category_ids).update(is_active=is_active)

        # مثل بالا — .update() منطق cascade مدل را رد می‌کند، پس دستی انجامش می‌دهیم
        if not is_active:
            MenuItem.objects.filter(category_id__in=category_ids).exclude(
                status=MenuItem.Status.UNAVAILABLE
            ).update(status=MenuItem.Status.UNAVAILABLE)

        return Response({'updated': updated})
from django.urls import path
from .views import (
    MenuItemReviewListView, ReviewCreateView, ReviewUpdateDeleteView,
    CafeReviewListView, CafeReviewCreateView, CafeStatsView,
    AdminReviewListView, AdminReviewApproveView,
    AdminCafeReviewListView, AdminCafeReviewApproveView,
    AdminReviewBulkApproveView, AdminCafeReviewBulkApproveView,
)

urlpatterns = [
    # Public
    path('menu-item/<int:menu_item_id>/', MenuItemReviewListView.as_view(), name='menu-item-reviews'),
    path('cafe/', CafeReviewListView.as_view(), name='cafe-reviews'),
    path('cafe/stats/', CafeStatsView.as_view(), name='cafe-stats'),

    # Authenticated
    path('create/', ReviewCreateView.as_view(), name='review-create'),
    path('<int:pk>/', ReviewUpdateDeleteView.as_view(), name='review-detail'),
    path('cafe/create/', CafeReviewCreateView.as_view(), name='cafe-review-create'),

    # Admin
    path('admin/', AdminReviewListView.as_view(), name='admin-reviews'),
    path('admin/<int:pk>/approve/', AdminReviewApproveView.as_view(), name='admin-review-approve'),
    path('admin/bulk-approve/', AdminReviewBulkApproveView.as_view(), name='admin-review-bulk-approve'),
    path('admin/cafe/', AdminCafeReviewListView.as_view(), name='admin-cafe-reviews'),
    path('admin/cafe/<int:pk>/approve/', AdminCafeReviewApproveView.as_view(), name='admin-cafe-review-approve'),
    path('admin/cafe/bulk-approve/', AdminCafeReviewBulkApproveView.as_view(), name='admin-cafe-review-bulk-approve'),
]
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.db.models import Avg

from .models import Review, CafeReview
from .serializers import (
    ReviewSerializer, ReviewCreateSerializer,
    CafeReviewSerializer, CafeReviewCreateSerializer,
    AdminReviewSerializer, AdminCafeReviewSerializer,
)
from apps.common.pagination import StandardPagination


class MenuItemReviewListView(generics.ListAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = ReviewSerializer

    def get_queryset(self):  # type: ignore[override]
        menu_item_id = self.kwargs.get('menu_item_id')
        return Review.objects.filter(
            menu_item_id=menu_item_id,
            is_approved=True,
        ).select_related('user')


class ReviewCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        if request.user.is_staff:
            return Response(
                {'detail': 'مدیران سیستم امکان ثبت نظر ندارند'},
                status=status.HTTP_403_FORBIDDEN
            )
        serializer = ReviewCreateSerializer(
            data=request.data,
            context={'request': request}
        )
        serializer.is_valid(raise_exception=True)
        review = serializer.save(user=request.user)
        return Response(
            ReviewSerializer(review).data,
            status=status.HTTP_201_CREATED
        )


class ReviewUpdateDeleteView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self, pk, user):
        try:
            return Review.objects.get(pk=pk, user=user)
        except Review.DoesNotExist:
            return None

    def patch(self, request, pk):
        review = self.get_object(pk, request.user)
        if not review:
            return Response({'detail': 'نظر یافت نشد'}, status=status.HTTP_404_NOT_FOUND)

        serializer = ReviewCreateSerializer(
            review, data=request.data, partial=True,
            context={'request': request}
        )
        serializer.is_valid(raise_exception=True)
        # بعد از ویرایش دوباره باید تایید بشه
        review = serializer.save(is_approved=False)
        return Response(ReviewSerializer(review).data)

    def delete(self, request, pk):
        review = self.get_object(pk, request.user)
        if not review:
            return Response({'detail': 'نظر یافت نشد'}, status=status.HTTP_404_NOT_FOUND)
        review.delete()
        return Response({'detail': 'نظر حذف شد'}, status=status.HTTP_204_NO_CONTENT)


class CafeReviewListView(generics.ListAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = CafeReviewSerializer

    def get_queryset(self):  # type: ignore[override]
        return CafeReview.objects.filter(
            is_approved=True
        ).select_related('user')


class CafeReviewCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        if request.user.is_staff:
            return Response(
                {'detail': 'مدیران سیستم امکان ثبت نظر ندارند'},
                status=status.HTTP_403_FORBIDDEN
            )
        serializer = CafeReviewCreateSerializer(
            data=request.data,
            context={'request': request}
        )
        serializer.is_valid(raise_exception=True)
        review = serializer.save(user=request.user)
        return Response(
            CafeReviewSerializer(review).data,
            status=status.HTTP_201_CREATED
        )


class CafeStatsView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        reviews = CafeReview.objects.filter(is_approved=True)
        avg = reviews.aggregate(avg=Avg('rating'))['avg']
        return Response({
            'average_rating': round(avg, 1) if avg else 0,
            'total_reviews': reviews.count(),
        })


# Admin Views
class AdminReviewListView(generics.ListAPIView):
    permission_classes = [permissions.IsAdminUser]
    serializer_class = AdminReviewSerializer
    pagination_class = StandardPagination

    def get_queryset(self):  # type: ignore[override]
        qs = Review.objects.all().select_related('user', 'menu_item')
        is_approved = self.request.query_params.get('is_approved')
        if is_approved is not None:
            qs = qs.filter(is_approved=is_approved.lower() == 'true')
        return qs


class AdminReviewApproveView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def patch(self, request, pk):
        try:
            review = Review.objects.get(pk=pk)
        except Review.DoesNotExist:
            return Response({'detail': 'نظر یافت نشد'}, status=status.HTTP_404_NOT_FOUND)

        review.is_approved = not review.is_approved
        review.save(update_fields=['is_approved'])
        action = 'تایید' if review.is_approved else 'رد'
        return Response({'detail': f'نظر {action} شد', 'is_approved': review.is_approved})


class AdminCafeReviewListView(generics.ListAPIView):
    permission_classes = [permissions.IsAdminUser]
    serializer_class = AdminCafeReviewSerializer
    pagination_class = StandardPagination

    def get_queryset(self):  # type: ignore[override]
        return CafeReview.objects.all().select_related('user')


class AdminCafeReviewApproveView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def patch(self, request, pk):
        try:
            review = CafeReview.objects.get(pk=pk)
        except CafeReview.DoesNotExist:
            return Response({'detail': 'نظر یافت نشد'}, status=status.HTTP_404_NOT_FOUND)

        review.is_approved = not review.is_approved
        review.save(update_fields=['is_approved'])
        action = 'تایید' if review.is_approved else 'رد'
        return Response({'detail': f'نظر {action} شد', 'is_approved': review.is_approved})


class AdminReviewBulkApproveView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def post(self, request):
        updated = Review.objects.filter(is_approved=False).update(is_approved=True)
        return Response({'updated': updated})


class AdminCafeReviewBulkApproveView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def post(self, request):
        updated = CafeReview.objects.filter(is_approved=False).update(is_approved=True)
        return Response({'updated': updated})
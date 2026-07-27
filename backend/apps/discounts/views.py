from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions, generics

from .models import Discount
from .serializers import DiscountCheckSerializer, DiscountSerializer
from .utils import apply_discount
from apps.common.pagination import StandardPagination


class CheckDiscountView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = DiscountCheckSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        result = apply_discount(
            serializer.validated_data['code'],
            serializer.validated_data['order_total'],
            request.user,
        )

        if result['valid']:
            return Response({
                'valid': True,
                'discount_amount': result['discount_amount'],
                'message': result['message'],
            })
        return Response({'valid': False, 'message': result['message']})


class AdminDiscountListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAdminUser]
    serializer_class = DiscountSerializer
    queryset = Discount.objects.all().order_by('-created_at')
    pagination_class = StandardPagination


class AdminDiscountDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [permissions.IsAdminUser]
    serializer_class = DiscountSerializer

    def get_queryset(self):  # type: ignore[override]
        return Discount.objects.all()


class BirthdayOfferView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        discount = Discount.objects.filter(is_birthday_type=True, is_active=True).first()
        if not discount:
            return Response({'available': False})
        return Response({
            'available': True,
            'value': discount.value,
            'discount_type': discount.discount_type,
            'min_order_amount': discount.min_order_amount,
        })
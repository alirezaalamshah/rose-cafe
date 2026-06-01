from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions, generics

from .models import Discount
from .serializers import DiscountCheckSerializer, DiscountSerializer
from .utils import apply_discount


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


class AdminDiscountDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [permissions.IsAdminUser]
    serializer_class = DiscountSerializer

    def get_queryset(self):  # type: ignore[override]
        return Discount.objects.all()
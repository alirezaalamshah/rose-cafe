from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.utils import timezone

from .models import Table, Reservation
from .serializers import (
    TableSerializer, ReservationSerializer,
    ReservationCreateSerializer, AvailableTablesSerializer,
    AdminReservationSerializer,
)
from apps.notifications.sms import send_reservation_confirmation_sms


class AvailableTablesView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = AvailableTablesSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        if data['start_time'] >= data['end_time']:
            return Response(
                {'detail': 'ساعت پایان باید بعد از ساعت شروع باشد'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # میزهایی که در این بازه رزرو دارن
        reserved_table_ids = Reservation.objects.filter(
            date=data['date'],
            status__in=[Reservation.Status.PENDING, Reservation.Status.CONFIRMED],
            start_time__lt=data['end_time'],
            end_time__gt=data['start_time'],
        ).values_list('table_id', flat=True)

        available = Table.objects.filter(
            is_active=True,
            capacity__gte=data['guests_count'],
        ).exclude(id__in=reserved_table_ids)

        return Response(TableSerializer(available, many=True).data)


class ReservationListCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        reservations = Reservation.objects.filter(
            user=request.user
        ).select_related('table').order_by('-date', '-start_time')
        serializer = ReservationSerializer(reservations, many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = ReservationCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            reservation = serializer.save(user=request.user)
        except Exception as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        # ارسال SMS تایید
        phone = str(request.user.phone)
        send_reservation_confirmation_sms(
            phone=phone,
            reservation_id=reservation.id,
            date=str(reservation.date),
            time=str(reservation.start_time),
        )

        return Response(
            ReservationSerializer(reservation).data,
            status=status.HTTP_201_CREATED
        )


class ReservationDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self, pk, user):
        try:
            return Reservation.objects.get(pk=pk, user=user)
        except Reservation.DoesNotExist:
            return None

    def get(self, request, pk):
        reservation = self.get_object(pk, request.user)
        if not reservation:
            return Response({'detail': 'رزرو یافت نشد'}, status=status.HTTP_404_NOT_FOUND)
        return Response(ReservationSerializer(reservation).data)

    def delete(self, request, pk):
        reservation = self.get_object(pk, request.user)
        if not reservation:
            return Response({'detail': 'رزرو یافت نشد'}, status=status.HTTP_404_NOT_FOUND)

        if reservation.status not in [Reservation.Status.PENDING, Reservation.Status.CONFIRMED]:
            return Response(
                {'detail': 'امکان لغو این رزرو وجود ندارد'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if reservation.date < timezone.now().date():
            return Response(
                {'detail': 'امکان لغو رزرو گذشته وجود ندارد'},
                status=status.HTTP_400_BAD_REQUEST
            )

        reservation.status = Reservation.Status.CANCELLED
        reservation.save()
        return Response({'detail': 'رزرو لغو شد'})


# Admin Views
class AdminTableListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAdminUser]
    serializer_class = TableSerializer
    queryset = Table.objects.all()


class AdminTableDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [permissions.IsAdminUser]
    serializer_class = TableSerializer

    def get_queryset(self):  # type: ignore[override]
        return Table.objects.all()


class AdminReservationListView(generics.ListAPIView):
    permission_classes = [permissions.IsAdminUser]
    serializer_class = AdminReservationSerializer

    def get_queryset(self):  # type: ignore[override]
        qs = Reservation.objects.all().select_related('user', 'table')
        date = self.request.query_params.get('date')
        status_filter = self.request.query_params.get('status')
        if date:
            qs = qs.filter(date=date)
        if status_filter:
            qs = qs.filter(status=status_filter)
        return qs


class AdminReservationDetailView(generics.RetrieveUpdateAPIView):
    permission_classes = [permissions.IsAdminUser]
    serializer_class = AdminReservationSerializer

    def get_queryset(self):  # type: ignore[override]
        return Reservation.objects.all()
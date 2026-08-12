from datetime import datetime as dt, timedelta
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.utils import timezone

from .models import Table, Reservation
from apps.business.models import ReservationSettings
from .serializers import (
    TableSerializer, ReservationSerializer,
    ReservationCreateSerializer, AvailableTablesSerializer,
    AdminReservationSerializer,
)
from apps.accounts.permissions import IsWaiter
from apps.staff_activity.models import StaffActionLog, log_staff_action

_RESERVATION_STATUS_ACTIONS = {
    Reservation.Status.CONFIRMED: StaffActionLog.Action.RESERVATION_CONFIRMED,
    Reservation.Status.COMPLETED: StaffActionLog.Action.RESERVATION_COMPLETED,
    Reservation.Status.NO_SHOW: StaffActionLog.Action.RESERVATION_NO_SHOW,
    Reservation.Status.CANCELLED: StaffActionLog.Action.RESERVATION_CANCELLED,
}


def _log_reservation_status_change(user, reservation):
    """اگر وضعیت رزرو به یکی از حالت‌های قابل‌ثبت تغییر کرده، در StaffActionLog ثبت می‌کند."""
    action = _RESERVATION_STATUS_ACTIONS.get(reservation.status)
    if not action:
        return
    log_staff_action(
        user, action,
        f'وضعیت رزرو #{reservation.id} را به «{reservation.get_status_display()}» تغییر داد',
        reservation=reservation,
    )


class TableScheduleView(APIView):
    """لیست تمام میزهای فعال به همراه رزروهای یک روز مشخص"""
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        date_str = request.query_params.get('date')
        if not date_str:
            return Response(
                {'detail': 'پارامتر date الزامی است'},
                status=status.HTTP_400_BAD_REQUEST
            )
        try:
            date = dt.strptime(date_str, '%Y-%m-%d').date()
        except ValueError:
            return Response(
                {'detail': 'فرمت تاریخ نادرست است (YYYY-MM-DD)'},
                status=status.HTTP_400_BAD_REQUEST
            )

        tables = Table.objects.filter(is_active=True).order_by('number')
        reservations = Reservation.objects.filter(
            date=date,
            status__in=[Reservation.Status.PENDING, Reservation.Status.CONFIRMED],
            table__in=tables,
        ).select_related('table')

        res_by_table = {}
        for res in reservations:
            if res.table_id not in res_by_table:
                res_by_table[res.table_id] = []
            res_by_table[res.table_id].append({
                'start_time': str(res.start_time)[:5],
                'end_time': str(res.end_time)[:5],
                'guests_count': res.guests_count,
            })

        result = []
        for table in tables:
            data = dict(TableSerializer(table).data)
            data['reservations_today'] = res_by_table.get(table.id, [])
            result.append(data)

        return Response(result)


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


class ActiveTablesView(generics.ListAPIView):
    """میزهای فعال برای انتخاب هنگام سفارش"""
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = TableSerializer

    def get_queryset(self):  # type: ignore[override]
        return Table.objects.filter(is_active=True).order_by('number')


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

        res_date = serializer.validated_data['date']
        start_time = serializer.validated_data['start_time']
        end_time = serializer.validated_data['end_time']

        # یک رزرو فعال برای هر کاربر در هر روز
        duplicate = Reservation.objects.filter(
            user=request.user,
            date=res_date,
            status__in=[Reservation.Status.PENDING, Reservation.Status.CONFIRMED],
        )
        if duplicate.exists():
            return Response(
                {'detail': 'شما برای این روز از قبل رزرو فعال دارید. برای تعداد بیشتر یا ساعت بیشتر با مدیریت هماهنگ کنید.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # بررسی حداکثر مدت رزرو
        rsettings = ReservationSettings.get_settings()
        start_dt = dt.combine(res_date, start_time)
        end_dt = dt.combine(res_date, end_time)
        duration_hours = (end_dt - start_dt).total_seconds() / 3600
        if duration_hours > rsettings.max_reservation_hours:
            return Response(
                {'detail': f'حداکثر مدت رزرو {rsettings.max_reservation_hours} ساعت است. برای ساعت بیشتر با مدیریت هماهنگ کنید.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # برای امروز: ساعت شروع باید حداقل ۱ ساعت از اکنون باشد
        if res_date == timezone.localtime(timezone.now()).date():
            min_start = (timezone.localtime(timezone.now()) + timedelta(hours=1)).time()
            if start_time < min_start:
                return Response(
                    {'detail': 'ساعت شروع رزرو باید حداقل یک ساعت از زمان فعلی بیشتر باشد'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        try:
            reservation = serializer.save(user=request.user)
        except Exception as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)

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


class AdminTableBulkToggleView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def post(self, request):
        table_ids = request.data.get('table_ids')
        location = request.data.get('location')
        is_active = request.data.get('is_active')

        if is_active is None:
            return Response({'detail': 'پارامترهای نامعتبر است'}, status=status.HTTP_400_BAD_REQUEST)

        if location:
            tables = Table.objects.filter(location=location)
        elif table_ids:
            tables = Table.objects.filter(pk__in=table_ids)
        else:
            return Response({'detail': 'هیچ میزی انتخاب نشده است'}, status=status.HTTP_400_BAD_REQUEST)

        updated = tables.update(is_active=bool(is_active))
        return Response({'updated': updated})


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
        return qs.order_by('-date', '-start_time')


class AdminReservationDetailView(generics.RetrieveUpdateAPIView):
    permission_classes = [permissions.IsAdminUser]
    serializer_class = AdminReservationSerializer

    def get_queryset(self):  # type: ignore[override]
        return Reservation.objects.all()

    def perform_update(self, serializer):  # type: ignore[override]
        reservation = serializer.save()
        if 'status' in self.request.data:
            _log_reservation_status_change(self.request.user, reservation)


# ─── Waiter Views ────────────────────────────────────────────────────────────

class WaiterReservationListView(generics.ListAPIView):
    permission_classes = [IsWaiter]
    serializer_class = AdminReservationSerializer

    def list(self, request, *args, **kwargs):
        perm = getattr(request.user, 'waiter_permissions', None)
        if not perm or not perm.can_manage_reservations:
            return Response({'detail': 'دسترسی به مدیریت رزروها ندارید'}, status=status.HTTP_403_FORBIDDEN)
        return super().list(request, *args, **kwargs)

    def get_queryset(self):
        perm = getattr(self.request.user, 'waiter_permissions', None)
        if not perm or not perm.can_manage_reservations:
            return Reservation.objects.none()
        qs = Reservation.objects.all().select_related('user', 'table')
        date = self.request.query_params.get('date')
        status_filter = self.request.query_params.get('status')
        if date:
            qs = qs.filter(date=date)
        if status_filter:
            qs = qs.filter(status=status_filter)
        return qs.order_by('-date', '-start_time')


class WaiterReservationUpdateView(APIView):
    permission_classes = [IsWaiter]

    def patch(self, request, pk):
        perm = getattr(request.user, 'waiter_permissions', None)
        if not perm or not perm.can_manage_reservations:
            return Response({'detail': 'دسترسی به مدیریت رزروها ندارید'}, status=status.HTTP_403_FORBIDDEN)
        try:
            reservation = Reservation.objects.get(pk=pk)
        except Reservation.DoesNotExist:
            return Response({'detail': 'رزرو یافت نشد'}, status=status.HTTP_404_NOT_FOUND)
        allowed = [Reservation.Status.CONFIRMED, Reservation.Status.COMPLETED,
                   Reservation.Status.CANCELLED, Reservation.Status.NO_SHOW]
        new_status = request.data.get('status')
        if new_status and new_status not in [s.value for s in allowed]:
            return Response({'detail': 'وضعیت نامعتبر'}, status=status.HTTP_400_BAD_REQUEST)
        ser = AdminReservationSerializer(reservation, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        reservation = ser.save()
        if 'status' in request.data:
            _log_reservation_status_change(request.user, reservation)
        return Response(ser.data)


class WaiterTableListView(APIView):
    permission_classes = [IsWaiter]

    def get(self, request):
        perm = getattr(request.user, 'waiter_permissions', None)
        if not perm or not perm.can_manage_tables:
            return Response({'detail': 'دسترسی به مدیریت میزها ندارید'}, status=status.HTTP_403_FORBIDDEN)
        tables = Table.objects.all().order_by('number')
        return Response(TableSerializer(tables, many=True).data)


class WaiterTableUpdateView(APIView):
    permission_classes = [IsWaiter]

    def patch(self, request, pk):
        perm = getattr(request.user, 'waiter_permissions', None)
        if not perm or not perm.can_manage_tables:
            return Response({'detail': 'دسترسی به مدیریت میزها ندارید'}, status=status.HTTP_403_FORBIDDEN)
        try:
            table = Table.objects.get(pk=pk)
        except Table.DoesNotExist:
            return Response({'detail': 'میز یافت نشد'}, status=status.HTTP_404_NOT_FOUND)
        table.is_active = request.data.get('is_active', table.is_active)
        table.save()
        return Response(TableSerializer(table).data)

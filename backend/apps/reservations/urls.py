from django.urls import path
from .views import (
    TableScheduleView, AvailableTablesView, ActiveTablesView,
    ReservationListCreateView, ReservationDetailView,
    AdminTableListCreateView, AdminTableDetailView, AdminTableBulkToggleView,
    AdminReservationListView, AdminReservationDetailView,
    WaiterReservationListView, WaiterReservationUpdateView,
    WaiterTableListView, WaiterTableUpdateView,
)

urlpatterns = [
    path('schedule/', TableScheduleView.as_view(), name='table-schedule'),
    path('available-tables/', AvailableTablesView.as_view(), name='available-tables'),
    path('active-tables/', ActiveTablesView.as_view(), name='active-tables'),
    path('', ReservationListCreateView.as_view(), name='reservations'),
    path('<int:pk>/', ReservationDetailView.as_view(), name='reservation-detail'),

    # Admin
    path('admin/tables/', AdminTableListCreateView.as_view(), name='admin-tables'),
    path('admin/tables/bulk-toggle/', AdminTableBulkToggleView.as_view(), name='admin-tables-bulk-toggle'),
    path('admin/tables/<int:pk>/', AdminTableDetailView.as_view(), name='admin-table-detail'),
    path('admin/reservations/', AdminReservationListView.as_view(), name='admin-reservations'),
    path('admin/reservations/<int:pk>/', AdminReservationDetailView.as_view(), name='admin-reservation-detail'),

    # Waiter
    path('waiter/', WaiterReservationListView.as_view(), name='waiter-reservations'),
    path('waiter/<int:pk>/', WaiterReservationUpdateView.as_view(), name='waiter-reservation-detail'),
    path('waiter/tables/', WaiterTableListView.as_view(), name='waiter-tables'),
    path('waiter/tables/<int:pk>/', WaiterTableUpdateView.as_view(), name='waiter-table-detail'),
]

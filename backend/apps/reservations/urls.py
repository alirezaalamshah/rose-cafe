from django.urls import path
from .views import (
    AvailableTablesView, ReservationListCreateView,
    ReservationDetailView, AdminTableListCreateView,
    AdminTableDetailView, AdminReservationListView,
    AdminReservationDetailView,
)

urlpatterns = [
    path('available-tables/', AvailableTablesView.as_view(), name='available-tables'),
    path('', ReservationListCreateView.as_view(), name='reservations'),
    path('<int:pk>/', ReservationDetailView.as_view(), name='reservation-detail'),

    # Admin
    path('admin/tables/', AdminTableListCreateView.as_view(), name='admin-tables'),
    path('admin/tables/<int:pk>/', AdminTableDetailView.as_view(), name='admin-table-detail'),
    path('admin/reservations/', AdminReservationListView.as_view(), name='admin-reservations'),
    path('admin/reservations/<int:pk>/', AdminReservationDetailView.as_view(), name='admin-reservation-detail'),
]
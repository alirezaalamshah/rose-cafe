from django.urls import path
from .views import StaffActionLogListView, StaffPerformanceReportView

urlpatterns = [
    path('', StaffActionLogListView.as_view(), name='staff-activity-log'),
    path('report/', StaffPerformanceReportView.as_view(), name='staff-performance-report'),
]

from django.urls import path
from .views import StaffActionLogListView, StaffPerformanceReportView, MyPerformanceView

urlpatterns = [
    path('', StaffActionLogListView.as_view(), name='staff-activity-log'),
    path('report/', StaffPerformanceReportView.as_view(), name='staff-performance-report'),
    path('my-performance/', MyPerformanceView.as_view(), name='my-performance'),
]

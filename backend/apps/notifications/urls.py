from django.urls import path
from .views import test_sms

urlpatterns = [
    path('test-sms/', test_sms, name='test-sms'),
]

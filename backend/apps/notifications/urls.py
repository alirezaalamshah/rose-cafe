from django.urls import path
from .views import test_sms, vapid_public_key, push_subscribe, push_unsubscribe

urlpatterns = [
    path('test-sms/', test_sms, name='test-sms'),
    path('push/vapid-public-key/', vapid_public_key, name='push-vapid-public-key'),
    path('push/subscribe/', push_subscribe, name='push-subscribe'),
    path('push/unsubscribe/', push_unsubscribe, name='push-unsubscribe'),
]

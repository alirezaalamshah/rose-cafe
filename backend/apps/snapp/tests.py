from unittest.mock import patch
from django.core.cache import cache
from rest_framework.test import APITestCase
from rest_framework import status

from apps.accounts.models import User, Address
from apps.orders.models import Order
from .models import SnappSettings, SnappCourierOrder, SnappFailureLog
from . import services


def _enabled_settings(**overrides):
    # CachedSingletonModel از کش فرآیندی استفاده می‌کند — cache.clear() لازم است
    # چون rollback خودکار هر تست فقط DB را برمی‌گرداند، نه کش را (الگوی wallet/tests.py)
    cache.clear()
    settings_obj = SnappSettings.get_settings()
    settings_obj.is_enabled = True
    settings_obj.store_address = 'دزفول، میدان فرهنگ'
    settings_obj.store_latitude = '32.382500'
    settings_obj.store_longitude = '48.404700'
    for key, value in overrides.items():
        setattr(settings_obj, key, value)
    settings_obj.save()
    return settings_obj


def _make_delivery_order(user, with_coordinates=True):
    address = Address.objects.create(
        user=user, title='خانه', city='دزفول', street='خیابان آزادگان',
        latitude='32.390000' if with_coordinates else '',
        longitude='48.410000' if with_coordinates else '',
    )
    return Order.objects.create(
        user=user, delivery_type=Order.DeliveryType.DELIVERY, address=address,
        payment_method=Order.PaymentMethod.ONLINE, final_price=150000,
    )


def _mock_get_order_detail(test_case):
    """dispatch_order موفق حالا بلافاصله یک GET جداگانه (client.get_order_detail) هم
    برای گرفتن trackingUrl می‌زند — بدون mock این تابع، تست‌ها به‌جای چند میلی‌ثانیه،
    منتظر timeout واقعی شبکه می‌مانند (چند ده ثانیه). در setUp هر کلاسی که
    dispatch_order موفق را تست می‌کند صدا زده می‌شود؛ addCleanup خودش را stop می‌کند."""
    patcher = patch(
        'apps.snapp.client.get_order_detail',
        return_value={'success': True, 'data': {'trackingUrl': 'https://track.example/mock'}},
    )
    patcher.start()
    test_case.addCleanup(patcher.stop)


class DispatchOrderTestCase(APITestCase):
    def setUp(self):
        cache.clear()
        _mock_get_order_detail(self)
        self.user = User.objects.create_user(phone='+989120000071', full_name='مشتری تست پیک')

    def test_dispatch_fails_when_integration_disabled(self):
        cache.clear()
        SnappSettings.get_settings()  # پیش‌فرض is_enabled=False
        order = _make_delivery_order(self.user)
        with self.assertRaises(services.DispatchError):
            services.dispatch_order(order)

    def test_dispatch_fails_when_store_not_ready(self):
        cache.clear()
        settings_obj = SnappSettings.get_settings()
        settings_obj.is_enabled = True
        settings_obj.save()  # بدون مختصات مبدا
        order = _make_delivery_order(self.user)
        with self.assertRaises(services.DispatchError):
            services.dispatch_order(order)

    def test_dispatch_fails_when_address_has_no_coordinates(self):
        _enabled_settings()
        order = _make_delivery_order(self.user, with_coordinates=False)
        with self.assertRaises(services.DispatchError):
            services.dispatch_order(order)

    def test_dispatch_fails_for_non_delivery_order(self):
        _enabled_settings()
        order = Order.objects.create(
            user=self.user, delivery_type=Order.DeliveryType.TAKEAWAY,
            payment_method=Order.PaymentMethod.CASH, final_price=50000,
        )
        with self.assertRaises(services.DispatchError):
            services.dispatch_order(order)

    @patch('apps.snapp.client.create_order')
    def test_dispatch_success_creates_courier_order(self, mock_create):
        _enabled_settings()
        order = _make_delivery_order(self.user)
        mock_create.return_value = {
            'success': True,
            'data': {'orderId': 'snapp-123', 'status': 'PENDING', 'trackingUrl': 'https://track.example/1'},
        }

        courier_order = services.dispatch_order(order)
        self.assertEqual(courier_order.snapp_order_id, 'snapp-123')
        self.assertEqual(courier_order.status, 'PENDING')
        self.assertEqual(SnappCourierOrder.objects.count(), 1)

    @patch('apps.snapp.client.create_order')
    def test_dispatch_twice_raises_already_dispatched(self, mock_create):
        _enabled_settings()
        order = _make_delivery_order(self.user)
        mock_create.return_value = {
            'success': True,
            'data': {'orderId': 'snapp-123', 'status': 'ACCEPTED', 'trackingUrl': ''},
        }
        services.dispatch_order(order)
        with self.assertRaises(services.DispatchError):
            services.dispatch_order(order)
        self.assertEqual(SnappCourierOrder.objects.count(), 1)

    @patch('apps.snapp.client.create_order')
    def test_dispatch_retries_after_previous_cancelled(self, mock_create):
        _enabled_settings()
        order = _make_delivery_order(self.user)
        mock_create.return_value = {'success': True, 'data': {'orderId': 'snapp-1', 'status': 'PENDING'}}
        first = services.dispatch_order(order)
        first.status = SnappCourierOrder.Status.CANCELLED
        first.save()

        mock_create.return_value = {'success': True, 'data': {'orderId': 'snapp-2', 'status': 'PENDING'}}
        second = services.dispatch_order(order)
        self.assertEqual(second.id, first.id)  # همان رکورد بازنویسی می‌شود، نه رکورد جدید
        self.assertEqual(second.snapp_order_id, 'snapp-2')
        self.assertEqual(SnappCourierOrder.objects.count(), 1)

    @patch('apps.snapp.client.create_order')
    def test_dispatch_propagates_client_failure_message(self, mock_create):
        _enabled_settings()
        order = _make_delivery_order(self.user)
        mock_create.return_value = {'success': False, 'message': 'خطای فرضی از اسنپ'}
        with self.assertRaises(services.DispatchError) as ctx:
            services.dispatch_order(order)
        self.assertEqual(ctx.exception.message, 'خطای فرضی از اسنپ')


class MaybeAutoDispatchTestCase(APITestCase):
    def setUp(self):
        cache.clear()
        _mock_get_order_detail(self)
        self.user = User.objects.create_user(phone='+989120000072', full_name='مشتری تست خودکار')

    @patch('apps.snapp.client.create_order')
    def test_auto_dispatch_on_confirm_when_mode_matches(self, mock_create):
        _enabled_settings(dispatch_mode=SnappSettings.DispatchMode.AUTO_ON_CONFIRM)
        order = _make_delivery_order(self.user)
        mock_create.return_value = {'success': True, 'data': {'orderId': 'snapp-9', 'status': 'PENDING'}}

        services.maybe_auto_dispatch(order, trigger='confirm')
        self.assertTrue(SnappCourierOrder.objects.filter(order=order).exists())

    @patch('apps.snapp.client.create_order')
    def test_auto_dispatch_skips_when_trigger_mismatches_mode(self, mock_create):
        _enabled_settings(dispatch_mode=SnappSettings.DispatchMode.AUTO_ON_READY)
        order = _make_delivery_order(self.user)

        services.maybe_auto_dispatch(order, trigger='confirm')
        mock_create.assert_not_called()
        self.assertFalse(SnappCourierOrder.objects.filter(order=order).exists())

    @patch('apps.snapp.client.create_order')
    def test_auto_dispatch_swallows_errors_silently(self, mock_create):
        _enabled_settings(dispatch_mode=SnappSettings.DispatchMode.AUTO_ON_CONFIRM)
        order = _make_delivery_order(self.user)
        mock_create.return_value = {'success': False, 'message': 'خطا'}

        # نباید exception بالا بیاید — فقط لاگ می‌شود
        services.maybe_auto_dispatch(order, trigger='confirm')
        self.assertFalse(SnappCourierOrder.objects.filter(order=order).exists())

    def test_auto_dispatch_skips_when_integration_disabled(self):
        cache.clear()
        SnappSettings.get_settings()
        order = _make_delivery_order(self.user)
        services.maybe_auto_dispatch(order, trigger='confirm')  # نباید خطا بدهد
        self.assertFalse(SnappCourierOrder.objects.filter(order=order).exists())


class SnappWebhookViewTestCase(APITestCase):
    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user(phone='+989120000073', full_name='مشتری تست وبهوک')
        self.order = _make_delivery_order(self.user)
        self.courier_order = SnappCourierOrder.objects.create(
            order=self.order, snapp_order_id='snapp-webhook-1', status=SnappCourierOrder.Status.PENDING,
        )

    def test_webhook_rejects_missing_or_wrong_token(self):
        url = '/api/snapp/webhook/'
        response = self.client.post(url, data={'customerRefId': self.order.order_number}, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    @patch('django.conf.settings.SNAPP_BOX_WEBHOOK_TOKEN', 'secret-token')
    def test_webhook_updates_status_by_customer_ref_id(self):
        url = '/api/snapp/webhook/?token=secret-token'
        response = self.client.post(url, data={
            'webhookType': 'ORDER_ACCEPTED',
            'orderId': 'snapp-webhook-1',
            'orderStatus': 'ACCEPTED',
            'customerRefId': self.order.order_number,
            'bikerName': 'حامد قلی‌زاده',
            'bikerPhone': '09121112233',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.courier_order.refresh_from_db()
        self.assertEqual(self.courier_order.status, 'ACCEPTED')
        self.assertEqual(self.courier_order.biker_name, 'حامد قلی‌زاده')
        self.assertIsNotNone(self.courier_order.last_webhook_at)

    @patch('django.conf.settings.SNAPP_BOX_WEBHOOK_TOKEN', 'secret-token')
    def test_webhook_unknown_order_returns_200_without_error(self):
        url = '/api/snapp/webhook/?token=secret-token'
        response = self.client.post(url, data={
            'webhookType': 'ORDER_CANCELLED',
            'customerRefId': 'nonexistent-ref',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    @patch('apps.snapp.views.notify_courier_issue')
    @patch('django.conf.settings.SNAPP_BOX_WEBHOOK_TOKEN', 'secret-token')
    def test_webhook_concerning_event_triggers_push_notification(self, mock_notify):
        url = '/api/snapp/webhook/?token=secret-token'
        response = self.client.post(url, data={
            'webhookType': 'CANCEL_ALLOCATION',
            'orderId': 'snapp-webhook-1',
            'customerRefId': self.order.order_number,
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        mock_notify.assert_called_once()
        self.assertEqual(mock_notify.call_args[0][0], self.order)

    @patch('apps.snapp.views.notify_courier_issue')
    @patch('django.conf.settings.SNAPP_BOX_WEBHOOK_TOKEN', 'secret-token')
    def test_webhook_non_concerning_event_does_not_notify(self, mock_notify):
        url = '/api/snapp/webhook/?token=secret-token'
        response = self.client.post(url, data={
            'webhookType': 'ORDER_ACCEPTED',
            'orderId': 'snapp-webhook-1',
            'orderStatus': 'ACCEPTED',
            'customerRefId': self.order.order_number,
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        mock_notify.assert_not_called()

    @patch('django.conf.settings.SNAPP_BOX_WEBHOOK_TOKEN', 'secret-token')
    def test_webhook_status_update_stores_intermediate_statuses_and_location(self):
        """ORDER_STATUS_UPDATE با orderStatus های ARRIVED_AT_PICK_UP/ARRIVED_AT_DROP_OFF
        باید هم وضعیت هم مختصات لحظه‌ای همراه‌شده را ذخیره کند."""
        url = '/api/snapp/webhook/?token=secret-token'
        response = self.client.post(url, data={
            'webhookType': 'ORDER_STATUS_UPDATE',
            'orderId': 'snapp-webhook-1',
            'orderStatus': 'ARRIVED_AT_PICK_UP',
            'customerRefId': self.order.order_number,
            'latitude': 32.3838,
            'longitude': 48.4020,
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.courier_order.refresh_from_db()
        self.assertEqual(self.courier_order.status, 'ARRIVED_AT_PICK_UP')
        self.assertEqual(self.courier_order.current_latitude, '32.3838')
        self.assertEqual(self.courier_order.current_longitude, '48.402')
        self.assertTrue(self.courier_order.is_trackable)

    @patch('apps.snapp.views.notify_courier_delivered')
    @patch('django.conf.settings.SNAPP_BOX_WEBHOOK_TOKEN', 'secret-token')
    def test_webhook_delivered_triggers_delivered_notification(self, mock_notify):
        url = '/api/snapp/webhook/?token=secret-token'
        response = self.client.post(url, data={
            'webhookType': 'ORDER_STATUS_UPDATE',
            'orderId': 'snapp-webhook-1',
            'orderStatus': 'DELIVERED',
            'customerRefId': self.order.order_number,
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.courier_order.refresh_from_db()
        self.assertEqual(self.courier_order.status, 'DELIVERED')
        self.assertTrue(self.courier_order.is_terminal)
        mock_notify.assert_called_once_with(self.order)

    @patch('apps.snapp.views.notify_courier_delivered')
    @patch('django.conf.settings.SNAPP_BOX_WEBHOOK_TOKEN', 'secret-token')
    def test_webhook_repeated_delivered_does_not_renotify(self, mock_notify):
        """اگر اسنپ به هر دلیلی همان رویداد DELIVERED را دوباره بفرستد، نباید دوباره
        نوتیف تحویل بفرستیم — چون وضعیت از قبل DELIVERED بوده، نه تازه تغییر کرده."""
        self.courier_order.status = SnappCourierOrder.Status.DELIVERED
        self.courier_order.save()

        url = '/api/snapp/webhook/?token=secret-token'
        response = self.client.post(url, data={
            'webhookType': 'ORDER_STATUS_UPDATE',
            'orderId': 'snapp-webhook-1',
            'orderStatus': 'DELIVERED',
            'customerRefId': self.order.order_number,
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        mock_notify.assert_not_called()


class CircuitBreakerTestCase(APITestCase):
    def setUp(self):
        cache.clear()
        _mock_get_order_detail(self)
        self.user = User.objects.create_user(phone='+989120000074', full_name='مشتری تست سوییچ اضطراری')

    @patch('apps.snapp.client.create_order')
    def test_circuit_breaker_trips_after_max_failures(self, mock_create):
        _enabled_settings(circuit_breaker_max_failures=3, circuit_breaker_window_minutes=15)
        mock_create.return_value = {'success': False, 'message': 'خطای فرضی'}

        for _ in range(3):
            order = _make_delivery_order(self.user)
            with self.assertRaises(services.DispatchError):
                services.dispatch_order(order)

        settings_obj = SnappSettings.get_settings()
        self.assertTrue(settings_obj.circuit_breaker_tripped)
        self.assertEqual(SnappFailureLog.objects.count(), 3)

    @patch('apps.snapp.client.create_order')
    def test_dispatch_blocked_when_circuit_breaker_tripped(self, mock_create):
        settings_obj = _enabled_settings()
        settings_obj.trip_circuit_breaker()
        order = _make_delivery_order(self.user)

        with self.assertRaises(services.DispatchError):
            services.dispatch_order(order)
        mock_create.assert_not_called()

    def test_reset_circuit_breaker_clears_tripped_state(self):
        settings_obj = _enabled_settings()
        settings_obj.trip_circuit_breaker()
        self.assertTrue(settings_obj.circuit_breaker_tripped)

        settings_obj.reset_circuit_breaker()
        self.assertFalse(settings_obj.circuit_breaker_tripped)

    @patch('apps.snapp.client.create_order')
    def test_circuit_breaker_does_not_trip_below_threshold(self, mock_create):
        _enabled_settings(circuit_breaker_max_failures=5, circuit_breaker_window_minutes=15)
        mock_create.return_value = {'success': False, 'message': 'خطای فرضی'}

        for _ in range(3):
            order = _make_delivery_order(self.user)
            with self.assertRaises(services.DispatchError):
                services.dispatch_order(order)

        settings_obj = SnappSettings.get_settings()
        self.assertFalse(settings_obj.circuit_breaker_tripped)


class AutoCancelOnTerminationTestCase(APITestCase):
    def setUp(self):
        cache.clear()
        _mock_get_order_detail(self)
        self.user = User.objects.create_user(phone='+989120000075', full_name='مشتری تست لغو خودکار')

    @patch('apps.snapp.client.cancel_order')
    @patch('apps.snapp.client.create_order')
    def test_active_courier_cancelled_when_order_terminates(self, mock_create, mock_cancel):
        _enabled_settings()
        order = _make_delivery_order(self.user)
        mock_create.return_value = {'success': True, 'data': {'orderId': 'snapp-1', 'status': 'ACCEPTED'}}
        services.dispatch_order(order)
        mock_cancel.return_value = {'success': True}

        services.maybe_cancel_on_order_termination(order)

        courier_order = SnappCourierOrder.objects.get(order=order)
        self.assertEqual(courier_order.status, SnappCourierOrder.Status.CANCELLED)
        mock_cancel.assert_called_once_with('snapp-1')

    def test_no_courier_order_is_noop(self):
        order = _make_delivery_order(self.user)
        services.maybe_cancel_on_order_termination(order)  # نباید خطا بدهد
        self.assertFalse(SnappCourierOrder.objects.filter(order=order).exists())

    @patch('apps.snapp.client.cancel_order')
    @patch('apps.snapp.client.create_order')
    def test_already_terminal_courier_is_not_cancelled_again(self, mock_create, mock_cancel):
        _enabled_settings()
        order = _make_delivery_order(self.user)
        mock_create.return_value = {'success': True, 'data': {'orderId': 'snapp-1', 'status': 'DELIVERED'}}
        services.dispatch_order(order)

        services.maybe_cancel_on_order_termination(order)
        mock_cancel.assert_not_called()


class RetryDispatchViewTestCase(APITestCase):
    def setUp(self):
        cache.clear()
        _mock_get_order_detail(self)
        self.admin = User.objects.create_user(phone='+989120000076', full_name='ادمین تست')
        self.admin.is_staff = True
        self.admin.save()
        self.user = User.objects.create_user(phone='+989120000077', full_name='مشتری تست ارسال مجدد')
        self.client.force_authenticate(self.admin)

    @patch('apps.snapp.client.create_order')
    def test_retry_dispatch_succeeds_after_cancellation(self, mock_create):
        _enabled_settings()
        order = _make_delivery_order(self.user)
        mock_create.return_value = {'success': True, 'data': {'orderId': 'snapp-1', 'status': 'PENDING'}}
        courier_order = services.dispatch_order(order)
        courier_order.status = SnappCourierOrder.Status.CANCELLED
        courier_order.save()

        mock_create.return_value = {'success': True, 'data': {'orderId': 'snapp-2', 'status': 'PENDING'}}
        response = self.client.post(f'/api/snapp/admin/orders/{order.id}/retry/')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['snapp_order_id'], 'snapp-2')
        self.assertEqual(response.data['retry_count'], 1)

    def test_retry_dispatch_fails_when_never_dispatched(self):
        order = _make_delivery_order(self.user)
        response = self.client.post(f'/api/snapp/admin/orders/{order.id}/retry/')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class DeliveryZoneInfoViewTestCase(APITestCase):
    """endpoint عمومی مبدا/شعاع — برای نمایش فاصله‌ی زنده در فرم آدرس مشتری،
    بدون نیاز به احراز هویت ادمین."""

    def test_returns_zone_info_without_authentication(self):
        cache.clear()
        _enabled_settings(max_delivery_radius_km=20)
        response = self.client.get('/api/snapp/delivery-zone/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['store_latitude'], '32.382500')
        self.assertEqual(response.data['max_delivery_radius_km'], 20)

    def test_does_not_leak_client_credentials(self):
        cache.clear()
        _enabled_settings()
        response = self.client.get('/api/snapp/delivery-zone/')
        self.assertNotIn('client_id', response.data)
        self.assertNotIn('client_secret', response.data)


class GetAccessTokenTestCase(APITestCase):
    """اسنپ‌باکس (محیط استیج) گاهی expires_in را یک عدد نجومی غیرواقعی برمی‌گرداند
    (مثلاً چند هزار سال) — دیده‌شده روی هاست واقعی: cache.set با این مقدار خام
    تلاش می‌کرد یک تاریخ انقضا بسازد و با ValueError('year ... out of range')
    می‌ترکید، و کل درخواست توکنِ در واقع موفق را شکست‌خورده گزارش می‌کرد."""

    def setUp(self):
        cache.clear()

    @patch('apps.snapp.client.requests.post')
    def test_absurd_expires_in_does_not_crash_token_caching(self, mock_post):
        mock_post.return_value.json.return_value = {
            'access_token': 'real-token-despite-bad-expiry',
            'expires_in': 1209599000000000,
        }
        from . import client
        token = client.get_access_token()
        self.assertEqual(token, 'real-token-despite-bad-expiry')

    @patch('apps.snapp.client.requests.post')
    def test_normal_expires_in_still_works(self, mock_post):
        mock_post.return_value.json.return_value = {
            'access_token': 'normal-token',
            'expires_in': 3600,
        }
        from . import client
        token = client.get_access_token()
        self.assertEqual(token, 'normal-token')
        self.assertEqual(cache.get(client.TOKEN_CACHE_KEY), 'normal-token')

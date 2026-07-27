"""
تست‌های مسیر حیاتی «رزرو میز» — بخصوص محدود کردن رزرو به ساعات کاری کافه،
که قبلاً باگ داشت (مشتری می‌توانست خارج از ساعت کاری میز رزرو کند).
"""
from datetime import time, timedelta

from django.utils import timezone
from rest_framework.test import APITestCase
from rest_framework import status

from apps.accounts.models import User
from apps.business.models import BusinessHours
from .models import Table, Reservation


class ReservationBusinessHoursTestCase(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(phone='+989120000002', full_name='مشتری تست رزرو')
        self.client.force_authenticate(user=self.user)
        self.table = Table.objects.create(number=1, capacity=4, is_active=True)

        # تاریخی چند روز جلوتر تا هم قانون «حداقل ۱ ساعت از الان» و هم گذشته بودن تاریخ درگیر نشود
        self.future_date = timezone.localtime(timezone.now()).date() + timedelta(days=5)
        self.weekday = self.future_date.weekday()

        BusinessHours.objects.update_or_create(
            day_of_week=self.weekday,
            defaults={'is_open': True, 'open_time': time(8, 0), 'close_time': time(22, 0)},
        )

    def _post_reservation(self, start, end, **overrides):
        payload = {
            'table': self.table.id,
            'date': str(self.future_date),
            'start_time': start,
            'end_time': end,
            'guests_count': 2,
        }
        payload.update(overrides)
        return self.client.post('/api/reservations/', payload, format='json')

    def test_reservation_within_business_hours_succeeds(self):
        response = self._post_reservation('10:00', '11:00')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)

    def test_reservation_before_opening_rejected(self):
        response = self._post_reservation('06:00', '07:00')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Reservation.objects.count(), 0)

    def test_reservation_after_closing_rejected(self):
        response = self._post_reservation('21:30', '23:00')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Reservation.objects.count(), 0)

    def test_reservation_on_closed_day_rejected(self):
        BusinessHours.objects.filter(day_of_week=self.weekday).update(is_open=False)
        response = self._post_reservation('10:00', '11:00')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Reservation.objects.count(), 0)

    def test_reservation_exceeding_table_capacity_rejected(self):
        response = self._post_reservation('10:00', '11:00', guests_count=10)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_overlapping_reservation_on_same_table_rejected(self):
        first = self._post_reservation('10:00', '12:00')
        self.assertEqual(first.status_code, status.HTTP_201_CREATED, first.data)

        # کاربر دومی که همان میز را در بازه‌ی هم‌پوشان می‌خواهد
        other_user = User.objects.create_user(phone='+989120000003', full_name='مشتری دوم')
        self.client.force_authenticate(user=other_user)
        second = self._post_reservation('11:00', '13:00')
        self.assertEqual(second.status_code, status.HTTP_400_BAD_REQUEST)

    def test_reservation_business_hours_only_enforced_on_creation_not_update(self):
        """
        طبق طراحی عمدی کد (clean() با `if not self.pk`): اگر ادمین بعداً ساعات کاری را
        محدودتر کند، این نباید رزروهای قدیمی را که قبلاً معتبر بودند خراب کند.
        """
        response = self._post_reservation('10:00', '11:00')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        reservation = Reservation.objects.get(pk=response.data['id'])

        # حالا ساعات کاری را محدودتر می‌کنیم — طوری که رزرو موجود دیگر داخل بازه نیست
        BusinessHours.objects.filter(day_of_week=self.weekday).update(
            open_time=time(12, 0), close_time=time(22, 0),
        )

        # آپدیت یک فیلد بی‌ربط (مثلاً note) نباید بترکد چون رزرو از قبل وجود داشته (self.pk موجود است)
        reservation.note = 'یادداشت جدید'
        reservation.save()
        reservation.refresh_from_db()
        self.assertEqual(reservation.note, 'یادداشت جدید')

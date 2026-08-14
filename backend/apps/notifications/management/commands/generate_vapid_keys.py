import base64

from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat
from django.core.management.base import BaseCommand
from py_vapid import Vapid02


class Command(BaseCommand):
    help = 'یک جفت کلید VAPID جدید برای Web Push می‌سازد — مقادیر تولیدشده را در .env (هم لوکال هم هاست) بگذار'

    def handle(self, *args, **options):
        vapid = Vapid02()
        vapid.generate_keys()

        private_raw = vapid.private_key.private_numbers().private_value.to_bytes(32, 'big')
        private_b64 = base64.urlsafe_b64encode(private_raw).rstrip(b'=').decode()

        public_raw = vapid.public_key.public_bytes(
            encoding=Encoding.X962, format=PublicFormat.UncompressedPoint,
        )
        public_b64 = base64.urlsafe_b64encode(public_raw).rstrip(b'=').decode()

        # عمداً پیام‌های خروجی انگلیسی‌اند — کنسول ویندوز با codepage قدیمی (cp1256) روی
        # چاپ متن فارسی از style.SUCCESS/WARNING کرش می‌کند؛ خود مقادیر کلید که مهم‌ترند
        # base64url (فقط ASCII) هستند و مشکلی ندارند
        self.stdout.write(self.style.SUCCESS('New VAPID key pair generated — put these in .env:'))
        self.stdout.write(f'VAPID_PUBLIC_KEY={public_b64}')
        self.stdout.write(f'VAPID_PRIVATE_KEY={private_b64}')
        self.stdout.write(self.style.WARNING(
            'Note: changing these keys invalidates every existing PushSubscription — '
            'users will need to re-enable notifications.'
        ))

from rest_framework.throttling import SimpleRateThrottle, AnonRateThrottle


class PhonePostThrottle(SimpleRateThrottle):
    """
    محدودیت بر اساس شماره موبایل داخل بدنه‌ی درخواست (نه IP) — چون ریسک اصلی
    اسپم پیامکی/brute-force روی یک شماره‌ی مشخص است، صرف‌نظر از این‌که مهاجم
    از چند IP مختلف استفاده کند. اگر شماره در درخواست نباشد، throttle نمی‌کند
    (سریالایزر خودش خطای اعتبارسنجی لازم را برمی‌گرداند).
    """
    def get_cache_key(self, request, view):
        phone = request.data.get('phone')
        if not phone:
            return None
        return self.cache_format % {'scope': self.scope, 'ident': phone}


class OTPSendThrottle(PhonePostThrottle):
    """ارسال OTP (ثبت‌نام/ورود/فراموشی رمز) — سقف روی همان شماره"""
    scope = 'otp_send'


class OTPSendIPThrottle(AnonRateThrottle):
    """سقف روی IP هم لازم است وگرنه یک مهاجم می‌تواند به شماره‌های زیادی OTP بفرستد"""
    scope = 'otp_send_ip'


class OTPVerifyThrottle(PhonePostThrottle):
    """تلاش برای وارد کردن کد OTP — جلوگیری از حدس زدن کد ۶ رقمی در بازه‌ی اعتبار آن"""
    scope = 'otp_verify'


class LoginThrottle(PhonePostThrottle):
    """تلاش ورود با رمز عبور — جلوگیری از brute-force رمز روی یک شماره"""
    scope = 'login'

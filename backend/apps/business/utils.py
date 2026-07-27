from django.utils import timezone


def get_cafe_status() -> dict:
    """
    وضعیت فعلی کافه را برمی‌گرداند.
    ابتدا روزهای خاص را بررسی می‌کند، سپس ساعات هفتگی.
    """
    from .models import BusinessHours, SpecialDay

    now = timezone.localtime(timezone.now())
    today = now.date()
    current_time = now.time()

    # ۱. روز خاص
    try:
        special = SpecialDay.objects.get(date=today)
        if special.is_closed:
            return {
                'is_open': False,
                'reason': 'special_closed',
                'message': f'کافه امروز تعطیل است{" — " + special.note if special.note else ""}',
                'note': special.note,
            }
        else:
            # ساعت خاص
            if special.open_time and special.close_time:
                in_hours = special.open_time <= current_time <= special.close_time
                return {
                    'is_open': in_hours,
                    'reason': 'special_hours',
                    'open_time': str(special.open_time)[:5],
                    'close_time': str(special.close_time)[:5],
                    'message': (
                        f'کافه باز است (ساعت ویژه: {str(special.open_time)[:5]} تا {str(special.close_time)[:5]})'
                        if in_hours
                        else f'کافه فعلاً بسته است (ساعت ویژه: {str(special.open_time)[:5]} تا {str(special.close_time)[:5]})'
                    ),
                    'note': special.note,
                }
    except SpecialDay.DoesNotExist:
        pass

    # ۲. ساعات هفتگی معمول
    weekday = today.weekday()  # 0=Mon … 6=Sun
    try:
        bh = BusinessHours.objects.get(day_of_week=weekday)
    except BusinessHours.DoesNotExist:
        return {'is_open': False, 'reason': 'no_schedule', 'message': 'برنامه کاری برای امروز تعریف نشده'}

    if not bh.is_open:
        from .models import WEEKDAY_NAMES
        day_name = WEEKDAY_NAMES.get(weekday, '')
        return {'is_open': False, 'reason': 'day_off', 'message': f'کافه {day_name} تعطیل است'}

    if bh.open_time and bh.close_time:
        in_hours = bh.open_time <= current_time <= bh.close_time
        return {
            'is_open': in_hours,
            'reason': 'regular',
            'open_time': str(bh.open_time)[:5],
            'close_time': str(bh.close_time)[:5],
            'message': (
                f'کافه باز است (تا {str(bh.close_time)[:5]})'
                if in_hours
                else f'ساعات کاری: {str(bh.open_time)[:5]} تا {str(bh.close_time)[:5]}'
            ),
        }

    # ساعتی تعریف نشده اما روز باز است
    return {'is_open': True, 'reason': 'open_no_hours', 'message': 'کافه باز است'}

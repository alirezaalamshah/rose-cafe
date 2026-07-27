"""
تبدیل‌کننده‌های سفارشی مسیر URL.
"""


class UnicodeSlugConverter:
    """
    مثل converter پیش‌فرض `slug` جنگو ولی حروف یونیکد (فارسی) را هم می‌پذیرد —
    هماهنگ با SlugField(allow_unicode=True) که در مدل‌ها استفاده شده.
    converter پیش‌فرض جنگو فقط ASCII را قبول می‌کند و اسلاگ‌های فارسی را حتی
    اگر در دیتابیس معتبر ذخیره شده باشند، در URL هرگز match نمی‌کند.
    """
    regex = r'[-\w]+'

    def to_python(self, value):
        return value

    def to_url(self, value):
        return value

from rest_framework.pagination import PageNumberPagination


class StandardPagination(PageNumberPagination):
    """
    برای لیست‌های ادمینی که نظری روی رشدشان نداریم (کاربران، نظرات، پرداخت‌ها، کدهای تخفیف)
    تا فقط یک سقف امن روی کوئری/پاسخ باشد؛ صفحه‌بندی سراسری روی کل API عمداً فعال نشده
    چون فرانت اکثر لیست‌ها را به‌صورت آرایه‌ی کامل مصرف می‌کند.
    """
    page_size = 50
    page_size_query_param = 'page_size'
    max_page_size = 200

# PyMySQL را به‌جای mysqlclient معرفی می‌کنیم — چون mysqlclient نیاز به کامپایل با gcc دارد
# و هاست‌های اشتراکی معمولاً اجازه‌ی اجرای کامپایلر نمی‌دهند. باید قبل از هر import دیگری باشد.
import pymysql
pymysql.install_as_MySQLdb()

from .celery import app as celery_app

__all__ = ('celery_app',)
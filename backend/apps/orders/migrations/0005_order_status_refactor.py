from django.db import migrations, models


def forward(apps, schema_editor):
    Order = apps.get_model('orders', 'Order')
    Order.objects.filter(status='pending').update(status='waiting_payment')
    Order.objects.filter(status='confirmed').update(status='paid')


def backward(apps, schema_editor):
    Order = apps.get_model('orders', 'Order')
    Order.objects.filter(status='waiting_payment').update(status='pending')
    Order.objects.filter(status='paid').update(status='confirmed')


class Migration(migrations.Migration):

    dependencies = [
        ('orders', '0004_cash_payment'),
    ]

    operations = [
        migrations.AlterField(
            model_name='order',
            name='status',
            field=models.CharField(
                choices=[
                    ('waiting_payment', 'در انتظار پرداخت'),
                    ('paid', 'پرداخت شده — در صف آماده‌سازی'),
                    ('preparing', 'در حال آماده‌سازی'),
                    ('ready', 'آماده تحویل'),
                    ('delivered', 'تحویل داده شد'),
                    ('cancelled', 'لغو شده'),
                ],
                default='waiting_payment',
                max_length=20,
                verbose_name='وضعیت',
            ),
        ),
        migrations.RunPython(forward, backward),
    ]

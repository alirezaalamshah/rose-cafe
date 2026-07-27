from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('payments', '0002_card_fields'),
    ]

    operations = [
        migrations.AlterField(
            model_name='payment',
            name='status',
            field=models.CharField(
                choices=[
                    ('init', 'شروع شده'),
                    ('pending', 'در انتظار تأیید درگاه'),
                    ('success', 'موفق'),
                    ('failed', 'ناموفق'),
                    ('cancelled', 'لغو شده'),
                ],
                default='init',
                max_length=20,
                verbose_name='وضعیت',
            ),
        ),
    ]

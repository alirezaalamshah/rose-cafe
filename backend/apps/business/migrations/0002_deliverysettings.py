from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('business', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='DeliverySettings',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('delivery_cost', models.PositiveIntegerField(default=35000, verbose_name='هزینه ارسال (تومان)')),
                ('free_delivery_threshold', models.PositiveIntegerField(
                    blank=True,
                    help_text='سفارش‌هایی با مبلغ بیشتر از این مقدار ارسال رایگان دارند. خالی = همیشه هزینه دارد',
                    null=True,
                    verbose_name='حداقل مبلغ برای ارسال رایگان',
                )),
            ],
            options={
                'verbose_name': 'تنظیمات ارسال',
                'verbose_name_plural': 'تنظیمات ارسال',
            },
        ),
    ]

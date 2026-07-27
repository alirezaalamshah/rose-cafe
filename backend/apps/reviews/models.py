from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from apps.accounts.models import User
from apps.menu.models import MenuItem


class Review(models.Model):
    user = models.ForeignKey(
        User, on_delete=models.CASCADE,
        related_name='reviews', verbose_name='کاربر'
    )
    menu_item = models.ForeignKey(
        MenuItem, on_delete=models.CASCADE,
        related_name='reviews', verbose_name='آیتم منو'
    )
    rating = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)],
        verbose_name='امتیاز'
    )
    comment = models.TextField(blank=True, verbose_name='نظر')
    is_approved = models.BooleanField(default=False, verbose_name='تایید شده')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'نظر'
        verbose_name_plural = 'نظرات'
        ordering = ['-created_at']
        unique_together = ['user', 'menu_item']

    def __str__(self):
        return f'{self.user} - {self.menu_item} - {self.rating}★'


class CafeReview(models.Model):
    user = models.ForeignKey(
        User, on_delete=models.CASCADE,
        related_name='cafe_reviews', verbose_name='کاربر'
    )
    rating = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)],
        verbose_name='امتیاز'
    )
    comment = models.TextField(blank=True, verbose_name='نظر')
    is_approved = models.BooleanField(default=False, verbose_name='تایید شده')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'نظر کافه'
        verbose_name_plural = 'نظرات کافه'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.user} - {self.rating}★'
# Rose Cafe

Full-stack ordering & management platform for a café — online menu, orders, reservations, and delivery, with a Django REST API and a React frontend.

**[English](#english) | [فارسی](#فارسی)**

---

## English

### About

Rose Cafe is a full-stack web application for running a café's online presence: browsing the menu, placing orders, booking table reservations, and managing delivery — plus an admin side for staff roles, banners, and business settings.

### Tech Stack

**Backend**
- Django 4 + Django REST Framework
- JWT authentication (`djangorestframework-simplejwt`) with phone/OTP login (Melipayamak SMS)
- PostgreSQL, Celery + Redis for background/scheduled tasks
- `drf-spectacular` for OpenAPI docs
- Jalali (Persian) calendar support via `jdatetime`

**Frontend**
- React + Vite
- Zustand for state management
- React Router, Axios, React Hot Toast
- Vazirmatn variable font (self-hosted)

### Features

- Customer accounts with OTP phone login and address book
- Live menu with categories and images
- Online ordering with delivery settings/pricing
- Table reservations
- Waiter/staff permission roles
- Business info, banners, and social links managed from an admin panel

### Getting Started

```bash
# Backend
cd backend
cp .env.example .env   # fill in SECRET_KEY, DATABASE_URL, SMS provider token
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver

# Frontend
cd frontend
npm install
npm run dev
```

---

## فارسی

### درباره

رز کافه یک اپلیکیشن فول‌استک برای اداره‌ی حضور آنلاین یک کافه است: نمایش منو، ثبت سفارش، رزرو میز و مدیریت ارسال — به‌همراه بخش مدیریتی برای نقش‌های پرسنل، بنرها و تنظیمات کسب‌وکار.

### پشته فناوری

**بک‌اند**
- Django 4 + Django REST Framework
- احراز هویت JWT با ورود از طریق شماره موبایل و کد یک‌بارمصرف (پیامک ملی‌پیامک)
- PostgreSQL، Celery و Redis برای وظایف پس‌زمینه/زمان‌بندی‌شده
- مستندسازی API با `drf-spectacular`
- پشتیبانی از تقویم شمسی با `jdatetime`

**فرانت‌اند**
- React + Vite
- مدیریت state با Zustand
- React Router، Axios، React Hot Toast
- فونت وزیرمتن (self-hosted)

### امکانات

- ثبت‌نام و ورود مشتری با کد یک‌بارمصرف پیامکی و دفترچه آدرس
- منوی زنده با دسته‌بندی و تصویر
- سفارش آنلاین با تنظیمات و هزینه ارسال
- رزرو میز
- نقش‌های دسترسی برای گارسون/پرسنل
- مدیریت اطلاعات کسب‌وکار، بنرها و شبکه‌های اجتماعی از پنل ادمین

### راه‌اندازی

```bash
# بک‌اند
cd backend
cp .env.example .env   # مقداردهی SECRET_KEY، DATABASE_URL و توکن سامانه پیامکی
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver

# فرانت‌اند
cd frontend
npm install
npm run dev
```

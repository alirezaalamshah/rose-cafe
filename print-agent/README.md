# برنامه چاپ فیش کافه (Print Agent)

این یک برنامه‌ی کوچک و مستقل است که روی کامپیوتر متصل به پرینتر حرارتی داخل
کافه نصب می‌شود. هر چند ثانیه سرور را چک می‌کند، سفارش‌های تازه تأییدشده را
می‌گیرد و روی پرینتر چاپ می‌کند — بدون هیچ پنل یا رابط کاربری؛ فقط در پس‌زمینه
اجرا می‌شود. متن فارسی روی فیش به‌صورت تصویر (نه فونت داخلی پرینتر) رندر
می‌شود، چون اکثر پرینترهای حرارتی ارزان هیچ فونت فارسی/عربی داخلی ندارند.

## نصب روی ویندوز (روش ساده — بدون ترمینال)

اگر فایل `CafePrintAgent-Setup.exe` را از ادمین سایت گرفته‌اید:

1. **پرینتر را در ویندوز نصب کنید** — اگر قبلاً این کار را نکرده‌اید، بخش
   «نصب پرینتر در ویندوز» در پایین همین صفحه را دنبال کنید. پرینتر باید قبل
   از نصب‌کننده آماده باشد چون فرم تنظیمات از لیست پرینترهای موجود می‌خواند.
2. روی `CafePrintAgent-Setup.exe` دابل‌کلیک کنید و Next → Next → Finish بزنید.
3. بلافاصله بعد از نصب، یک صفحه در مرورگر باز می‌شود — سه چیز را از ادمین
   سایت بگیرید و وارد کنید: **آدرس سایت**، **کلید چاپگر**، و پرینتر را از
   لیست کشویی انتخاب کنید. روی «ذخیره و آماده‌سازی» بزنید.
4. تمام شد. از این پس با هر بار روشن‌شدن سیستم، فیش‌ها خودکار چاپ می‌شوند —
   بدون نیاز به باز کردن هیچ برنامه یا ترمینالی.

اگر بعداً خواستید تنظیمات را تغییر دهید (مثلاً پرینتر را عوض کنید)، شورتکات
**«تنظیمات چاپگر فیش کافه»** روی دسکتاپ همان فرم را دوباره باز می‌کند.

> این نصب‌کننده باید از قبل توسط توسعه‌دهنده ساخته شده باشد — راهنمای ساخت آن
> در [`installer/README.md`](installer/README.md) است.

## نصب پرینتر در ویندوز

بیشتر پرینترهای حرارتی ارزان به‌صورت خودکار به‌عنوان یک پرینتر کامل شناسایی
نمی‌شوند (فقط دستگاه USB دیده می‌شوند). باید دستی یک پرینتر با درایور عمومی
اضافه کنید:

1. تایپ کنید `control printers` در منوی استارت و Enter بزنید (این Control Panel کلاسیک «Devices and Printers» را باز می‌کند).
2. روی **«Add a printer»** کلیک کنید.
3. اگر پرینتر خودکار پیدا نشد، پایین پنجره روی **«The printer that I want isn't listed»** کلیک کنید.
4. گزینه‌ی **«Add a local printer or network printer with manual settings»** را انتخاب و Next بزنید.
5. از منوی «Use an existing port»، پورتی با نام شبیه **USB001** یا **USB002** (Virtual printer port for USB) را انتخاب کنید و Next بزنید.
6. در صفحه‌ی درایور: از Manufacturer گزینه‌ی **Generic** و از Printers گزینه‌ی **Generic / Text Only** را انتخاب کنید و Next بزنید.
7. یک اسم دلخواه بگذارید (مثلاً `POS-80-RAW`) → Next.
8. اگر پرسید Share این پرینتر یا نه، **باید Share بشود** (تیک «Share this printer» را بزنید). Next → Finish.

⚠️ **نکته‌ی مهم:** پورت‌های مجازی USB (`USB001`, `USB002`, ...) گاهی بعد از
قطع/وصل‌شدن پرینتر یا ری‌استارت سیستم عوض می‌شوند. اگر بعد از مدتی چاپ کار
نکرد، به Devices and Printers برگردید، روی پرینتر راست‌کلیک کنید →
Printer properties → تب Ports، و پورت درست (آخرین `USBxxx` که در Device
Manager به پرینتر متصل است) را انتخاب کنید.

---

## اجرای دستی (برای توسعه/دیباگ، یا macOS و لینوکس)

این بخش برای توسعه‌دهنده‌هاست — کاربر نهایی روی ویندوز نیازی به این ندارد.

### پیش‌نیاز: نصب Node.js

1. به [nodejs.org](https://nodejs.org) بروید و نسخه‌ی **LTS** را دانلود و نصب کنید.
2. برای اطمینان از نصب: `node -v`

### نصب و اجرا

```
npm install
cp .env.example .env
# .env را با آدرس سایت/کلید/اسم پرینتر خود ویرایش کنید
npm start
```

### macOS / Linux

این سیستم‌ها معمولاً پرینتر USB را خودکار با CUPS شناسایی می‌کنند. از منوی
System Settings > Printers & Scanners پرینتر را اضافه کنید (درایور
"Generic Text-Only" یا "Generic PostScript" را انتخاب کنید اگر درایور
اختصاصی موجود نیست)، سپس مقدار `PRINTER_NAME` در `.env` را نام همان پرینتر
در CUPS بگذارید (با `lpstat -p` قابل مشاهده است).

### اجرای خودکار هنگام روشن‌شدن (macOS، با launchd)

1. یک فایل با نام `com.cafe.printagent.plist` در مسیر `~/Library/LaunchAgents/`
   با محتوای زیر بسازید (مسیرها را با مسیر واقعی خودتان جایگزین کنید):

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.cafe.printagent</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/local/bin/node</string>
    <string>/Users/YOUR_USERNAME/cafe-project/print-agent/index.js</string>
  </array>
  <key>WorkingDirectory</key>
  <string>/Users/YOUR_USERNAME/cafe-project/print-agent</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>/tmp/print-agent.log</string>
  <key>StandardErrorPath</key>
  <string>/tmp/print-agent-error.log</string>
</dict>
</plist>
```

2. مسیر دقیق `node` را با دستور `which node` در ترمینال پیدا کنید و در فایل بالا جایگزین کنید.
3. برای فعال‌سازی: `launchctl load ~/Library/LaunchAgents/com.cafe.printagent.plist`
4. برای توقف موقت: `launchctl unload ~/Library/LaunchAgents/com.cafe.printagent.plist`

## عیب‌یابی

- **«خطا در دریافت صف چاپ»** — آدرس سایت یا کلید چاپگر اشتباه است، یا سیستم به اینترنت وصل نیست.
- **«خطا در چاپ فیش: ...»** — یعنی اسم پرینتر اشتباه است یا پورت پرینتر عوض شده (به نکته‌ی مهم بالا مراجعه کنید).
- **چاپ Job در صف ویندوز گیر می‌کند (Error)** — معمولاً یعنی پورت پرینتر نصب‌شده
  با پورت واقعی دستگاه یکی نیست. در Device Manager دنبال ردیفی با نام شبیه
  «Printer POS-XX» بگردید، ببینید کدام `USBxxx` است، و در Printer properties >
  Ports همان را انتخاب کنید.
- **متن فارسی چاپ نمی‌شود یا اندازه/جای‌گذاری اشتباه است** — مطمئن شوید عرض
  کاغذ انتخاب‌شده (۵۸mm یا ۸۰mm) با کاغذ واقعی پرینتر مطابقت دارد.

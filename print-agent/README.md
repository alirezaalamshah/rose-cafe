# برنامه چاپ فیش کافه (Print Agent)

این یک برنامه‌ی کوچک و مستقل است که روی کامپیوتر متصل به پرینتر حرارتی داخل
کافه نصب می‌شود. هر چند ثانیه سرور را چک می‌کند، سفارش‌های تازه تأییدشده را
می‌گیرد و روی پرینتر چاپ می‌کند — بدون هیچ پنل یا رابط کاربری؛ فقط در پس‌زمینه
اجرا می‌شود. متن فارسی روی فیش به‌صورت تصویر (نه فونت داخلی پرینتر) رندر
می‌شود، چون اکثر پرینترهای حرارتی ارزان هیچ فونت فارسی/عربی داخلی ندارند.

**این برنامه به هیچ دانش برنامه‌نویسی نیاز ندارد — فقط مراحل زیر را دنبال کنید.**

## پیش‌نیاز: نصب Node.js

اگر Node.js روی سیستم نصب نیست:
1. به [nodejs.org](https://nodejs.org) بروید و نسخه‌ی **LTS** را دانلود و نصب کنید (نسخه پیش‌فرض همین صفحه).
2. برای اطمینان از نصب، یک ترمینال باز کنید و بنویسید: `node -v` — باید یک شماره نسخه نمایش دهد.

## مرحله ۱: نصب وابستگی‌ها

در ترمینال، داخل همین پوشه (`print-agent`) دستور زیر را اجرا کنید:

```
npm install
```

## مرحله ۲: نصب پرینتر در سیستم‌عامل

پرینتر حرارتی را با کابل USB به سیستم وصل کنید. برنامه از طریق صف چاپ استاندارد
سیستم‌عامل با پرینتر صحبت می‌کند (نه دسترسی مستقیم سخت‌افزاری) — پس باید یک
پرینتر در ویندوز/mac/لینوکس نصب شده باشد.

### ویندوز

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
8. اگر پرسید Share این پرینتر یا نه، **باید Share بشود** (تیک «Share this printer» را بزنید) — این اسم Share را در مرحله‌ی بعد نیاز داریم. Next → Finish.

⚠️ **نکته‌ی مهم:** پورت‌های مجازی USB (`USB001`, `USB002`, ...) گاهی بعد از
قطع/وصل‌شدن پرینتر یا ری‌استارت سیستم عوض می‌شوند. اگر بعد از مدتی چاپ کار
نکرد، به Devices and Printers برگردید، روی پرینتر راست‌کلیک کنید →
Printer properties → تب Ports، و پورت درست (آخرین `USBxxx` که در Device
Manager به پرینتر متصل است) را انتخاب کنید.

### macOS / Linux

این سیستم‌ها معمولاً پرینتر USB را خودکار با CUPS شناسایی می‌کنند. از منوی
System Settings > Printers & Scanners پرینتر را اضافه کنید (درایور
"Generic Text-Only" یا "Generic PostScript" را انتخاب کنید اگر درایور
اختصاصی موجود نیست).

## مرحله ۳: تنظیمات

فایل `.env.example` را کپی کرده و به نام `.env` ذخیره کنید، سپس مقادیر زیر را
پر کنید:

- `API_BASE_URL` — آدرس بک‌اند سایت (مثلاً `https://rccoffee.ir/api`)
- `PRINT_AGENT_API_KEY` — کلید مخفی که ادمین سایت در تنظیمات سرور
  (`PRINT_AGENT_API_KEY` در `backend/.env`) قرار داده — از ادمین سیستم بگیرید
- `PRINTER_NAME` — **اسم Share پرینتر** (نه اسم دستگاه) که در مرحله‌ی ۲ ساختید.
  برای پیدا کردنش: Devices and Printers → راست‌کلیک روی پرینتر → Printer
  properties → تب Sharing → مقدار «Share name»
- `PRINTER_WIDTH_PX` — عرض کاغذ به پیکسل: `384` برای پرینتر ۵۸mm، `576` برای پرینتر ۸۰mm (پیش‌فرض)

## مرحله ۴: اجرای آزمایشی

```
npm start
```

اگر همه‌چیز درست باشد، پیامی شبیه «برنامه چاپ فیش کافه شروع به کار کرد» می‌بینید.
یک سفارش تستی در سایت تأیید کنید — باید در عرض چند ثانیه چاپ شود. برای توقف
برنامه، کلیدهای `Ctrl+C` را بزنید.

## مرحله ۵: اجرای خودکار هنگام روشن‌شدن سیستم

برای اینکه لازم نباشد هر روز صبح دستی این برنامه را اجرا کنید، آن را طوری
تنظیم می‌کنیم که خودش هنگام روشن‌شدن کامپیوتر اجرا شود.

### ویندوز (با Task Scheduler)

1. دکمه‌ی استارت ویندوز را بزنید، تایپ کنید «Task Scheduler» و بازش کنید.
2. از منوی راست «Create Basic Task…» را بزنید.
3. یک نام دلخواه بگذارید (مثلاً «چاپ فیش کافه») و Next بزنید.
4. Trigger را روی «When the computer starts» بگذارید و Next بزنید.
5. Action را روی «Start a program» بگذارید و Next بزنید.
6. در «Program/script» مسیر کامل `node.exe` را بنویسید (معمولاً
   `C:\Program Files\nodejs\node.exe`).
7. در «Add arguments» بنویسید: `index.js`
8. در «Start in» مسیر کامل همین پوشه‌ی `print-agent` را بنویسید (همان پوشه‌ای
   که این فایل README در آن است).
9. Finish را بزنید.
10. روی تسک تازه‌ساخته‌شده دوبار کلیک کنید، به تب «General» بروید و گزینه‌ی
    «Run whether user is logged on or not» را فعال کنید تا حتی بدون ورود
    کاربر هم اجرا شود.

از این به بعد، با هر بار روشن‌شدن سیستم، برنامه خودکار در پس‌زمینه اجرا می‌شود.

### macOS (با launchd)

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

2. مسیر دقیق `node` را با دستور `which node` در ترمینال پیدا کنید و در فایل
   بالا جایگزین کنید.
3. برای فعال‌سازی:

```
launchctl load ~/Library/LaunchAgents/com.cafe.printagent.plist
```

از این به بعد، با هر بار روشن‌شدن/ورود به سیستم، برنامه خودکار اجرا می‌شود.
برای توقف موقت: `launchctl unload ~/Library/LaunchAgents/com.cafe.printagent.plist`

## عیب‌یابی

- **«خطا در دریافت صف چاپ»** — آدرس `API_BASE_URL` یا `PRINT_AGENT_API_KEY`
  اشتباه است، یا سیستم به اینترنت وصل نیست.
- **«خطا در چاپ فیش: ...»** با پیام مربوط به مسیر/دستور کپی — یعنی `PRINTER_NAME`
  اشتباه است یا پورت پرینتر عوض شده (به نکته‌ی مهم بالا در مرحله‌ی ۲ مراجعه کنید).
- **چاپ Job در صف ویندوز گیر می‌کند (Error)** — معمولاً یعنی پورت پرینتر نصب‌شده
  با پورت واقعی دستگاه یکی نیست. در Device Manager دنبال ردیفی با نام شبیه
  «Printer POS-XX» بگردید، ببینید کدام `USBxxx` است، و در Printer properties >
  Ports همان را انتخاب کنید.
- **متن فارسی چاپ نمی‌شود یا اندازه/جای‌گذاری اشتباه است** — مطمئن شوید
  `PRINTER_WIDTH_PX` با عرض واقعی کاغذ (۵۸mm=384 یا ۸۰mm=576) مطابقت دارد.
- روی هر سیستم‌عاملی، لاگ‌های ترمینال (یا فایل لاگ در حالت اجرای خودکار) دلیل
  دقیق خطا را نشان می‌دهند.

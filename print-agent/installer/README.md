# ساخت نصب‌کننده‌ی ویندوزی (CafePrintAgent-Setup.exe)

این پوشه اسکریپت Inno Setup را دارد که برنامه‌ی چاپ فیش را به یک نصب‌کننده‌ی
استاندارد ویندوزی تبدیل می‌کند — کاربر نهایی فقط `CafePrintAgent-Setup.exe`
را دابل‌کلیک می‌کند، Next → Next → Finish می‌زند، و بعد یک فرم گرافیکی برای
وارد کردن آدرس سایت/کلید/پرینتر می‌بیند. هیچ ترمینال یا npm install لازم
نیست — چون Node.js به‌صورت portable داخل نصب‌کننده bundle می‌شود.

## پیش‌نیازها (فقط برای کسی که installer را می‌سازد، نه برای کاربر نهایی)

1. [Inno Setup 6](https://jrsoftware.org/isinfo.php) نصب شده باشد.
2. در پوشه‌ی `print-agent/` دستور `npm install` اجرا شده باشد (تا `node_modules`
   با نسخه‌ی صحیح `@napi-rs/canvas` برای ویندوز آماده باشد).
3. یک نسخه‌ی portable ویندوزی Node.js (zip) دانلود و در `installer/node-runtime/`
   استخراج شود — این پوشه در گیت commit نمی‌شود (حجیم است)، هر بار قبل از
   ساخت installer باید دوباره آماده شود:

```
curl -L -o node.zip https://nodejs.org/dist/v22.14.0/node-v22.14.0-win-x64.zip
# استخراج، و از داخلش فقط node.exe و LICENSE را در installer/node-runtime/ نگه دارید
# (npm/npx/corepack/node_modules داخل توزیع Node.js لازم نیستند و حجم را زیاد می‌کنند)
```

## ساخت

```
"C:\Users\<username>\AppData\Local\Programs\Inno Setup 6\ISCC.exe" setup.iss
```

خروجی در `installer/dist/CafePrintAgent-Setup.exe` ساخته می‌شود.

## نکات فنی مهم (اگر بعداً چیزی را تغییر می‌دهید)

- **مسیر `.env`**: برنامه در Program Files نصب می‌شود، جایی که کاربر عادی
  (بدون دسترسی مدیر) اجازه‌ی نوشتن ندارد. به همین دلیل `.env` واقعی در
  `%APPDATA%\CafePrintAgent\.env` ذخیره می‌شود (هم توسط `config-server.js`
  نوشته می‌شود، هم توسط `index.js` خوانده می‌شود) — نه کنار فایل‌های برنامه.
- **فایل‌های `.vbs`**: باید ASCII خالص باشند (بدون کاراکتر فارسی، حتی در
  کامنت). موتور کلاسیک VBScript با UTF-8 (چه با BOM چه بدون آن) خطای
  «Invalid character» می‌دهد.
- **مسیر `setup-config.html`**: در Inno Setup عمداً به `{app}\app\installer\`
  کپی می‌شود (نه `{app}\installer\`) تا با مسیر نسبی که `config-server.js`
  انتظار دارد (`__dirname/installer/setup-config.html`) یکی بماند — این ساختار
  دقیقاً همان چیزی است که در حالت توسعه (`print-agent/installer/`) هم وجود دارد.
- **اجرای خودکار**: با `schtasks.exe /SC ONSTART` ثبت می‌شود (نه Startup
  folder) تا حتی بدون لاگین کاربر هم اجرا شود — کافه ممکن است بعد از قطعی
  برق نیاز به این داشته باشد که پرینتر بدون نیاز به کسی لاگین کند کار کند.

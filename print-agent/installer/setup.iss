; اسکریپت Inno Setup — برنامه‌ی چاپ فیش کافه را به یک نصب‌کننده‌ی استاندارد
; ویندوزی تبدیل می‌کند. کاربر (غیر برنامه‌نویس) فقط باید:
;   ۱. setup.exe را دابل‌کلیک کند و Next → Next → Finish بزند
;   ۲. شورتکات «تنظیمات چاپگر فیش کافه» روی دسکتاپ را باز کند و یک فرم را پر کند
; بعد از آن، برنامه خودکار با هر بار روشن‌شدن ویندوز اجرا می‌شود — بدون ترمینال،
; بدون npm install، بدون نیاز به نصب جداگانه‌ی Node.js (نسخه‌ی portable همراه
; خودش می‌آید).

#define MyAppName "چاپ فیش کافه"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "رز کافه"

[Setup]
AppId={{B7E1B6D4-6F3A-4B8E-9C7D-3A2F1E8D5C90}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={autopf}\CafePrintAgent
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
OutputDir=dist
OutputBaseFilename=CafePrintAgent-Setup
Compression=lzma2
SolidCompression=yes
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
PrivilegesRequired=admin
WizardStyle=modern

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Files]
; کل برنامه (به‌جز پوشه‌ی installer که جدا کپی می‌شود) — شامل node_modules
; از پیش نصب‌شده، فونت‌های فارسی، و کد برنامه
Source: "..\index.js"; DestDir: "{app}\app"; Flags: ignoreversion
Source: "..\config-server.js"; DestDir: "{app}\app"; Flags: ignoreversion
Source: "..\printer.js"; DestDir: "{app}\app"; Flags: ignoreversion
Source: "..\render.js"; DestDir: "{app}\app"; Flags: ignoreversion
Source: "..\package.json"; DestDir: "{app}\app"; Flags: ignoreversion
Source: "..\fonts\*"; DestDir: "{app}\app\fonts"; Flags: ignoreversion recursesubdirs
Source: "..\node_modules\*"; DestDir: "{app}\app\node_modules"; Flags: ignoreversion recursesubdirs
; Node.js قابل‌حمل — کاربر نیازی به نصب جداگانه‌ی Node.js ندارد
Source: "node-runtime\*"; DestDir: "{app}\node-runtime"; Flags: ignoreversion recursesubdirs
; اسکریپت‌های اجرای بی‌صدا (بدون پنجره‌ی کنسول)
Source: "run-agent-hidden.vbs"; DestDir: "{app}\installer"; Flags: ignoreversion
Source: "open-settings.vbs"; DestDir: "{app}\installer"; Flags: ignoreversion
; فرم گرافیکی تنظیمات — داخل app\installer\ (نه installer\ کنار app\) چون
; config-server.js با مسیر نسبی به __dirname/installer/setup-config.html آن را
; پیدا می‌کند؛ این ساختار دقیقاً با حالت توسعه (print-agent/installer/) یکی می‌ماند
Source: "setup-config.html"; DestDir: "{app}\app\installer"; Flags: ignoreversion

[Icons]
Name: "{autodesktop}\تنظیمات چاپگر فیش کافه"; Filename: "wscript.exe"; Parameters: """{app}\installer\open-settings.vbs"""; WorkingDir: "{app}\installer"; IconFilename: "{sys}\shell32.dll"; IconIndex: 46
Name: "{group}\تنظیمات چاپگر فیش کافه"; Filename: "wscript.exe"; Parameters: """{app}\installer\open-settings.vbs"""; WorkingDir: "{app}\installer"; IconFilename: "{sys}\shell32.dll"; IconIndex: 46

[Run]
; بعد از پایان نصب، بلافاصله صفحه‌ی تنظیمات را باز می‌کند — کاربر همان لحظه
; API key و پرینتر را وارد می‌کند، بدون نیاز به پیدا کردن شورتکات
Filename: "wscript.exe"; Parameters: """{app}\installer\open-settings.vbs"""; WorkingDir: "{app}\installer"; Flags: postinstall nowait skipifsilent; Description: "باز کردن صفحه‌ی تنظیمات چاپگر"
; ثبت اجرای خودکار هنگام روشن‌شدن ویندوز — با /RL HIGHEST تا حتی بدون لاگین
; کاربر (مثلاً بعد از قطعی برق در ساعات بسته بودن کافه) هم اجرا شود
Filename: "schtasks.exe"; Parameters: "/Create /TN ""CafePrintAgent"" /TR ""wscript.exe \""{app}\installer\run-agent-hidden.vbs\"""" /SC ONSTART /RL HIGHEST /F"; Flags: runhidden

[UninstallRun]
Filename: "schtasks.exe"; Parameters: "/Delete /TN ""CafePrintAgent"" /F"; Flags: runhidden; RunOnceId: "RemoveScheduledTask"

[Code]
function InitializeSetup(): Boolean;
begin
  Result := True;
end;

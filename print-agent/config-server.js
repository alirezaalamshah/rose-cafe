// سرور موقت محلی برای صفحه‌ی تنظیمات گرافیکی — کاربر عادی (غیر برنامه‌نویس) با
// دابل‌کلیک روی شورتکات «تنظیمات چاپگر» این اجرا می‌شود: یک سرور کوچک روی
// localhost بالا می‌آید، مرورگر پیش‌فرض باز می‌شود، کاربر مقادیر را در یک فرم
// HTML وارد می‌کند، و با کلیک «ذخیره» مستقیم در فایل .env نوشته می‌شود — بدون
// نیاز به دیدن ترمینال یا JSON یا خط فرمان.
const http = require('http')
const fs = require('fs')
const path = require('path')
const os = require('os')
const { exec } = require('child_process')

// Program Files برای کاربر عادی (بدون دسترسی مدیر) فقط قابل‌خواندن است — پس
// .env واقعی در %APPDATA% (پوشه‌ی داده‌ی کاربر، همیشه قابل‌نوشتن) نگه‌داری
// می‌شود، نه کنار فایل‌های نصب‌شده‌ی برنامه. index.js هم باید همین مسیر را بخواند.
const PORT = 47821
const APPDATA_DIR = path.join(os.homedir(), 'AppData', 'Roaming', 'CafePrintAgent')
const ENV_PATH = path.join(APPDATA_DIR, '.env')
const ENV_EXAMPLE_PATH = path.join(__dirname, '.env.example')
const FORM_PATH = path.join(__dirname, 'installer', 'setup-config.html')

function readCurrentEnv() {
  const source = fs.existsSync(ENV_PATH) ? ENV_PATH : ENV_EXAMPLE_PATH
  const content = fs.existsSync(source) ? fs.readFileSync(source, 'utf-8') : ''
  const values = {}
  for (const line of content.split('\n')) {
    const match = line.match(/^([A-Z_]+)=(.*)$/)
    if (match) values[match[1]] = match[2]
  }
  return values
}

function writeEnv(values) {
  const lines = [
    `API_BASE_URL=${values.API_BASE_URL || ''}`,
    `PRINT_AGENT_API_KEY=${values.PRINT_AGENT_API_KEY || ''}`,
    `POLL_INTERVAL_SECONDS=${values.POLL_INTERVAL_SECONDS || '5'}`,
    `PRINTER_NAME=${values.PRINTER_NAME || ''}`,
    `PRINTER_WIDTH_PX=${values.PRINTER_WIDTH_PX || '576'}`,
  ]
  fs.mkdirSync(APPDATA_DIR, { recursive: true })
  fs.writeFileSync(ENV_PATH, lines.join('\n') + '\n', 'utf-8')
}

function listWindowsPrinters() {
  return new Promise((resolve) => {
    exec(
      'powershell -NoProfile -Command "Get-Printer | Select-Object -ExpandProperty ShareName"',
      { encoding: 'utf-8' },
      (err, stdout) => {
        if (err) {
          resolve([])
          return
        }
        const names = stdout.split('\n').map((s) => s.trim()).filter(Boolean)
        resolve(names)
      }
    )
  })
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/') {
    const html = fs.readFileSync(FORM_PATH, 'utf-8')
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end(html)
    return
  }

  if (req.method === 'GET' && req.url === '/api/state') {
    const printers = await listWindowsPrinters()
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify({ current: readCurrentEnv(), printers }))
    return
  }

  if (req.method === 'POST' && req.url === '/api/save') {
    let body = ''
    req.on('data', (chunk) => { body += chunk })
    req.on('end', () => {
      try {
        const values = JSON.parse(body)
        writeEnv(values)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: true }))
        // بعد از ذخیره‌ی موفق چند ثانیه صبر می‌کنیم (تا پیام موفقیت در صفحه دیده
        // شود) و سرور موقت را می‌بندیم — این فقط یک فرم تک‌بارمصرف است، نه یک
        // سرویس دائمی؛ اگر بسته نشود، بار بعد که کاربر شورتکات تنظیمات را می‌زند
        // پورت همچنان اشغال است و سرور جدید بالا نمی‌آید.
        setTimeout(() => process.exit(0), 3000)
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: false, error: err.message }))
      }
    })
    return
  }

  res.writeHead(404)
  res.end()
})

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    // یک نمونه از این سرور از قبل باز است (کاربر دوبار پشت‌سرهم شورتکات را زده) —
    // به‌جای خطا، فقط دوباره همان صفحه‌ی از قبل بازشده را جلو می‌آوریم
    exec(`start "" "http://127.0.0.1:${PORT}/"`)
    process.exit(0)
  }
  throw err
})

server.listen(PORT, '127.0.0.1', () => {
  const url = `http://127.0.0.1:${PORT}/`
  console.log(`صفحه تنظیمات در حال اجرا: ${url}`)
  exec(`start "" "${url}"`)
})

// اگر کاربر پنجره‌ی مرورگر را بست و کاری نکرد، بعد از ۱۰ دقیقه سرور خودش را
// می‌بندد — تا برای همیشه در پس‌زمینه باز نماند
setTimeout(() => process.exit(0), 10 * 60 * 1000)

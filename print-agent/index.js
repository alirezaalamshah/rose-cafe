const path = require('path')
const os = require('os')
const fs = require('fs')

// در نصب واقعی (installer)، برنامه در Program Files است — جایی که کاربر عادی
// اجازه‌ی نوشتن ندارد، پس صفحه‌ی تنظیمات .env را در %APPDATA% ذخیره می‌کند
// (همان‌جایی که config-server.js هم می‌نویسد). در حالت توسعه (بدون نصب) اگر آن
// فایل وجود نداشت، به .env کنار پروژه بازمی‌گردیم.
const APPDATA_ENV_PATH = path.join(os.homedir(), 'AppData', 'Roaming', 'CafePrintAgent', '.env')
require('dotenv').config({
  path: fs.existsSync(APPDATA_ENV_PATH) ? APPDATA_ENV_PATH : path.join(__dirname, '.env'),
})

const axios = require('axios')
const { renderReceiptToRaster, rasterToEscPosCommand } = require('./render.js')
const { printRawBuffer } = require('./printer.js')

const API_BASE_URL = (process.env.API_BASE_URL || '').replace(/\/$/, '')
const PRINT_AGENT_API_KEY = process.env.PRINT_AGENT_API_KEY || ''
const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_SECONDS || 5) * 1000
const PRINTER_NAME = process.env.PRINTER_NAME || ''
// عرض قابل‌چاپ به پیکسل — نه میلی‌متر کاغذ. برای ۵۸mm معمولاً ۳۸۴px، برای ۸۰mm معمولاً ۵۷۶px (در 203dpi)
const PRINTER_WIDTH_PX = Number(process.env.PRINTER_WIDTH_PX || 384)

// ESC/POS: مقداردهی اولیه + برش کامل کاغذ بعد از رستر
const ESC_INIT = Buffer.from([0x1b, 0x40])
const FEED_AND_CUT = Buffer.from([0x0a, 0x0a, 0x0a, 0x1d, 0x56, 0x00])

if (!API_BASE_URL || !PRINT_AGENT_API_KEY) {
  console.error('خطا: API_BASE_URL و PRINT_AGENT_API_KEY باید در فایل .env تنظیم شوند.')
  process.exit(1)
}
if (!PRINTER_NAME) {
  console.error('خطا: PRINTER_NAME در فایل .env تنظیم نشده است.')
  process.exit(1)
}

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'X-Print-Agent-Key': PRINT_AGENT_API_KEY },
  timeout: 15000,
})

function log(message) {
  console.log(`[${new Date().toLocaleString('fa-IR')}] ${message}`)
}

async function printReceipt(job) {
  const raster = renderReceiptToRaster(job.receipt_data, PRINTER_WIDTH_PX)
  const rasterCommand = rasterToEscPosCommand(raster)
  const buffer = Buffer.concat([ESC_INIT, rasterCommand, FEED_AND_CUT])
  await printRawBuffer(buffer, PRINTER_NAME)
}

async function fetchPendingJobs() {
  const { data } = await api.get('/pos/print-jobs/pending/')
  return data
}

async function ackJob(jobId) {
  await api.post(`/pos/print-jobs/${jobId}/ack/`)
}

async function processPendingJobs() {
  let jobs
  try {
    jobs = await fetchPendingJobs()
  } catch (err) {
    log(`خطا در دریافت صف چاپ: ${err.message}`)
    return
  }

  if (jobs.length === 0) return
  log(`${jobs.length} فیش در انتظار چاپ یافت شد`)

  // یکی‌یکی چاپ می‌شوند (نه موازی) چون پرینتر حرارتی هم‌زمان فقط یک کار را می‌پذیرد
  for (const job of jobs) {
    try {
      await printReceipt(job)
      await ackJob(job.id)
      log(`فیش سفارش #${job.order_number} چاپ و تأیید شد`)
    } catch (err) {
      log(`خطا در چاپ فیش سفارش #${job.order_number}: ${err.message}`)
      // ack نمی‌شود تا در poll بعدی دوباره تلاش شود
    }
  }
}

async function mainLoop() {
  await processPendingJobs()
  setTimeout(mainLoop, POLL_INTERVAL_MS)
}

log('برنامه چاپ فیش کافه شروع به کار کرد')
log(`آدرس سرور: ${API_BASE_URL}`)
log(`بازه بررسی: هر ${POLL_INTERVAL_MS / 1000} ثانیه`)
mainLoop()

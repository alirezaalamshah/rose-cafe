// فیش را از یک لیست بلوک ساختاریافته (که سرور در receipt_data می‌فرستد) به یک
// تصویر سیاه‌وسفید تبدیل می‌کند. چون کنترلر این پرینترهای ارزان چینی هیچ‌کدام از
// code pageهای فارسی/عربی استاندارد (CP864, CP1256, ISO-8859-6) را نمی‌شناسد،
// متن با یک فونت واقعی روی canvas رندر می‌شود (که shaping حروف به‌هم‌پیوسته را
// هم خودش انجام می‌دهد) و به‌صورت بیت‌مپ با دستور رستر ESC/POS چاپ می‌شود.
//
// چون فونت فارسی proportional است (نه monospace)، چیدمان (وسط‌چین، ردیف دوطرفه)
// اینجا با موقعیت واقعی پیکسل رسم می‌شود — نه با فاصله‌گذاری کاراکتری سمت سرور.
const path = require('path')
const { createCanvas, GlobalFonts } = require('@napi-rs/canvas')

const FONT_PATH = path.join(__dirname, 'fonts', 'Vazirmatn-Regular.ttf')
const FONT_BOLD_PATH = path.join(__dirname, 'fonts', 'Vazirmatn-Bold.ttf')
const FONT_FAMILY = 'Vazirmatn'
const FONT_FAMILY_BOLD = 'Vazirmatn-Bold'
GlobalFonts.registerFromPath(FONT_PATH, FONT_FAMILY)
GlobalFonts.registerFromPath(FONT_BOLD_PATH, FONT_FAMILY_BOLD)

const FONT_SIZE = 26
const LINE_HEIGHT = 36
const MARGIN_X = 16 // حاشیه‌ی خالی سمت راست و چپ کاغذ
const MARGIN_TOP = 16
const MARGIN_BOTTOM = 16
const DIVIDER_GAP = 10 // فاصله‌ی خالی بالا/پایین یک خط جداکننده

function fontFor(bold) {
  return `${FONT_SIZE}px "${bold ? FONT_FAMILY_BOLD : FONT_FAMILY}"`
}

// ارتفاع کل فیش را از قبل محاسبه می‌کند تا canvas با اندازه‌ی درست ساخته شود
function measureHeight(blocks) {
  let height = MARGIN_TOP
  for (const block of blocks) {
    if (block.type === 'divider') height += DIVIDER_GAP * 2 + 2
    else height += LINE_HEIGHT
  }
  return height + MARGIN_BOTTOM
}

function drawBlock(ctx, block, y, contentWidth) {
  const rightEdge = MARGIN_X + contentWidth
  const leftEdge = MARGIN_X

  if (block.type === 'divider') {
    const lineY = y + DIVIDER_GAP
    ctx.strokeStyle = '#000000'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(leftEdge, lineY)
    ctx.lineTo(rightEdge, lineY)
    ctx.stroke()
    return DIVIDER_GAP * 2 + 2
  }

  ctx.fillStyle = '#000000'
  ctx.direction = 'rtl'
  ctx.textBaseline = 'top'

  if (block.type === 'row') {
    // برچسب سمت راست می‌چسبد (شروع سطر RTL)، مقدار سمت چپ می‌چسبد — دقیقاً مثل جدول
    ctx.font = fontFor(block.bold)
    ctx.textAlign = 'right'
    ctx.fillText(block.left, rightEdge, y + 4, contentWidth * 0.62)
    ctx.textAlign = 'left'
    ctx.fillText(block.right, leftEdge, y + 4, contentWidth * 0.42)
    return LINE_HEIGHT
  }

  // block.type === 'text'
  ctx.font = fontFor(block.bold)
  if (block.align === 'center') {
    ctx.textAlign = 'center'
    ctx.fillText(block.text, MARGIN_X + contentWidth / 2, y + 4, contentWidth)
  } else {
    ctx.textAlign = 'right'
    ctx.fillText(block.text, rightEdge, y + 4, contentWidth)
  }
  return LINE_HEIGHT
}

/**
 * لیست بلوک‌های فیش (از receipt_data سرور) را به بافر بیت‌مپ سیاه‌وسفید رندر
 * می‌کند. widthPx باید عرض واقعی قابل‌چاپ پرینتر به پیکسل باشد (نه میلی‌متر
 * کاغذ) — برای پرینتر ۵۸mm معمولاً ۳۸۴ پیکسل، برای ۸۰mm معمولاً ۵۷۶ پیکسل (در ۲۰۳dpi).
 */
function renderReceiptToRaster(blocks, widthPx) {
  const contentWidth = widthPx - MARGIN_X * 2
  const height = measureHeight(blocks)
  const canvas = createCanvas(widthPx, height)
  const ctx = canvas.getContext('2d')

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, widthPx, height)

  let y = MARGIN_TOP
  for (const block of blocks) {
    y += drawBlock(ctx, block, y, contentWidth)
  }

  return imageDataToRaster(ctx.getImageData(0, 0, widthPx, height))
}

function imageDataToRaster({ data, width, height }) {
  const bytesPerRow = Math.ceil(width / 8)
  const raster = Buffer.alloc(bytesPerRow * height)

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3
      if (brightness < 128) {
        raster[y * bytesPerRow + (x >> 3)] |= 0x80 >> (x % 8)
      }
    }
  }

  return { bytesPerRow, height, raster }
}

/** بافر کامل دستور ESC/POS رستر (GS v 0) برای یک بیت‌مپ آماده */
function rasterToEscPosCommand({ bytesPerRow, height, raster }) {
  const header = Buffer.from([
    0x1d, 0x76, 0x30, 0x00,
    bytesPerRow & 0xff, (bytesPerRow >> 8) & 0xff,
    height & 0xff, (height >> 8) & 0xff,
  ])
  return Buffer.concat([header, raster])
}

module.exports = { renderReceiptToRaster, rasterToEscPosCommand }

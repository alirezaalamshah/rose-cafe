// ارسال بافر خام ESC/POS به صف چاپ استاندارد سیستم‌عامل — نه libusb/کتابخانه‌ی
// جانبی. روی ویندوز پرینتر باید با درایور «Generic / Text Only» نصب شده باشد
// (این درایور داده را دست‌نخورده raw می‌فرستد)، روی mac/لینوکس هر پرینتری که
// با CUPS نصب شده باشد کافی است — چون فرمان‌های سیستم‌عامل استفاده می‌شوند،
// هیچ وابستگی npm اضافه یا native build لازم نیست.
const os = require('os')
const fs = require('fs')
const path = require('path')
const { execFile } = require('child_process')

function printRawBuffer(buffer, printerName) {
  return new Promise((resolve, reject) => {
    const tmpFile = path.join(os.tmpdir(), `receipt-${Date.now()}.bin`)
    fs.writeFile(tmpFile, buffer, (writeErr) => {
      if (writeErr) {
        reject(writeErr)
        return
      }

      const cleanup = () => fs.unlink(tmpFile, () => {})

      if (os.platform() === 'win32') {
        // مقصد copy روی ویندوز باید UNC share پرینتر باشد: \\localhost\<ShareName>
        // (نه اسم نمایشی پرینتر) — با net view \\localhost یا Printer Properties > Sharing پیدا می‌شود
        execFile('cmd.exe', ['/c', 'copy', '/b', tmpFile, `\\\\localhost\\${printerName}`], (err) => {
          cleanup()
          if (err) reject(err)
          else resolve()
        })
      } else {
        execFile('lp', ['-d', printerName, '-o', 'raw', tmpFile], (err) => {
          cleanup()
          if (err) reject(err)
          else resolve()
        })
      }
    })
  })
}

module.exports = { printRawBuffer }

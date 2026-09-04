/**
 * دانلود CSV با متن فارسی — BOM یونیکد (﻿) اول فایل لازم است وگرنه اکسل
 * انکودینگ رو اشتباه تشخیص می‌ده و فارسی به‌صورت کاراکترهای بی‌معنی نشون داده می‌شه.
 * جهت راست‌چین خود سلول‌ها یک تنظیم اکسل/مرورگر است نه چیزی که فرمت CSV بتونه حملش
 * کنه؛ اکسل با باز کردن فایلی که محتواش فارسی/عربیه معمولاً خودش راست‌چین تشخیص می‌ده.
 */
function escapeCsvCell(value) {
  const str = value === null || value === undefined ? '' : String(value)
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export function downloadCSV(filename, headers, rows) {
  const lines = [headers, ...rows].map((row) => row.map(escapeCsvCell).join(','))
  const csvContent = '﻿' + lines.join('\r\n')
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

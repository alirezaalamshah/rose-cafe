import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import compression from 'vite-plugin-compression'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    // فایل‌های .gz/.br را در کنار خروجی build می‌سازد تا هاست اشتراکی نیازی به
    // فشرده‌سازی on-the-fly نداشته باشد (gzip_static/brotli_static در nginx)
    compression({ algorithm: 'gzip', ext: '.gz' }),
    compression({ algorithm: 'brotliCompress', ext: '.br' }),
    VitePWA({
      // به‌جای generateSW (کاملاً خودکار)، injectManifest استفاده می‌شود چون service
      // worker خودمان (src/sw.js) هندلرهای push/notificationclick سفارشی دارد —
      // فقط بخش پیش‌کش asset ها (self.__WB_MANIFEST) توسط پلاگین در آن تزریق می‌شود
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      // پیش‌فرض vite-plugin-pwa: در `npm run dev` هیچ manifest/SW ای فعال نمی‌شود —
      // برای اینکه بشود همون‌جا نصب‌پذیری/Push رو تست کرد، صریحاً فعالش می‌کنیم
      devOptions: {
        enabled: true,
        type: 'module',
      },
      injectManifest: {
        // مسیرهای API/مدیا هیچ‌وقت نباید پیش‌کش شوند
        globIgnores: ['**/api/**', '**/media/**'],
      },
      registerType: 'autoUpdate',
      includeAssets: ['icons/favicon-32.png', 'icons/apple-touch-icon.png'],
      manifest: {
        id: '/',
        name: 'رز کافه',
        short_name: 'رز کافه',
        description: 'سفارش آنلاین، رزرو میز و مدیریت کافه',
        lang: 'fa',
        dir: 'rtl',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#0e0101',
        theme_color: '#0e0101',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/media': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})

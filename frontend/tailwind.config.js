/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#64785F',
          light: '#7a9174',
          dark: '#4e5e4a',
          50: '#f0f3ef',
          100: '#dce4da',
          200: '#bacdb6',
          300: '#94b090',
          400: '#7a9174',
          500: '#64785F',
          600: '#506050',
          700: '#3e4a3c',
          800: '#2c3429',
          900: '#1a1f18',
        },
        cream: {
          DEFAULT: '#E2E4CE',
          light: '#eeefdf',
          dark: '#cdd0b5',
          50: '#fafaf5',
          100: '#f5f6ec',
          200: '#eeefdf',
          300: '#E2E4CE',
          400: '#cdd0b5',
          500: '#b5b99a',
          600: '#9a9e7e',
          700: '#7c8062',
          800: '#5e6148',
          900: '#404230',
        },
        neo: {
          base: '#64785F',
          light: '#7a9174',
          dark: '#4e5e4a',
          shadow1: '#536349',
          shadow2: '#7a9174',
          text: '#E2E4CE',
          textMuted: '#c5c9ae',
          textDark: '#2c3429',
        }
      },
      fontFamily: {
        sans: ['Vazirmatn', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'neo': '6px 6px 12px #4e5e4a, -6px -6px 12px #7a9174',
        'neo-sm': '3px 3px 6px #4e5e4a, -3px -3px 6px #7a9174',
        'neo-lg': '10px 10px 20px #4e5e4a, -10px -10px 20px #7a9174',
        'neo-inset': 'inset 4px 4px 8px #4e5e4a, inset -4px -4px 8px #7a9174',
        'neo-inset-sm': 'inset 2px 2px 5px #4e5e4a, inset -2px -2px 5px #7a9174',
      },
      borderRadius: {
        'neo': '16px',
        'neo-lg': '24px',
        'neo-xl': '32px',
      },
    },
  },
  plugins: [],
}
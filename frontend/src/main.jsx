import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import App from './App.jsx'
import './styles/global.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <App />
      <Toaster
        position="top-center"
        reverseOrder={false}
        toastOptions={{
          style: {
            background: '#22223a',
            color: '#e8ddd0',
            border: '1px solid rgba(255,255,255,0.06)',
            boxShadow: '6px 6px 12px #12122a, -4px -4px 10px rgba(255,255,255,0.06)',
            fontFamily: 'Vazirmatn, sans-serif',
            fontSize: '0.9rem',
            direction: 'rtl',
          },
          success: { iconTheme: { primary: '#4ade80', secondary: '#22223a' } },
          error: { iconTheme: { primary: '#f87171', secondary: '#22223a' } },
        }}
      />
    </BrowserRouter>
  </React.StrictMode>
)

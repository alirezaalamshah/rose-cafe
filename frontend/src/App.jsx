import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import useAuthStore from './store/authStore.js'

import Layout from './components/layout/Layout/Layout.jsx'
import AdminLayout from './components/admin/AdminSidebar/AdminLayout.jsx'

import LoginPage from './pages/auth/LoginPage.jsx'
import MenuPage from './pages/menu/MenuPage.jsx'
import MenuItemDetailPage from './pages/menu/MenuItemDetailPage.jsx'
import CartPage from './pages/orders/CartPage.jsx'
import OrdersPage from './pages/orders/OrdersPage.jsx'
import ReservationPage from './pages/reservations/ReservationPage.jsx'
import PaymentPage from './pages/payment/PaymentPage.jsx'
import ReviewsPage from './pages/reviews/ReviewsPage.jsx'
import ProfilePage from './pages/profile/ProfilePage.jsx'

import AdminDashboardPage from './pages/admin/AdminDashboardPage.jsx'
import AdminOrdersPage from './pages/admin/AdminOrdersPage.jsx'
import AdminMenuPage from './pages/admin/AdminMenuPage.jsx'
import AdminReservationsPage from './pages/admin/AdminReservationsPage.jsx'
import AdminReviewsPage from './pages/admin/AdminReviewsPage.jsx'

function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuthStore()
  return isAuthenticated ? children : <Navigate to="/login" replace />
}

function AdminRoute({ children }) {
  const { isAuthenticated, user } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (!user?.is_staff) return <Navigate to="/" replace />
  return children
}

function App() {
  const { initAuth } = useAuthStore()

  useEffect(() => {
    initAuth()
  }, [initAuth])

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      {/* Customer Routes */}
      <Route path="/" element={<Layout />}>
        <Route index element={<MenuPage />} />
        <Route path="menu/:slug" element={<MenuItemDetailPage />} />
        <Route path="cart" element={<ProtectedRoute><CartPage /></ProtectedRoute>} />
        <Route path="orders" element={<ProtectedRoute><OrdersPage /></ProtectedRoute>} />
        <Route path="reservations" element={<ProtectedRoute><ReservationPage /></ProtectedRoute>} />
        <Route path="payment" element={<ProtectedRoute><PaymentPage /></ProtectedRoute>} />
        <Route path="reviews" element={<ReviewsPage />} />
        <Route path="profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
      </Route>

      {/* Admin Routes */}
      <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
        <Route index element={<AdminDashboardPage />} />
        <Route path="orders" element={<AdminOrdersPage />} />
        <Route path="menu" element={<AdminMenuPage />} />
        <Route path="reservations" element={<AdminReservationsPage />} />
        <Route path="reviews" element={<AdminReviewsPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App

import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, lazy, Suspense } from 'react'
import useAuthStore from './store/authStore.js'
import Loading from './components/common/Loading/Loading.jsx'

import Layout from './components/layout/Layout/Layout.jsx'

import LoginPage from './pages/auth/LoginPage.jsx'
import RegisterPage from './pages/auth/RegisterPage.jsx'
import MenuPage from './pages/menu/MenuPage.jsx'

// مسیرهای مشتری کمتر پرمصرف هستند ولی هنوز lazy می‌شوند تا حجم اولیه‌ی باندل کمتر شود
const MenuItemDetailPage = lazy(() => import('./pages/menu/MenuItemDetailPage.jsx'))
const CartPage = lazy(() => import('./pages/orders/CartPage.jsx'))
const OrdersPage = lazy(() => import('./pages/orders/OrdersPage.jsx'))
const ReservationPage = lazy(() => import('./pages/reservations/ReservationPage.jsx'))
const PaymentPage = lazy(() => import('./pages/payment/PaymentPage.jsx'))
const PaymentCallbackPage = lazy(() => import('./pages/payment/PaymentCallbackPage.jsx'))
const ReviewsPage = lazy(() => import('./pages/reviews/ReviewsPage.jsx'))
const ProfilePage = lazy(() => import('./pages/profile/ProfilePage.jsx'))

// پنل ادمین: مشتری‌ها (اکثریت قریب‌به‌اتفاق بازدیدها) هرگز این چانک را دانلود نمی‌کنند
const AdminLayout = lazy(() => import('./components/admin/AdminSidebar/AdminLayout.jsx'))
const AdminDashboardPage = lazy(() => import('./pages/admin/AdminDashboardPage.jsx'))
const AdminOrdersPage = lazy(() => import('./pages/admin/AdminOrdersPage.jsx'))
const AdminMenuPage = lazy(() => import('./pages/admin/AdminMenuPage.jsx'))
const AdminCategoriesPage = lazy(() => import('./pages/admin/AdminCategoriesPage.jsx'))
const AdminReservationsPage = lazy(() => import('./pages/admin/AdminReservationsPage.jsx'))
const AdminTablesPage = lazy(() => import('./pages/admin/AdminTablesPage.jsx'))
const AdminReviewsPage = lazy(() => import('./pages/admin/AdminReviewsPage.jsx'))
const AdminUsersPage = lazy(() => import('./pages/admin/AdminUsersPage.jsx'))
const AdminDiscountsPage = lazy(() => import('./pages/admin/AdminDiscountsPage.jsx'))
const AdminPaymentsPage = lazy(() => import('./pages/admin/AdminPaymentsPage.jsx'))
const AdminBusinessPage = lazy(() => import('./pages/admin/AdminBusinessPage.jsx'))
const AdminSettingsPage = lazy(() => import('./pages/admin/AdminSettingsPage.jsx'))
const AdminBannersPage = lazy(() => import('./pages/admin/AdminBannersPage.jsx'))

// پنل گارسون: همین‌طور، مشتری/ادمین این چانک را دانلود نمی‌کنند
const WaiterLayout = lazy(() => import('./components/waiter/WaiterLayout/WaiterLayout.jsx'))
const WaiterDashboardPage = lazy(() => import('./pages/waiter/WaiterDashboardPage.jsx'))
const WaiterOrdersPage = lazy(() => import('./pages/waiter/WaiterOrdersPage.jsx'))
const WaiterReservationsPage = lazy(() => import('./pages/waiter/WaiterReservationsPage.jsx'))
const WaiterTablesPage = lazy(() => import('./pages/waiter/WaiterTablesPage.jsx'))

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

function WaiterRoute({ children }) {
  const { isAuthenticated, user } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (user?.role !== 'waiter') return <Navigate to="/" replace />
  return children
}

function App() {
  const { initAuth } = useAuthStore()

  useEffect(() => {
    initAuth()
  }, [initAuth])

  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/payment/callback" element={<PaymentCallbackPage />} />

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
          <Route path="payments" element={<AdminPaymentsPage />} />
          <Route path="menu" element={<AdminMenuPage />} />
          <Route path="categories" element={<AdminCategoriesPage />} />
          <Route path="tables" element={<AdminTablesPage />} />
          <Route path="reservations" element={<AdminReservationsPage />} />
          <Route path="reviews" element={<AdminReviewsPage />} />
          <Route path="users" element={<AdminUsersPage />} />
          <Route path="discounts" element={<AdminDiscountsPage />} />
          <Route path="business" element={<AdminBusinessPage />} />
          <Route path="settings" element={<AdminSettingsPage />} />
          <Route path="banners" element={<AdminBannersPage />} />
        </Route>

        {/* Waiter Routes */}
        <Route path="/waiter" element={<WaiterRoute><WaiterLayout /></WaiterRoute>}>
          <Route index element={<WaiterDashboardPage />} />
          <Route path="orders" element={<WaiterOrdersPage />} />
          <Route path="reservations" element={<WaiterReservationsPage />} />
          <Route path="tables" element={<WaiterTablesPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}

export default App

import api from './axios.js'

export const paymentsAPI = {
  requestPayment: (orderId) => api.post('/payments/request/', { order_id: orderId }),
  confirmFreeOrder: (orderId) => api.post('/payments/free-confirm/', { order_id: orderId }),
  verifyPayment: (params) => api.get('/payments/verify/', { params }),
  getHistory: () => api.get('/payments/history/'),
  adminGetPayments: (params) => api.get('/payments/admin/', { params }),
}

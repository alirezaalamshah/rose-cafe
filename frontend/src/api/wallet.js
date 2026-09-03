import api from './axios.js'

export const walletAPI = {
  getMyWallet: () => api.get('/wallet/me/'),
  getTransactions: (params) => api.get('/wallet/transactions/', { params }),
  requestTopup: (amount) => api.post('/wallet/topup/request/', { amount }),
  verifyTopup: (params) => api.get('/wallet/topup/verify/', { params }),
  getLoyaltySettings: () => api.get('/wallet/loyalty-settings/'),
  adminGetLoyaltySettings: () => api.get('/wallet/admin/loyalty-settings/'),
  adminUpdateLoyaltySettings: (data) => api.patch('/wallet/admin/loyalty-settings/', data),
}

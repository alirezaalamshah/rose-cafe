import api from './axios.js'

export const discountsAPI = {
  validateCode: (code) => api.post('/discounts/validate/', { code }),
}

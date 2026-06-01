import api from './axios'

export const sendOTP = (phone) => api.post('/auth/send-otp/', { phone })
export const verifyOTP = (phone, otp) => api.post('/auth/verify-otp/', { phone, otp })
export const getMe = () => api.get('/auth/me/')
export const updateMe = (data) => api.patch('/auth/me/', data)
export const getAddresses = () => api.get('/auth/addresses/')
export const createAddress = (data) => api.post('/auth/addresses/', data)
export const updateAddress = (id, data) => api.patch(`/auth/addresses/${id}/`, data)
export const deleteAddress = (id) => api.delete(`/auth/addresses/${id}/`)
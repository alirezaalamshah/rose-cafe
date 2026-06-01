import api from './axios'

export const getCafeReviews = () => api.get('/reviews/cafe/')
export const getCafeStats = () => api.get('/reviews/cafe/stats/')
export const createCafeReview = (data) => api.post('/reviews/cafe/create/', data)
export const getMenuItemReviews = (id) => api.get(`/reviews/menu-item/${id}/`)
export const createReview = (data) => api.post('/reviews/create/', data)
import api from './axios.js'

export const reviewsAPI = {
  getMenuItemReviews: (menuItemId) => api.get(`/reviews/menu-item/${menuItemId}/`),
  getCafeReviews: () => api.get('/reviews/cafe/'),
  getCafeStats: () => api.get('/reviews/cafe/stats/'),
  createReview: (data) => api.post('/reviews/create/', data),
  updateReview: (id, data) => api.patch(`/reviews/${id}/`, data),
  deleteReview: (id) => api.delete(`/reviews/${id}/`),
  createCafeReview: (data) => api.post('/reviews/cafe/create/', data),

  // Admin
  adminGetReviews: (params) => api.get('/reviews/admin/', { params }),
  adminApproveReview: (id) => api.patch(`/reviews/admin/${id}/approve/`),
  adminBulkApproveReviews: () => api.post('/reviews/admin/bulk-approve/'),
  adminGetCafeReviews: () => api.get('/reviews/admin/cafe/'),
  adminApproveCafeReview: (id) => api.patch(`/reviews/admin/cafe/${id}/approve/`),
  adminBulkApproveCafeReviews: () => api.post('/reviews/admin/cafe/bulk-approve/'),
}

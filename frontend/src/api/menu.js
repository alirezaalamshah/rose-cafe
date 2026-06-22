import api from './axios.js'

export const menuAPI = {
  getCategories: () => api.get('/menu/categories/'),
  getItems: (params) => api.get('/menu/items/', { params }),
  getFeatured: () => api.get('/menu/items/featured/'),
  getItem: (slug) => api.get(`/menu/items/${slug}/`),

  // Admin
  adminGetItems: (params) => api.get('/menu/admin/items/', { params }),
  adminCreateItem: (data) => api.post('/menu/admin/items/', data),
  adminUpdateItem: (id, data) => api.put(`/menu/admin/items/${id}/`, data),
  adminDeleteItem: (id) => api.delete(`/menu/admin/items/${id}/`),
  adminGetCategories: () => api.get('/menu/admin/categories/'),
  adminCreateCategory: (data) => api.post('/menu/admin/categories/', data),
  adminUpdateCategory: (id, data) => api.put(`/menu/admin/categories/${id}/`, data),
  adminDeleteCategory: (id) => api.delete(`/menu/admin/categories/${id}/`),
}

import api from './axios.js'

export const menuAPI = {
  getCategories: () => api.get('/menu/categories/'),
  getItems: (params) => api.get('/menu/items/', { params }),
  getFeatured: () => api.get('/menu/items/featured/'),
  getItem: (slug) => api.get(`/menu/items/${slug}/`),

  // Admin
  adminGetItems: (params) => api.get('/menu/admin/items/', { params }),
  adminCreateItem: (data) => api.post('/menu/admin/items/', data, {
    headers: data instanceof FormData ? { 'Content-Type': 'multipart/form-data' } : {},
  }),
  adminUpdateItem: (id, data) => api.patch(`/menu/admin/items/${id}/`, data, {
    headers: data instanceof FormData ? { 'Content-Type': 'multipart/form-data' } : {},
  }),
  adminDeleteItem: (id) => api.delete(`/menu/admin/items/${id}/`),
  adminGetCategories: () => api.get('/menu/admin/categories/'),
  adminCreateCategory: (data) => api.post('/menu/admin/categories/', data),
  adminUpdateCategory: (id, data) => api.put(`/menu/admin/categories/${id}/`, data),
  adminDeleteCategory: (id) => api.delete(`/menu/admin/categories/${id}/`),

  // Admin bulk actions
  adminBulkPriceUpdate: (data) => api.post('/menu/admin/items/bulk-price/', data),
  adminBulkStatusUpdate: (data) => api.post('/menu/admin/items/bulk-status/', data),
  adminBulkCategoryMove: (data) => api.post('/menu/admin/items/bulk-category/', data),
  adminBulkDeleteItems: (item_ids) => api.post('/menu/admin/items/bulk-delete/', { item_ids }),
  adminBulkToggleCategories: (category_ids, is_active) => api.post('/menu/admin/categories/bulk-toggle/', { category_ids, is_active }),

  // Admin variants
  adminGetVariants: (itemId) => api.get(`/menu/admin/items/${itemId}/variants/`),
  adminCreateVariant: (itemId, data) => api.post(`/menu/admin/items/${itemId}/variants/`, data),
  adminUpdateVariant: (itemId, variantId, data) => api.patch(`/menu/admin/items/${itemId}/variants/${variantId}/`, data),
  adminDeleteVariant: (itemId, variantId) => api.delete(`/menu/admin/items/${itemId}/variants/${variantId}/`),

  // Admin addons (افزودنی‌های اختیاری — مثل خامه اضافه)
  adminGetAddons: (itemId) => api.get(`/menu/admin/items/${itemId}/addons/`),
  adminCreateAddon: (itemId, data) => api.post(`/menu/admin/items/${itemId}/addons/`, data),
  adminUpdateAddon: (itemId, addonId, data) => api.patch(`/menu/admin/items/${itemId}/addons/${addonId}/`, data),
  adminDeleteAddon: (itemId, addonId) => api.delete(`/menu/admin/items/${itemId}/addons/${addonId}/`),
}

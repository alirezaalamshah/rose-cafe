import api from './axios'

export const getCategories = () => api.get('/menu/categories/')
export const getMenuItems = (params) => api.get('/menu/items/', { params })
export const getFeaturedItems = () => api.get('/menu/items/featured/')
export const getMenuItem = (slug) => api.get(`/menu/items/${slug}/`)
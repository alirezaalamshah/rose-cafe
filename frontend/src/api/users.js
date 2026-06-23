import api from './axios.js'

export const usersAPI = {
  adminGetUsers: (params) => api.get('/auth/admin/users/', { params }),
  adminUpdateUser: (id, data) => api.patch(`/auth/admin/users/${id}/`, data),
}

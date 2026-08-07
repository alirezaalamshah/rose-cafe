import api from './axios.js'

export const staffActivityAPI = {
  getLog: (params) => api.get('/staff-activity/', { params }),
  getReport: (params) => api.get('/staff-activity/report/', { params }),
}

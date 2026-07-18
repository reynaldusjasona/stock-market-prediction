import { api } from '../api/api'

const adminApi ={
  getAllUsers(params = {}) {
    const q = new URLSearchParams(params).toString()
    return api.get(`/admin/users${q ? '?' + q : ''}`)
  },
  getUserById(userId){ return api.get(`/admin/users/${userId}`) },
  searchUsers(query){ return api.get(`/admin/users?q=${encodeURIComponent(query)}`) },
  updateUser(userId, payload) {
    return api.patch(`/admin/users/${userId}`, payload)
  },
  suspendUser(userId, reason = '') {
    return api.patch(`/admin/users/${userId}/suspend`, { reason })
  },
  unsuspendUser(userId) {
    return api.patch(`/admin/users/${userId}/unsuspend`)
  },
  deleteUser(userId) { return api.delete(`/admin/users/${userId}`) },

  adminResetPassword(email) {
    return api.post('/auth/reset-password', { email })
  },

  getLandingPage(){ return api.get('/admin/landing') },
  updateLandingPage(payload) {
    return api.put('/admin/landing', payload)
  },

  getModelPerformance(){ return api.get('/admin/model/performance') },
  getModelQuality(){ return api.get('/admin/model/quality') },
  getModelConfig(){ return api.get('/admin/model/config') },
  retrainModel(payload = {}) {
    return api.post('/admin/model/retrain', payload)
  },
  getRetrainStatus() { return api.get('/admin/model/retrain/status') },

  getAllApis(){ return api.get('/admin/apis') },
  getApiById(apiId){ return api.get(`/admin/apis/${apiId}`) },
  addApi(payload) {
    return api.post('/admin/apis', payload)
  },
  editApi(apiId, payload) {
    return api.patch(`/admin/apis/${apiId}`, payload)
  },
  deleteApi(apiId){ return api.delete(`/admin/apis/${apiId}`) },

  getAllFeedback(params = {}) {
    const q = new URLSearchParams(params).toString()
    return api.get(`/admin/feedback${q ? '?' + q : ''}`)
  },
  getFeedbackById(id) { return api.get(`/admin/feedback/${id}`) },
  approveFeedback(id) {
    return api.patch(`/admin/feedback/${id}/approve`)
  },
  rejectFeedback(id, reason = '') {
    return api.patch(`/admin/feedback/${id}/reject`, { reason })
  },

  getAllAlerts(params = {}) {
    const q = new URLSearchParams(params).toString()
    return api.get(`/admin/alerts${q ? '?' + q : ''}`)
  },
  getAlertSummary(){ return api.get('/admin/alerts/summary') },
  dismissAlert(id){
    return api.patch(`/admin/alerts/${id}/dismiss`)
  },

  getDashboardStats() { return api.get('/admin/stats') },

  getActivityLog(params = {}){
    const q = new URLSearchParams(params).toString()
    return api.get(`/admin/activity-log${q ? '?' + q : ''}`)
  },
}

export function requireAdmin() {
  // TODO: unify token storage with AuthContext (localStorage vs sessionStorage)
  if (!sessionStorage.getItem('sw_token')){
	window.location.href = '/admin/login';
	return false
	}
  if (sessionStorage.getItem('sw_role') !== 'admin'){
	window.location.href = '/dashboard';
	return false
	}
  return true
}

export default adminApi

import api from './api'

const adminApi ={
  getAllUsers(params = {}) {
    const q = new URLSearchParams(params).toString()
    return api.fetch(`/admin/users${q ? '?' + q : ''}`)
  },
  getUserById(userId){ return api.fetch(`/admin/users/${userId}`) },
  searchUsers(query){ return api.fetch(`/admin/users?q=${encodeURIComponent(query)}`) },
  updateUser(userId, payload) {
    return api.fetch(`/admin/users/${userId}`, { method:'PATCH', body:JSON.stringify(payload) })
  },
  suspendUser(userId, reason = '') {
    return api.fetch(`/admin/users/${userId}/suspend`, { method:'PATCH', body:JSON.stringify({ reason }) })
  },
  unsuspendUser(userId) {
    return api.fetch(`/admin/users/${userId}/unsuspend`, { method:'PATCH' })
  },
  deleteUser(userId) { return api.fetch(`/admin/users/${userId}`, { method:'DELETE' }) },

  adminResetPassword(email) {
    return api.fetch('/auth/reset-password', { method:'POST', body:JSON.stringify({ email }) })
  },

  getLandingPage(){ return api.fetch('/admin/landing') },
  updateLandingPage(payload) {
    return api.fetch('/admin/landing', { method:'PUT', body:JSON.stringify(payload) })
  },

  getModelPerformance(){ return api.fetch('/admin/model/performance') },
  getModelQuality(){ return api.fetch('/admin/model/quality') },
  getModelConfig(){ return api.fetch('/admin/model/config') },
  retrainModel(payload = {}) {
    return api.fetch('/admin/model/retrain', { method:'POST', body:JSON.stringify(payload) })
  },
  getRetrainStatus() { return api.fetch('/admin/model/retrain/status') },

  getAllApis(){ return api.fetch('/admin/apis') },
  getApiById(apiId){ return api.fetch(`/admin/apis/${apiId}`) },
  addApi(payload) {
    return api.fetch('/admin/apis', { method:'POST', body:JSON.stringify(payload) })
  },
  editApi(apiId, payload) {
    return api.fetch(`/admin/apis/${apiId}`, { method:'PATCH', body:JSON.stringify(payload) })
  },
  deleteApi(apiId){ return api.fetch(`/admin/apis/${apiId}`, { method:'DELETE' }) },

  getAllFeedback(params = {}) {
    const q = new URLSearchParams(params).toString()
    return api.fetch(`/admin/feedback${q ? '?' + q : ''}`)
  },
  getFeedbackById(id) { return api.fetch(`/admin/feedback/${id}`) },
  approveFeedback(id) {
    return api.fetch(`/admin/feedback/${id}/approve`, { method:'PATCH' })
  },
  rejectFeedback(id, reason = '') {
    return api.fetch(`/admin/feedback/${id}/reject`, { method:'PATCH', body:JSON.stringify({ reason }) })
  },

  getAllAlerts(params = {}) {
    const q = new URLSearchParams(params).toString()
    return api.fetch(`/admin/alerts${q ? '?' + q : ''}`)
  },
  getAlertSummary(){ return api.fetch('/admin/alerts/summary') },
  dismissAlert(id){
    return api.fetch(`/admin/alerts/${id}/dismiss`, { method:'PATCH' })
  },

  getDashboardStats() { return api.fetch('/admin/stats') },

  getActivityLog(params = {}){
    const q = new URLSearchParams(params).toString()
    return api.fetch(`/admin/activity-log${q ? '?' + q : ''}`)
  },
}

export function requireAdmin() {
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

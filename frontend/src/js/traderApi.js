import {api} from '../api/api'

const traderApi = {
  applyAsTrader(payload){ return api.post('/trader/apply', payload) },        
  getOwnApplication(){ return api.get('/trader/application') },

  listTraderApplications(status = '') {
    return api.get(`/admin/trader-applications${status ? `?status=${status}` : ''}`)
  },
  reviewTraderApplication(profileId, decision, reason = null, note = '') {
    return api.put(`/admin/trader-applications/${profileId}`, {
      status: decision,
      rejection_reason: reason,
      verification_note: note,
    })
  },

  getClients(){ return api.get('/trader/clients') },
  getSignalsForReview(){ return api.get('/trader/signals') },
  endorseSignal(payload){ return api.post('/trader/signals/endorse', payload) }, // { ticker, verdict:'agree'|'disagree', note }

  listTraders(){ return api.get('/traders') },
  engageTrader(traderId){ return api.post('/engagements', { trader_id: traderId }) },
  getOwnEngagement(){ return api.get('/engagements/me') },
  endEngagement(id){ return api.delete(`/engagements/${id}`) },
}

export default traderApi

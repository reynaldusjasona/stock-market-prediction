import { api } from '../api/api'

const traderApi = {
  getClients()          { return api.get('/trader/clients') },
  getSignalsForReview(params = {}) {
    const q = new URLSearchParams(params).toString()
    return api.get(`/trader/signals${q ? '?' + q : ''}`)
  },
  endorseSignal({ signal_id, verdict, note }) {
    return api.post('/trader/signals/endorse', {
      signal_id,
      endorsement: verdict,
      notes: note || '',
    })
  },
  getEndorsements(params = {}) {
    const q = new URLSearchParams(params).toString()
    return api.get(`/trader/endorsements${q ? '?' + q : ''}`)
  },
}

export default traderApi

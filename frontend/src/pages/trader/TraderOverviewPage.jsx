import {useEffect, useState} from 'react'
import traderApi from '../../js/traderApi'
import '../../styles/admin/adminShared.css'
import '../../styles/trader/traderShared.css'

function TraderOverviewPage({ onNav }) {
  const[signals, setSignals] = useState([])
  const[clients, setClients] = useState([])
  const[loading, setLoading] = useState(true)

  useEffect(()=>{
    Promise.allSettled([traderApi.getSignalsForReview(), traderApi.getClients()])
      .then(([s, c]) => {
        if (s.status === 'fulfilled') setSignals(Array.isArray(s.value) ? s.value : [])
        if (c.status === 'fulfilled') setClients(Array.isArray(c.value) ? c.value : [])
      })
      .finally(() => setLoading(false))
  }, [])

  const pending  = signals.filter(s => !s.endorsement)
  const reviewed = signals.filter(s => s.endorsement)

  const cards = [
    {label:'Pending Reviews', val: pending.length,nav:'signals', cls: pending.length ? ' pending' : '' },
    {label:'Reviewed',val: reviewed.length, nav:'signals', cls: ' accent' },
    {label:'Active Clients',val: clients.length,nav:'clients', cls: '' },
  ]

  return (
    <div>
      <div className="admin-page-header">
        <h1 className="admin-page-title">Dashboard</h1>
        <p className="admin-page-sub">
          {new Date().toLocaleDateString('en-SG', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}
        </p>
      </div>

      {/* Needs attention */}
      {!loading && pending.length > 0 && (
        <div style={{ marginBottom:'1.75rem' }}>
          <div className="trader-attention-label">Needs Attention</div>
          <button className="trader-attention-strip" onClick={() => onNav?.('signals')}>
            <span className="trader-attention-dot"/>
            {pending.length} signal{pending.length !== 1 ? 's' : ''} awaiting your review
            <span className="trader-attention-arrow">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M4.5 2.5L8 6l-3.5 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </span>
          </button>
        </div>
      )}

      {/* Stat cards */}
      <div className="admin-stats-row">
        {cards.map(c => (
          <div key={c.label} className="admin-stat-card trader-stat-card" onClick={() => onNav?.(c.nav)}>
            <div className="admin-stat-label">{c.label}</div>
            <div className={`admin-stat-value trader-stat-value${c.cls}`}>
              {loading ? '—' : c.val}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default TraderOverviewPage

import {useEffect, useState} from 'react'
import traderApi from '../../js/traderApi'
import EndorseSignalModal from './EndorseSignalModal'
import '../../styles/admin/adminShared.css'
import '../../styles/trader/traderShared.css'

const SIGNAL_COLOR = { Buy:'#00ff41', Hold:'#60a5fa', Sell:'#ff4444' }

function ViewSignalReviewsPage() {
  const[signals,setSignals]= useState([])
  const[loading,setLoading]= useState(true)
  const[error,setError]= useState('')
  const[selected,setSelected]= useState(null)

  const load = async()=> {
    setLoading(true); setError('')
    try{
      const s= await traderApi.getSignalsForReview()
      setSignals(Array.isArray(s) ? s : [])
    } 
	catch (err){
      setError(err.message || 'Failed to load signals')
    } 
	finally{ 
	  setLoading(false) 
	}
  }

  useEffect(()=> { load() }, [])

  const handleEndorsed = ()=> {setSelected(null); load()}

  const pending= signals.filter(s => !s.endorsement)
  const reviewed= signals.filter(s => s.endorsement)

  return(
    <div>
      <div className="admin-page-header">
        <h1 className="admin-page-title">Signal Reviews</h1>
        <p className="admin-page-sub">Review AI signals requested by your clients and add your professional verdict.</p>
      </div>

      {error && <div className="admin-alert error">{error}</div>}

      {loading ? (
        <div style={{ textAlign:'center', padding:'4rem' }}><span className="admin-spinner"/></div>
      ) : (
        <>
          <div className="admin-card" style={{ marginBottom:'1.5rem' }}>
            <div className="admin-card-header"><h2 className="admin-card-title">Awaiting Review ({pending.length})</h2></div>
            <div className="admin-table-wrap">
              <table className="admin-table" aria-label="Signals awaiting review">
                <thead><tr><th>Ticker</th><th>AI Signal</th><th>Confidence</th><th>Requested By</th><th>Actions</th></tr></thead>
                <tbody>
                  {!pending.length ? (
                    <tr><td colSpan="5"><div className="admin-empty"><p>No signals awaiting review. All caught up.</p></div></td></tr>
                  ) : pending.map(s => (
                    <tr key={s.ticker + (s.requested_by || '')} style={{ cursor:'pointer' }} onClick={() => setSelected(s)}>
                      <td style={{ fontFamily:'var(--font-mono)', fontWeight:700 }}>{s.ticker}</td>
                      <td><span style={{ fontWeight:700, color: SIGNAL_COLOR[s.signal] || 'var(--text)' }}>{s.signal}</span></td>
                      <td style={{ fontFamily:'var(--font-mono)' }}>
                        {s.confidence_score != null ? `${Number(s.confidence_score).toFixed(1)}%` : '—'}
                      </td>
                      <td style={{ fontSize:'0.82rem', color:'var(--text-muted)' }}>{s.requested_by_name || s.requested_by || '—'}</td>
                      <td>
                        <div className="action-cell" onClick={e => e.stopPropagation()}>
                          <button className="btn-admin btn-primary" onClick={() => setSelected(s)}>Review</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="admin-card">
            <div className="admin-card-header"><h2 className="admin-card-title">Reviewed ({reviewed.length})</h2></div>
            <div className="admin-table-wrap">
              <table className="admin-table" aria-label="Reviewed signals">
                <thead><tr><th>Ticker</th><th>AI Signal</th><th>Verdict</th><th>Note</th><th>Reviewed At</th></tr></thead>
                <tbody>
                  {!reviewed.length ? (
                    <tr><td colSpan="5"><div className="admin-empty"><p>No reviews submitted yet.</p></div></td></tr>
                  ) : reviewed.map(s => (
                    <tr key={s.ticker + (s.endorsement?.created_at || '')}>
                      <td style={{ fontFamily:'var(--font-mono)', fontWeight:700 }}>{s.ticker}</td>
                      <td><span style={{ fontWeight:700, color: SIGNAL_COLOR[s.signal] || 'var(--text)' }}>{s.signal}</span></td>
                      <td>
                        <span className={`status-badge ${s.endorsement.verdict === 'agree' ? 'status-active' : 'status-suspended'}`}>
                          {s.endorsement.verdict}
                        </span>
                      </td>
                      <td style={{ fontSize:'0.8rem', color:'var(--text-muted)', maxWidth:'260px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {s.endorsement.note || '—'}
                      </td>
                      <td style={{ fontSize:'0.78rem', color:'var(--text-muted)', whiteSpace:'nowrap' }}>
                        {s.endorsement.created_at ? new Date(s.endorsement.created_at).toLocaleString('en-SG', { dateStyle:'short', timeStyle:'short' }) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {selected && (
        <EndorseSignalModal
          signal={selected}
          onClose={() => setSelected(null)}
          onEndorsed={handleEndorsed}
        />
      )}
    </div>
  )
}

export default ViewSignalReviewsPage

import {useEffect, useState} from 'react'
import traderApi from '../../js/traderApi'
import EndorseSignalModal from './EndorseSignalModal'
import RespondToInquiryModal from './RespondToInquiryModal'
import '../../styles/admin/adminShared.css'
import '../../styles/trader/traderShared.css'

const SIGNAL_COLOR = { Buy:'#00ff41', Sell:'#ff4444' }

function ViewSignalReviewsPage() {
  const[activeTab,setActiveTab]= useState('signals')

  const[signals,setSignals]= useState([])
  const[loading,setLoading]= useState(true)
  const[error,setError]= useState('')
  const[selected,setSelected]= useState(null)

  const[inquiries,setInquiries]= useState([])
  const[inquiriesLoading,setInquiriesLoading]= useState(true)
  const[inquiriesError,setInquiriesError]= useState('')
  const[selectedInquiry,setSelectedInquiry]= useState(null)

  const load = async()=> {
    setLoading(true); setError('')
    try{
      const s= await traderApi.getSignalsForReview()
      setSignals(Array.isArray(s) ? s : (s?.signals || s?.data || []))
    }
	catch (err){
      setError(err.message || 'Failed to load signals')
    }
	finally{
	  setLoading(false)
	}
  }

  const loadInquiries = async()=> {
    setInquiriesLoading(true); setInquiriesError('')
    try{
      const r= await traderApi.getStockInquiries()
      setInquiries(Array.isArray(r) ? r : (r?.inquiries || []))
    }
	catch (err){
      setInquiriesError(err.message || 'Failed to load client questions')
    }
	finally{
	  setInquiriesLoading(false)
	}
  }

  useEffect(()=> { load() }, [])
  useEffect(()=> { loadInquiries() }, [])

  const handleEndorsed = ()=> {setSelected(null); load()}
  const handleResponded = ()=> {setSelectedInquiry(null); loadInquiries()}

  // A signal is "reviewed" if it has a verdict/endorsement already set
  const pending  = signals.filter(s => !s.verdict && !s.endorsement)
  const reviewed = signals.filter(s => s.verdict || s.endorsement)

  const openInquiries     = inquiries.filter(i => i.status !== 'answered')
  const answeredInquiries = inquiries.filter(i => i.status === 'answered')

  const signalCount = pending.length + reviewed.length
  const inquiryCount = openInquiries.length + answeredInquiries.length

  return(
    <div>
      <div className="admin-page-header">
        <h1 className="admin-page-title">Signal Reviews &amp; Client Questions</h1>
        <p className="admin-page-sub">Review AI signals and respond to investor questions from one place.</p>
      </div>

      <div className="admin-subtabs" style={{ marginBottom:'1.25rem' }}>
        <button className={`admin-subtab${activeTab === 'signals' ? ' active' : ''}`}
          onClick={() => setActiveTab('signals')}>
          Signal Reviews{signalCount > 0 ? ` (${signalCount})` : ''}
        </button>
        <button className={`admin-subtab${activeTab === 'inquiries' ? ' active' : ''}`}
          onClick={() => setActiveTab('inquiries')}>
          Client Questions{inquiryCount > 0 ? ` (${inquiryCount})` : ''}
        </button>
      </div>

      {activeTab === 'signals' && (
        <>
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
                        <tr key={s.id || s.ticker + (s.requested_by || '')} style={{ cursor:'pointer' }} onClick={() => setSelected(s)}>
                          <td style={{ fontFamily:'var(--font-mono)', fontWeight:700 }}>{s.ticker}</td>
                          <td><span style={{ fontWeight:700, color: SIGNAL_COLOR[s.signal] || 'var(--text)' }}>{s.signal}</span></td>
                          <td style={{ fontFamily:'var(--font-mono)' }}>
                            {s.confidence_score != null ? `${Number(s.confidence_score).toFixed(1)}%` : '—'}
                          </td>
                          <td style={{ fontSize:'0.82rem', color:'var(--text-muted)' }}>{s.investor_name || s.requested_by_name || (s.investor_id ? `Investor #${s.investor_id.slice(0,8)}` : '—')}</td>
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
                      ) : reviewed.map(s => {
                        const verdict = s.verdict || s.endorsement?.verdict
                        const note    = s.note || s.endorsement?.note
                        const at      = s.endorsed_at || s.endorsement?.created_at
                        return (
                          <tr key={s.id || s.ticker + (at || '')}>
                            <td style={{ fontFamily:'var(--font-mono)', fontWeight:700 }}>{s.ticker}</td>
                            <td><span style={{ fontWeight:700, color: SIGNAL_COLOR[s.signal] || 'var(--text)' }}>{s.signal}</span></td>
                            <td>
                              <span className={`status-badge ${verdict === 'agree' ? 'status-active' : 'status-suspended'}`}>
                                {verdict}
                              </span>
                            </td>
                            <td style={{ fontSize:'0.8rem', color:'var(--text-muted)', maxWidth:'260px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                              {note || '—'}
                            </td>
                            <td style={{ fontSize:'0.78rem', color:'var(--text-muted)', whiteSpace:'nowrap' }}>
                              {at ? new Date(at).toLocaleString('en-SG', { dateStyle:'short', timeStyle:'short' }) : '—'}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {activeTab === 'inquiries' && (
        <>
          {inquiriesError && <div className="admin-alert error">{inquiriesError}</div>}

          {inquiriesLoading ? (
            <div style={{ textAlign:'center', padding:'4rem' }}><span className="admin-spinner"/></div>
          ) : (
            <>
              <div className="admin-card" style={{ marginBottom:'1.5rem' }}>
                <div className="admin-card-header"><h2 className="admin-card-title">Open ({openInquiries.length})</h2></div>
                <div className="admin-table-wrap">
                  <table className="admin-table" aria-label="Open client questions">
                    <thead><tr><th>Ticker</th><th>Question</th><th>Asked By</th><th>Actions</th></tr></thead>
                    <tbody>
                      {!openInquiries.length ? (
                        <tr><td colSpan="4"><div className="admin-empty"><p>No open questions. All caught up.</p></div></td></tr>
                      ) : openInquiries.map(i => (
                        <tr key={i.id} style={{ cursor:'pointer' }} onClick={() => setSelectedInquiry(i)}>
                          <td style={{ fontFamily:'var(--font-mono)', fontWeight:700 }}>{i.ticker}</td>
                          <td style={{ fontSize:'0.8rem', color:'var(--text-muted)', maxWidth:'260px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                            {i.message || '—'}
                          </td>
                          <td style={{ fontSize:'0.82rem', color:'var(--text-muted)' }}>{i.investor_name || (i.investor_id ? `Investor #${i.investor_id.slice(0,8)}` : '—')}</td>
                          <td>
                            <div className="action-cell" onClick={e => e.stopPropagation()}>
                              <button className="btn-admin btn-primary" onClick={() => setSelectedInquiry(i)}>Respond</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="admin-card">
                <div className="admin-card-header"><h2 className="admin-card-title">Answered ({answeredInquiries.length})</h2></div>
                <div className="admin-table-wrap">
                  <table className="admin-table" aria-label="Answered client questions">
                    <thead><tr><th>Ticker</th><th>Question</th><th>Response</th><th>Responded At</th></tr></thead>
                    <tbody>
                      {!answeredInquiries.length ? (
                        <tr><td colSpan="4"><div className="admin-empty"><p>No questions answered yet.</p></div></td></tr>
                      ) : answeredInquiries.map(i => (
                        <tr key={i.id}>
                          <td style={{ fontFamily:'var(--font-mono)', fontWeight:700 }}>{i.ticker}</td>
                          <td style={{ fontSize:'0.8rem', color:'var(--text-muted)', maxWidth:'220px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                            {i.message || '—'}
                          </td>
                          <td style={{ fontSize:'0.8rem', color:'var(--text-muted)', maxWidth:'260px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                            {i.response || '—'}
                          </td>
                          <td style={{ fontSize:'0.78rem', color:'var(--text-muted)', whiteSpace:'nowrap' }}>
                            {i.responded_at ? new Date(i.responded_at).toLocaleString('en-SG', { dateStyle:'short', timeStyle:'short' }) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {selected && (
        <EndorseSignalModal
          signal={selected}
          onClose={() => setSelected(null)}
          onEndorsed={handleEndorsed}
        />
      )}

      {selectedInquiry && (
        <RespondToInquiryModal
          inquiry={selectedInquiry}
          onClose={() => setSelectedInquiry(null)}
          onResponded={handleResponded}
        />
      )}
    </div>
  )
}

export default ViewSignalReviewsPage

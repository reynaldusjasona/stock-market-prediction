import {useEffect, useState, useRef} from 'react'
import adminApi from '../../js/adminApi'
import {showToast} from '../../js/adminUi'
import ViewAlertModal from './ViewAlertModal'
import SearchAlertsComponent from './SearchAlertsComponent'
import '../../styles/admin/adminShared.css'

const PAGE = 15

function ViewAlertsPage(){
  const [alerts,setAlerts]= useState([])
  const [summary,setSummary]= useState({critical:0, warning:0, info:0, resolved:0})
  const [loading,setLoading]= useState(true)
  const [filter,setFilter]= useState('open')
  const [sevFilter,setSevFilter]= useState('all')
  const [page,setPage]= useState(1)
  const [detail,setDetail]= useState(null)
  const timer= useRef(null)

  const loadAlerts= async(q = '')=>{
    setLoading(true)
    try{
      const d= await adminApi.getAllAlerts(q ? {q} : {})
      setAlerts(Array.isArray(d) ? d : (d?.alerts || []))
    } 
	catch (err){
		showToast(err.message||'Failed to load alerts', 'error')
	}
    finally{
		setLoading(false) 
	}
  }

  const loadSummary=async()=>{
    try{
      const s= await adminApi.getAlertSummary()
      setSummary({critical:s?.critical??0, warning:s?.warning??0, info:s?.info??0, resolved:s?.resolved??0})
    } 
	catch{ /* optional */ }
  }

  useEffect(()=>{
    loadAlerts(); 
	loadSummary()
    timer.current= setInterval(()=> {loadAlerts(); 
									 loadSummary() 
									 },60000)
    return ()=>clearInterval(timer.current)
  }, [])

  const handleDismissed= (id)=>{
    setAlerts(prev=>prev.map(a=>
      String(a.id)===String(id) ? { ...a, is_resolved:true, status:'resolved' } : a
    ))
    loadSummary()
  }

  const filtered= alerts.filter(a => {
    const res= a.is_resolved || a.status === 'resolved'
    if (filter==='open' &&  res) 
		return false
    if (filter==='resolved' && !res) 
		return false
    const sev= (a.severity || 'info').toLowerCase()
    if (sevFilter !== 'all' && sev !== sevFilter) 
		return false
    return true
  })
  const totalPages= Math.ceil(filtered.length/PAGE)
  const paged= filtered.slice((page - 1)*PAGE, page*PAGE)

  return(
    <div>
      <div className="admin-page-header">
        <h1 className="admin-page-title">Platform Alerts</h1>
        <p className="admin-page-sub">Monitor system health events. Auto-refreshes every 60 seconds.</p>
      </div>

      {/* Summary stat cards */}
      <div className="admin-stats-row" style={{ gridTemplateColumns:'repeat(4,1fr)', marginBottom:'1.5rem' }}>
        {[
          {label:'Critical',val:summary.critical,color:'danger'},
          {label:'Warning',val:summary.warning,color:'warn'},
          {label:'Info',val:summary.info,color:'blue'},
          {label:'Resolved',val:summary.resolved,color:''},
        ].map(c=>(
          <div key={c.label} className="admin-stat-card">
            <div className="admin-stat-label">{c.label}</div>
            <div className={`admin-stat-value ${c.color}`} style={{ fontSize:'1.6rem' }}>{c.val}</div>
          </div>
        ))}
      </div>

      <div className="admin-card">
        <div className="admin-card-header" style={{flexDirection:'column', alignItems:'flex-start', gap:'0.75rem'}}>
          <div style={{display:'flex', width:'100%', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'0.75rem'}}>
            <SearchAlertsComponent onSearch={q => { setPage(1); loadAlerts(q) }}/>
            <span style={{fontSize:'0.78rem', color:'var(--text-muted)'}}>
              {filtered.length} alert{filtered.length !== 1 ? 's' : ''}
            </span>
          </div>

          <div style={{display:'flex', gap:'0.5rem', flexWrap:'wrap'}}>
            <div className="admin-subtabs">
              {['open','resolved','all'].map(f => (
                <button key={f} className={`admin-subtab${filter===f?' active':''}`}
                  onClick={()=>{setFilter(f); setPage(1)}}>
                  {f.charAt(0).toUpperCase()+f.slice(1)}
                </button>
              ))}
            </div>
            <div className="admin-subtabs">
              {[
                {k:'all',l:'All Severity'},
                {k:'critical',l:'Critical',c:'#ff4444'},
                {k:'warning',l:'Warning',c:'#ff8c00'},
                {k:'info',l:'Info',c:'#60a5fa'},
              ].map(({k, l, c})=>(
                <button key={k}
                  className={`admin-subtab${sevFilter===k?' active':''}`}
                  onClick={()=>{setSevFilter(k); setPage(1)}}
                  style={c && sevFilter===k ? { color:c } : {}}>
                  {l}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="admin-table-wrap">
          <table className="admin-table" aria-label="Platform alerts">
            <thead>
              <tr><th>Severity</th><th>Message</th><th>Source</th><th>Time</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="5" style={{textAlign:'center', padding:'2.5rem'}}><span className="admin-spinner"/></td></tr>
              ) : !paged.length ? (
                <tr><td colSpan="5">
                  <div className="admin-empty">
                    <p>{filter==='open' ? 'No open alerts. Platform is healthy.' : 'No alerts match your filters.'}</p>
                  </div>
                </td></tr>
              ) : paged.map(a=>{
                const sev= (a.severity || 'info').toLowerCase()
                const res= a.is_resolved || a.status === 'resolved'
                return(
                  <tr key={a.id} style={{ cursor:'pointer' }} onClick={() => setDetail(a)}>
                    <td>
                      <span className={`status-badge status-${res ? 'resolved' : sev}`}>
                        {res ? 'Resolved' : sev}
                      </span>
                    </td>
                    <td style={{ maxWidth:'320px' }}>
                      <div style={{ fontSize:'0.875rem', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {a.message || a.title || '—'}
                      </div>
                    </td>
                    <td style={{ fontSize:'0.8rem', color:'var(--text-muted)' }}>{a.source || a.service || '—'}</td>
                    <td style={{ fontSize:'0.78rem', color:'var(--text-muted)', whiteSpace:'nowrap' }}>
                      {a.created_at
                        ? new Date(a.created_at).toLocaleString('en-SG', { dateStyle:'short', timeStyle:'short' })
                        : '—'}
                    </td>
                    <td>
                      <div className="action-cell" onClick={e => e.stopPropagation()}>
                        <button className="icon-btn" title="View detail" onClick={() => setDetail(a)}>
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                            <path d="M1 7s2.5-4.5 6-4.5S13 7 13 7s-2.5 4.5-6 4.5S1 7 1 7z" stroke="currentColor" strokeWidth="1.1"/>
                            <circle cx="7" cy="7" r="1.5" stroke="currentColor" strokeWidth="1.1"/>
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="admin-pagination">
            <span style={{ marginRight:'0.5rem' }}>
              {(page-1)*PAGE+1}–{Math.min(page*PAGE, filtered.length)} of {filtered.length}
            </span>
            <button disabled={page===1} onClick={() => setPage(p=>p-1)}>‹</button>
            {Array.from({length:totalPages},(_,i)=>i+1)
              .filter(i=>i===1 || i===totalPages || Math.abs(i-page)<=1)
              .map((i, idx, arr) => (
                <span key={i} style={{ display:'contents' }}>
                  {idx>0 && arr[idx-1]!==i-1 && <span style={{ padding:'0 0.2rem', color:'var(--text-subtle)' }}>…</span>}
                  <button className={i===page?'active':''} onClick={() => setPage(i)}>{i}</button>
                </span>
              ))}
            <button disabled={page===totalPages} onClick={() => setPage(p=>p+1)}>›</button>
          </div>
        )}
      </div>

      {/* Detail modal — now a separate component */}
      {detail && (
        <ViewAlertModal
          target={detail}
          onClose={()=>setDetail(null)}
          onDismissed={handleDismissed}
        />
      )}
    </div>
  )
}

export default ViewAlertsPage

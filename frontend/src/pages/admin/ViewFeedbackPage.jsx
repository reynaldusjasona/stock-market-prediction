import {useState} from 'react'
import adminApi from '../../js/adminApi'
import {debounce} from '../../js/api'
import '../../styles/admin/adminShared.css'

const PAGE= 12
const dbs= debounce((fn, q) => fn(q), 280)

function ViewFeedbackPage({feedback,loading,onSearch,onApprove,onReject}) {
  const [filter,setFilter]= useState('pending')
  const [page,setPage]= useState(1)
  const [detail,setDetail]= useState(null)
  const [fetching,setFetching]= useState(false)

  const counts={all: feedback.length, pending:0, approved:0, rejected:0}
  feedback.forEach(f =>{const s= f.status||'pending'; 
  if (counts[s]!=null) 
	  counts[s]++ 
  })

  const filtered= feedback.filter(f =>filter==='all'||(f.status||'pending')===filter)
  const totalPages= Math.ceil(filtered.length / PAGE)
  const paged= filtered.slice((page-1)*PAGE, page*PAGE)
  const isPending= f=>(f.status||'pending')=== 'pending'

  const openDetail= async(item)=>{
    setFetching(true); 
	setDetail(item)
    try{ 
		const full = await adminApi.getFeedbackById(item.id); 
		setDetail(full) 
	}
    catch{ /* keep partial */ }
    finally{ 
		setFetching(false) 
	}
  }

  return (
    <div>
      <div className="admin-page-header">
        <h1 className="admin-page-title">Manage Feedbacks</h1>
        <p className="admin-page-sub">Review submitted feedback and approve or reject content for publication.</p>
      </div>

      <div className="admin-card">
        <div className="admin-card-header">
          <div className="admin-search-wrap">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.25"/>
              <path d="M9.5 9.5l3 3" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
            </svg>
            <input className="admin-search-input" type="text"
              placeholder="Search by user or message…"
              onChange={e => { setPage(1); dbs(onSearch, e.target.value.trim()) }}
              autoComplete="off"/>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', flexWrap:'wrap' }}>
            <div className="admin-subtabs">
              {['pending','approved','rejected','all'].map(f => (
                <button key={f} className={`admin-subtab${filter===f?' active':''}`}
                  onClick={() => { setFilter(f); setPage(1) }}>
                  {f.charAt(0).toUpperCase()+f.slice(1)}
                  {counts[f] > 0 ? ` (${counts[f]})` : ''}
                </button>
              ))}
            </div>
            <span style={{ fontSize:'0.78rem', color:'var(--text-muted)' }}>
              {filtered.length} item{filtered.length!==1?'s':''}
            </span>
          </div>
        </div>

        <div className="admin-table-wrap">
          <table className="admin-table" aria-label="User feedback">
            <thead>
              <tr><th>User</th><th>Message Preview</th><th>Rating</th><th>Status</th><th>Date</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="6" style={{ textAlign:'center', padding:'2.5rem' }}><span className="admin-spinner"/></td></tr>
              ) : !paged.length ? (
                <tr><td colSpan="6"><div className="admin-empty"><p>No {filter!=='all'?filter+' ':''}feedback found.</p></div></td></tr>
              ) : paged.map(f => {
                const status  = (f.status||'pending').toLowerCase()
                const preview = (f.message||f.content||'').slice(0,80)
                const stars   = f.rating!=null ? '★'.repeat(Math.round(f.rating))+'☆'.repeat(5-Math.round(f.rating)) : '—'
                return (
                  <tr key={f.id} style={{ cursor:'pointer' }} onClick={() => openDetail(f)}>
                    <td><div style={{ fontWeight:600, fontSize:'0.875rem' }}>{f.user_name||f.user_email||'Anonymous'}</div></td>
                    <td style={{ maxWidth:'260px' }}>
                      <div style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontSize:'0.875rem', color:'var(--text-muted)' }}>
                        {preview}{(f.message||'').length>80?'…':''}
                      </div>
                    </td>
                    <td style={{ fontFamily:'var(--font-mono)', fontSize:'0.8rem', color:'#ffd600' }}>{stars}</td>
                    <td><span className={`status-badge status-${status}`}>{status}</span></td>
                    <td style={{ fontSize:'0.78rem', color:'var(--text-muted)', whiteSpace:'nowrap' }}>
                      {f.created_at ? new Date(f.created_at).toLocaleDateString('en-SG') : '—'}
                    </td>
                    <td>
                      <div className="action-cell" onClick={e => e.stopPropagation()}>
                        <button className="icon-btn" title="View" onClick={() => openDetail(f)}>
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                            <path d="M1 7s2.5-4.5 6-4.5S13 7 13 7s-2.5 4.5-6 4.5S1 7 1 7z" stroke="currentColor" strokeWidth="1.1"/>
                            <circle cx="7" cy="7" r="1.5" stroke="currentColor" strokeWidth="1.1"/>
                          </svg>
                        </button>
                        {isPending(f) && <>
                          <button className="icon-btn success" title="Approve" onClick={() => onApprove(f)}>
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                              <path d="M2.5 7l3 3 6-6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </button>
                          <button className="icon-btn danger" title="Reject" onClick={() => onReject(f)}>
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                              <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                            </svg>
                          </button>
                        </>}
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
            <span style={{ marginRight:'0.5rem' }}>{(page-1)*PAGE+1}–{Math.min(page*PAGE,filtered.length)} of {filtered.length}</span>
            <button disabled={page===1} onClick={() => setPage(p=>p-1)}>‹</button>
            {Array.from({length:totalPages},(_,i)=>i+1).filter(i=>i===1||i===totalPages||Math.abs(i-page)<=1).map((i,idx,arr)=>(
              <span key={i} style={{display:'contents'}}>
                {idx>0&&arr[idx-1]!==i-1&&<span style={{padding:'0 0.2rem',color:'var(--text-subtle)'}}>…</span>}
                <button className={i===page?'active':''} onClick={()=>setPage(i)}>{i}</button>
              </span>
            ))}
            <button disabled={page===totalPages} onClick={() => setPage(p=>p+1)}>›</button>
          </div>
        )}
      </div>

      {/* Detail modal */}
      {detail && (
        <div className="admin-modal-overlay" onClick={e => e.target===e.currentTarget && setDetail(null)}>
          <div className="admin-modal" role="dialog" aria-modal="true">
            <div className="admin-modal-header">
              <h2 className="admin-modal-title">Feedback Detail</h2>
              <button className="icon-btn" onClick={() => setDetail(null)} aria-label="Close">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
              </button>
            </div>
            <div className="admin-modal-body">
              {fetching && <div style={{ textAlign:'center', marginBottom:'1rem' }}><span className="admin-spinner"/></div>}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.75rem', marginBottom:'1.25rem' }}>
                <div><div className="admin-form-label">Submitted By</div><div style={{ fontWeight:600 }}>{detail.user_name||detail.user_email||'Anonymous'}</div></div>
                <div><div className="admin-form-label">Date</div><div>{detail.created_at?new Date(detail.created_at).toLocaleString('en-SG'):'—'}</div></div>
                <div>
                  <div className="admin-form-label">Status</div>
                  <span className={`status-badge status-${(detail.status||'pending').toLowerCase()}`}>{detail.status||'pending'}</span>
                </div>
                <div>
                  <div className="admin-form-label">Rating</div>
                  <div style={{ color:'#ffd600', fontFamily:'var(--font-mono)' }}>
                    {detail.rating!=null?`${'★'.repeat(Math.round(detail.rating))}${'☆'.repeat(5-Math.round(detail.rating))} (${detail.rating}/5)`:'—'}
                  </div>
                </div>
              </div>
              <div className="admin-form-label">Message</div>
              <div style={{ background:'var(--bg)', border:'1px solid var(--border)', borderRadius:'8px', padding:'0.85rem 1rem', fontSize:'0.875rem', lineHeight:1.65, color:'var(--text-muted)', whiteSpace:'pre-wrap', marginTop:'0.4rem' }}>
                {detail.message||detail.content||'—'}
              </div>
            </div>
            {isPending(detail) && (
              <div className="admin-modal-footer">
                <button className="btn-admin btn-ghost" onClick={() => setDetail(null)}>Close</button>
                <button className="btn-admin btn-danger" onClick={() => { setDetail(null); onReject(detail) }}>Reject</button>
                <button className="btn-admin btn-success" onClick={() => { setDetail(null); onApprove(detail) }}>Approve &amp; Publish</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default ViewFeedbackPage

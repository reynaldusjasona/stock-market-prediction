import {useEffect, useState} from 'react'
import adminApi from '../../js/adminApi'
import {showToast} from '../../js/adminUi'
import SearchFeedbackComponent from './SearchFeedbackComponent'
import ViewFeedbackModal from './ViewFeedbackModal'
import ApproveFeedbackModal from './ApproveFeedbackModal'
import RejectFeedbackModal from './RejectFeedbackModal'
import '../../styles/admin/adminShared.css'

const PAGE= 12

function ManageFeedbacksPage(){
  const[feedback, setFeedback]= useState([])
  const[loading, setLoading]= useState(true)
  const[searchQuery,setSearchQuery]= useState('')
  const[filter,setFilter]= useState('pending')
  const[page,setPage]= useState(1)
  const[viewTarget,setViewTarget]= useState(null)
  const[approveTarget,setApproveTarget]= useState(null)
  const[rejectTarget,setRejectTarget]= useState(null)

  const load= async(q = '')=>{
    setLoading(true)
    try{
      const d= await adminApi.getAllFeedback(q ? { q } : {})
      setFeedback(Array.isArray(d) ? d : (d?.feedback || []))
    } 
	catch (err){
      showToast(err.message||'Failed to load feedback', 'error')
      setFeedback([])
    } 
	finally{
		setLoading(false) 
	}
  }

  useEffect(()=>{load()},[])

  const handleSearch=(q)=>{
    setSearchQuery(q)
    setPage(1)
    load(q)
  }

  const afterAction=()=>load(searchQuery)

  const counts= {all: feedback.length, pending:0, approved:0, rejected:0}
  feedback.forEach(f=>{const s=f.status||'pending'; 
					   if (counts[s] != null) 
						   counts[s]++ 
					   })

  const filtered= feedback.filter(f=>filter==='all'||(f.status||'pending')===filter)
  const totalPages= Math.ceil(filtered.length / PAGE)
  const paged= filtered.slice((page - 1)*PAGE,page*PAGE)
  const isPending= f=>(f.status||'pending')==='pending'

  return(
    <div>
      <div className="admin-page-header">
        <h1 className="admin-page-title">Manage Feedbacks</h1>
        <p className="admin-page-sub">Review submitted feedback and approve or reject content for publication.</p>
      </div>

      <div className="admin-card">
        <div className="admin-card-header">
          <SearchFeedbackComponent
            onSearch={handleSearch}
            defaultValue={searchQuery}
          />
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
              {filtered.length} item{filtered.length !== 1 ? 's' : ''}
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
                <tr><td colSpan="6"><div className="admin-empty"><p>No {filter !== 'all' ? filter + ' ' : ''}feedback found.</p></div></td></tr>
              ) : paged.map(f => {
                const status= (f.status || 'pending').toLowerCase()
                const preview= (f.message || f.content || '').slice(0, 80)
                const stars= f.rating != null ? '★'.repeat(Math.round(f.rating)) + '☆'.repeat(5 - Math.round(f.rating)) : '—'
                return (
                  <tr key={f.id} style={{ cursor:'pointer' }} onClick={() => setViewTarget(f)}>
                    <td><div style={{ fontWeight:600, fontSize:'0.875rem' }}>{f.user_name || f.user_email || 'Anonymous'}</div></td>
                    <td style={{ maxWidth:'260px' }}>
                      <div style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontSize:'0.875rem', color:'var(--text-muted)' }}>
                        {preview}{(f.message || '').length > 80 ? '…' : ''}
                      </div>
                    </td>
                    <td style={{ fontFamily:'var(--font-mono)', fontSize:'0.8rem', color:'#ffd600' }}>{stars}</td>
                    <td><span className={`status-badge status-${status}`}>{status}</span></td>
                    <td style={{ fontSize:'0.78rem', color:'var(--text-muted)', whiteSpace:'nowrap' }}>
                      {f.created_at ? new Date(f.created_at).toLocaleDateString('en-SG') : '—'}
                    </td>
                    <td>
                      <div className="action-cell" onClick={e => e.stopPropagation()}>
                        <button className="icon-btn" title="View" onClick={() => setViewTarget(f)}>
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                            <path d="M1 7s2.5-4.5 6-4.5S13 7 13 7s-2.5 4.5-6 4.5S1 7 1 7z" stroke="currentColor" strokeWidth="1.1"/>
                            <circle cx="7" cy="7" r="1.5" stroke="currentColor" strokeWidth="1.1"/>
                          </svg>
                        </button>
                        {isPending(f) && <>
                          <button className="icon-btn success" title="Approve" onClick={() => setApproveTarget(f)}>
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                              <path d="M2.5 7l3 3 6-6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </button>
                          <button className="icon-btn danger" title="Reject" onClick={() => setRejectTarget(f)}>
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
            <span style={{marginRight:'0.5rem'}}>{(page-1)*PAGE+1}–{Math.min(page*PAGE, filtered.length)} of {filtered.length}</span>
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

      {viewTarget && <ViewFeedbackModal target={viewTarget} onClose={()=>setViewTarget(null)} onApprove={setApproveTarget} onReject={setRejectTarget}/>}
      {approveTarget && <ApproveFeedbackModal target={approveTarget} onClose={()=>setApproveTarget(null)} onDone={afterAction}/>}
      {rejectTarget && <RejectFeedbackModal target={rejectTarget} onClose={()=>setRejectTarget(null)} onDone={afterAction}/>}
    </div>
  )
}

export default ManageFeedbacksPage

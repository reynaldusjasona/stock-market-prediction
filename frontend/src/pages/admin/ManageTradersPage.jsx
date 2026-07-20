import {useEffect, useState} from 'react'
import adminApi from '../../js/adminApi'
import ViewTraderAccountModal from './ViewTraderAccountModal'
import {showToast} from '../../js/adminUi'
import '../../styles/admin/adminShared.css'

const FILTERS= ['pending', 'approved', 'rejected', 'all']
const status= u => u.trader_status || 'pending'
const badge= s => s === 'approved' ? 'status-active' : s === 'rejected' ? 'status-suspended' : 'status-pending'

function ManageTradersPage() {
  const[traders,  setTraders]= useState([])
  const[loading,  setLoading]= useState(true)
  const[filter,   setFilter]= useState('pending')
  const[selected, setSelected]= useState(null)

  const load = async () => {
    setLoading(true)
    try{
      const d = await adminApi.getAllUsers({ role: 'trader' })
      const list = Array.isArray(d) ? d : (d?.users || [])
      setTraders(list.filter(u => u.role === 'trader'))
    } 
	catch (err){
      showToast(err.message || 'Failed to load trader accounts', 'error')
      setTraders([])
    } 
	finally{ 
	  setLoading(false) 
	}
  }

  useEffect(() => { load() }, [])

  const handleReviewed = () => { setSelected(null); load() }

  const filtered = traders.filter(u => filter === 'all' || status(u) === filter)
  const counts = { pending:0, approved:0, rejected:0 }
  traders.forEach(u => { const s = status(u); if (counts[s] != null) counts[s]++ })

  return (
    <div>
      <div className="admin-page-header">
        <h1 className="admin-page-title">Trader Approvals</h1>
        <p className="admin-page-sub">
          Traders cannot access the platform until their license number is verified and
          their account is approved by an administrator.
        </p>
      </div>

      <div className="admin-card">
        <div className="admin-card-header">
          <div className="admin-subtabs">
            {FILTERS.map(f => (
              <button key={f} className={`admin-subtab${filter === f ? ' active' : ''}`}
                onClick={() => setFilter(f)}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
                {f !== 'all' && counts[f] > 0 ? ` (${counts[f]})` : ''}
              </button>
            ))}
          </div>
          <span style={{ fontSize:'0.78rem', color:'var(--text-muted)' }}>
            {filtered.length} trader{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>

        <div className="admin-table-wrap">
          <table className="admin-table" aria-label="Trader accounts">
            <thead>
              <tr><th>Trader</th><th>License Number</th><th>Status</th><th>Registered</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="5" style={{ textAlign:'center', padding:'2.5rem' }}><span className="admin-spinner"/></td></tr>
              ) : !filtered.length ? (
                <tr><td colSpan="5"><div className="admin-empty">
                  <p>{filter === 'pending' ? 'No pending trader applications.' : 'No traders match this filter.'}</p>
                </div></td></tr>
              ) : filtered.map(u => (
                <tr key={u.id} style={{ cursor:'pointer' }} onClick={() => setSelected(u)}>
                  <td>
                    <div style={{ fontWeight:600, fontSize:'0.875rem' }}>{u.name || u.full_name || '—'}</div>
                    <div style={{ fontSize:'0.75rem', color:'var(--text-muted)' }}>{u.email || '—'}</div>
                  </td>
                  <td style={{ fontFamily:'var(--font-mono)', fontSize:'0.82rem' }}>{u.license_number || '—'}</td>
                  <td><span className={`status-badge ${badge(status(u))}`}>{status(u)}</span></td>
                  <td style={{ fontSize:'0.78rem', color:'var(--text-muted)', whiteSpace:'nowrap' }}>
                    {u.created_at ? new Date(u.created_at).toLocaleDateString('en-SG') : '—'}
                  </td>
                  <td>
                    <div className="action-cell" onClick={e => e.stopPropagation()}>
                      <button className="icon-btn" title="Review" onClick={() => setSelected(u)}>
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                          <path d="M1 7s2.5-4.5 6-4.5S13 7 13 7s-2.5 4.5-6 4.5S1 7 1 7z" stroke="currentColor" strokeWidth="1.1"/>
                          <circle cx="7" cy="7" r="1.5" stroke="currentColor" strokeWidth="1.1"/>
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <ViewTraderAccountModal
          trader={selected}
          onClose={() => setSelected(null)}
          onReviewed={handleReviewed}
        />
      )}
    </div>
  )
}

export default ManageTradersPage

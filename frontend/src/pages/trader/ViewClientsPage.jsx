import {useEffect, useState} from 'react'
import traderApi from '../../js/traderApi'
import '../../styles/admin/adminShared.css'
import '../../styles/trader/traderShared.css'

function ViewClientsPage() {
  const[clients, setClients]= useState([])
  const[loading, setLoading]= useState(true)
  const[error,   setError]= useState('')

  useEffect(()=>{
    traderApi.getClients()
      .then(c => setClients(Array.isArray(c) ? c : []))
      .catch(err => setError(err.message || 'Failed to load clients'))
      .finally(() => setLoading(false))
  }, [])

  return(
    <div>
      <div className="admin-page-header">
        <h1 className="admin-page-title">My Clients</h1>
        <p className="admin-page-sub">Investors who have engaged you for signal reviews.</p>
      </div>

      {error && <div className="admin-alert error">{error}</div>}

      <div className="admin-card">
        <div className="admin-card-header">
          <h2 className="admin-card-title">Clients ({clients.length})</h2>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table" aria-label="Engaged clients">
            <thead><tr><th>Client</th><th>Email</th><th>Engaged Since</th></tr></thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="3" style={{ textAlign:'center', padding:'2.5rem' }}><span className="admin-spinner"/></td></tr>
              ) : !clients.length ? (
                <tr><td colSpan="3"><div className="admin-empty"><p>No clients have engaged you yet.</p></div></td></tr>
              ) : clients.map(c => (
                <tr key={c.id || c.email}>
                  <td style={{ fontWeight:600 }}>{c.name || c.full_name || '—'}</td>
                  <td style={{ fontSize:'0.82rem', color:'var(--text-muted)' }}>{c.email || '—'}</td>
                  <td style={{ fontSize:'0.78rem', color:'var(--text-muted)' }}>
                    {c.engaged_at || c.created_at ? new Date(c.engaged_at || c.created_at).toLocaleDateString('en-SG') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default ViewClientsPage

import {useEffect, useState} from 'react'
import traderApi from '../../js/traderApi'
import ViewSignalReviewsPage from './ViewSignalReviewsPage'
import ViewClientsPage from './ViewClientsPage'
import ViewAccountModal from './ViewAccountModal'
import UpdateAccountModal from './UpdateAccountModal'
import '../../styles/admin/adminShared.css'
import '../../styles/trader/traderShared.css'

const NAV = [
  {key:'overview',label:'Dashboard',icon:'grid'  },
  {key:'signals',label:'Signal Reviews',icon:'chat'  },
  {key:'clients',label:'My Clients',icon:'users' },
]

function Icon({ name, size = 15 }) {
  const p= { stroke:'currentColor', strokeWidth:'1.3', strokeLinecap:'round', strokeLinejoin:'round' }
  const icons= {
    grid:  <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
             <rect x="2" y="2" width="5" height="5" rx="1" {...p}/>
             <rect x="9" y="2" width="5" height="5" rx="1" {...p}/>
             <rect x="2" y="9" width="5" height="5" rx="1" {...p}/>
             <rect x="9" y="9" width="5" height="5" rx="1" {...p}/>
           </svg>,
    chat:  <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
             <path d="M2 2h12a1 1 0 011 1v7a1 1 0 01-1 1H5l-3 3V3a1 1 0 011-1z" {...p}/>
           </svg>,
    users: <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
             <circle cx="6" cy="5" r="3" {...p}/>
             <path d="M1 14c0-3.314 2.239-5 5-5s5 1.686 5 5" {...p}/>
             <path d="M11 7.5a2.5 2.5 0 100-5M13 13.5c0-2.5-1.5-4-3-4.5" {...p}/>
           </svg>,
  }
  return icons[name] || null
}

function Logo({size = 22}){
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <rect width="28" height="28" rx="6" fill="#00ff41" fillOpacity="0.12"/>
      <polyline points="5,18 10,12 14,15 19,8 23,11" stroke="#00ff41" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="23" cy="11" r="2" fill="#00ff41"/>
    </svg>
  )
}

function readUser(){
  try{ 
    return JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('sw_user') || '{}') 
	}
  catch{ 
    return {} 
    }
}

function TraderOverview({onNav}) {
  const[signals, setSignals]= useState([])
  const[clients, setClients]= useState([])
  const[loading, setLoading]= useState(true)

  useEffect(() => {
    Promise.allSettled([traderApi.getSignalsForReview(), traderApi.getClients()])
      .then(([s, c]) => {
        if (s.status === 'fulfilled') setSignals(Array.isArray(s.value) ? s.value : [])
        if (c.status === 'fulfilled') setClients(Array.isArray(c.value) ? c.value : [])
      })
      .finally(()=> setLoading(false))
  }, [])

  const pending  = signals.filter(s => !s.endorsement)
  const reviewed = signals.filter(s => s.endorsement)

  const cards = [
    {label:'Pending Reviews',val: pending.length,  nav:'signals', cls: pending.length ? ' pending' : ''},
    {label:'Reviewed',val: reviewed.length, nav:'signals', cls: ' accent'},
    {label:'Active Clients',val: clients.length,  nav:'clients', cls: ''},
  ]

  return(
    <div>
      <div className="admin-page-header">
        <h1 className="admin-page-title">Dashboard</h1>
        <p className="admin-page-sub">
          {new Date().toLocaleDateString('en-SG', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}
        </p>
      </div>

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

function TraderDashboardPage() {
  const[tab,setTab]= useState('overview')
  const[showAccount,setShowAccount] = useState(false)
  const[editAccount,setEditAccount] = useState(false)

  const user= readUser()
  const traderStatus= user.trader_status || 'pending'
  const locked= user.role === 'trader' ? traderStatus !== 'approved' : !user.role

  useEffect(() => { document.title = 'Trader Dashboard — StockWise AI' }, [])

  if (locked){
    const rejected = traderStatus === 'rejected'
    return(
      <div className="trader-lock-wrap">
        <div className="trader-lock-card">
          <div className={`trader-lock-icon${rejected ? ' rejected' : ''}`}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <rect x="4" y="10" width="16" height="10" rx="2"
                stroke={rejected ? '#ff4444' : '#ffd600'} strokeWidth="1.6"/>
              <path d="M8 10V7a4 4 0 018 0v3"
                stroke={rejected ? '#ff4444' : '#ffd600'} strokeWidth="1.6" strokeLinecap="round"/>
            </svg>
          </div>
          <h1 className="trader-lock-title">
            {rejected ? 'Application Rejected' : 'Awaiting Admin Approval'}
          </h1>
          <p className="trader-lock-msg">
            {rejected
              ? 'Your trader application was not approved. Contact support if you believe this is a mistake.'
              : 'Your trader account is pending review. An administrator must verify your license number before you can access the trader portal.'}
          </p>
          <a href="/dashboard" className="btn-admin btn-ghost" style={{ textDecoration:'none' }}>
            ← Back to investor view
          </a>
        </div>
      </div>
    )
  }

  const initials= (user.name || 'T').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)

  return(
    <div className="trader-shell">

      {/* ── Sidebar ── */}
      <aside className="trader-sidenav">
        <div className="trader-brand">
          <Logo/>
          <div>
            <div className="trader-brand-name">StockWise <span>AI</span></div>
            <div className="trader-brand-sub">Trader Portal</div>
          </div>
        </div>

        <nav className="trader-nav">
          {NAV.map(item => (
            <button key={item.key}
              className={`trader-nav-item${tab === item.key ? ' active' : ''}`}
              onClick={() => setTab(item.key)}>
              <span className="trader-nav-icon"><Icon name={item.icon}/></span>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="trader-sidenav-footer">
          <a href="/dashboard" className="trader-back-link">← Back to investor view</a>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="trader-main">
        <header className="trader-topbar">
          <div className="trader-topbar-brand">
            <Logo size={18}/>
            <span className="trader-topbar-name">StockWise <span>AI</span></span>
            <span className="trader-role-pill">TRADER</span>
          </div>
          <button className="trader-avatar-btn" title="My Account"
            onClick={() => setShowAccount(true)}>
            <span className="trader-avatar-circle">{initials}</span>
            <span className="trader-avatar-name">{user.name || 'Trader'}</span>
          </button>
        </header>

        <div className="trader-breadcrumb">
          <span>Trader</span>
          <span className="trader-breadcrumb-sep">›</span>
          <span className="trader-breadcrumb-current">
            {NAV.find(n => n.key === tab)?.label}
          </span>
        </div>

        <div className="trader-content">
          {tab === 'overview' && <TraderOverview onNav={setTab}/>}
          {tab === 'signals' && <ViewSignalReviewsPage/>}
          {tab === 'clients' && <ViewClientsPage/>}
        </div>
      </div>

      {showAccount && !editAccount && (
        <ViewAccountModal
          onClose={() => setShowAccount(false)}
          onEdit={() => setEditAccount(true)}
        />
      )}
      {editAccount && (
        <UpdateAccountModal
          onClose={()=> setEditAccount(false)}
          onSaved={()=> { setEditAccount(false); setShowAccount(false) }}
        />
      )}
    </div>
  )
}

export default TraderDashboardPage

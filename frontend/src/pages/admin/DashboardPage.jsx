import {useEffect, useState} from 'react'
import {useSearchParams} from 'react-router-dom'
import adminApi, {requireAdmin} from '../../js/adminApi'
import api, {initAvatarDropdown, populateAvatar} from '../../js/api'
import ManageUserAccountsPage from './ManageUserAccountsPage'
import LandingPageEditorPage from './LandingPageEditorPage'
import ViewModelPerformancePage from './ViewModelPerformancePage'
import ManageAPIPage from './ManageAPIPage'
import ManageFeedbacksPage from './ManageFeedbacksPage'
import ViewAlertsPage from './ViewAlertsPage'
import ResetPasswordModal from './ResetPasswordModal'
import LogoutPage from './LogoutPage'
import '../../styles/shared.css'
import '../../styles/admin/adminShared.css'

const NAV =[
  {key:'overview',label:'Dashboard',icon:'grid'},
  {key:'users',label:'Manage Users',icon:'users'},
  {key:'landing',label:'Landing Page',icon:'monitor'},
  {key:'model',label:'Model Performance',icon:'chart'},
  {key:'apis',label:'API Sources',icon:'code'},
  {key:'feedback',label:'Feedback',icon:'chat'},
  {key:'alerts',label:'Alerts',icon:'bell'},
]

function Icon({name, size=15}){
  const p = {stroke:'currentColor', strokeWidth:'1.3', strokeLinecap:'round', strokeLinejoin:'round'}
  const icons={
    grid:<svg width={size} height={size} viewBox="0 0 16 16" fill="none">
			<rect x="2" y="2" width="5" height="5" rx="1" {...p}/>
			<rect x="9" y="2" width="5" height="5" rx="1" {...p}/>
			<rect x="2" y="9" width="5" height="5" rx="1" {...p}/>
			<rect x="9" y="9" width="5" height="5" rx="1" {...p}/>
		</svg>,
    users:<svg width={size} height={size} viewBox="0 0 16 16" fill="none">
			<circle cx="6" cy="5" r="3" {...p}/>
			<path d="M1 14c0-3.314 2.239-5 5-5s5 1.686 5 5" {...p}/>
			<path d="M11 7.5a2.5 2.5 0 100-5M13 13.5c0-2.5-1.5-4-3-4.5" {...p}/>
		 </svg>,
    monitor:<svg width={size} height={size} viewBox="0 0 16 16" fill="none">
				<rect x="1" y="2" width="14" height="9" rx="1.5" {...p}/>
				<path d="M5 14h6M8 11v3" {...p}/>
			</svg>,
    chart:<svg width={size} height={size} viewBox="0 0 16 16" fill="none">
			<path d="M2 11l3-5 3 3 2-4 4 6" {...p}/>
			<rect x="1" y="1" width="14" height="14" rx="2" {...p}/>
		</svg>,
    code:<svg width={size} height={size} viewBox="0 0 16 16" fill="none">
			<path d="M5 4L2 8l3 4M11 4l3 4-3 4" {...p}/>
			<path d="M9.5 2l-3 12" {...p}/>
		</svg>,
    chat:<svg width={size} height={size} viewBox="0 0 16 16" fill="none">
			<path d="M2 2h12a1 1 0 011 1v7a1 1 0 01-1 1H5l-3 3V3a1 1 0 011-1z" {...p}/>
		</svg>,
    bell:<svg width={size} height={size} viewBox="0 0 16 16" fill="none">
			<path d="M8 1.5a5.5 5.5 0 00-5.5 5.5v3l-1 1.5h13l-1-1.5V7A5.5 5.5 0 008 1.5z" {...p}/>
			<path d="M6.5 12.5a1.5 1.5 0 003 0" {...p}/>
		</svg>,
    reset:<svg width={size} height={size} viewBox="0 0 16 16" fill="none">
			<path d="M13.5 8A5.5 5.5 0 012.5 8M2.5 8V5M2.5 8H5.5M2.5 5a5.5 5.5 0 0111 0" {...p}/>
		</svg>,
  }
  return icons[name]||null
}

function DashboardPage(){
  const[searchParams, setSearchParams]=useSearchParams()
  const initial = NAV.find(n => n.key===searchParams.get('tab'))?.key || 'overview'
  const[activeTab,setActiveTab]= useState(initial)
  const[showReset,setShowReset]= useState(false)
  const[stats,setStats]= useState(null)
  const[alertCount,setAlertCount]= useState(0)
  const[authed,setAuthed]= useState(false)

  useEffect(()=>{
    document.title = 'Admin Dashboard — StockWise AI'
    if (!sessionStorage.getItem('sw_token')||sessionStorage.getItem('sw_role') !== 'admin') {
      window.location.replace('/admin/login')
      return
    }
    setAuthed(true)
    initAvatarDropdown()
    populateAvatar()
    adminApi.getDashboardStats()
      .then(s=>{setStats(s); setAlertCount(s?.open_alerts ?? 0)})
      .catch(()=>{})
  }, [])

  const goTab=(key)=>{setActiveTab(key); 
					  setSearchParams({tab: key}) 
					  }

  if (!sessionStorage.getItem('sw_token') || sessionStorage.getItem('sw_role') !== 'admin') 
	  return null
  if (!authed) 
	  return null

  const user= api.getUser()
  const initials= (user?.name || 'A').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)

  return(
    <div style={{display:'flex', minHeight:'100vh', background:'var(--bg)', fontFamily:'var(--font-sans)'}}>

      {/* ── LEFT SIDEBAR ── */}
      <aside style={{ width:'210px', flexShrink:0, position:'fixed', top:0, left:0, bottom:0,
        background:'var(--surface)', borderRight:'1px solid var(--border)',
        display:'flex', flexDirection:'column', zIndex:90, overflowY:'auto' }}>

        {/* Brand */}
        <div style={{display:'flex', alignItems:'center', gap:'0.6rem',
          padding:'1rem 1rem 0.85rem', borderBottom:'1px solid var(--border)'}}>
          <svg width="22" height="22" viewBox="0 0 28 28" fill="none">
            <rect width="28" height="28" rx="6" fill="#00ff41" fillOpacity="0.12"/>
            <polyline points="5,18 10,12 14,15 19,8 23,11" stroke="#00ff41" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="23" cy="11" r="2" fill="#00ff41"/>
          </svg>
          <div>
            <div style={{ fontSize:'0.88rem', fontWeight:700, color:'var(--text)', lineHeight:1.2 }}>
              StockWise <span style={{color:'var(--accent)'}}>AI</span>
            </div>
            <div style={{fontSize:'0.62rem', color:'var(--text-subtle)', marginTop:'1px'}}>Admin Portal</div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{flex:1, padding:'0.5rem 0'}}>
          {NAV.map(item=>{
            const active=activeTab===item.key
            return(
              <button key={item.key} onClick={() => goTab(item.key)} style={{
                display:'flex', alignItems:'center', gap:'0.6rem', width:'100%',
                padding:'0.5rem 1rem', border:'none',
                borderRight: active ? '2px solid var(--accent)' : '2px solid transparent',
                background: active ? 'rgba(0,255,65,0.07)' : 'transparent',
                color: active ? 'var(--accent)' : 'var(--text-muted)',
                fontSize:'0.81rem', fontWeight: active ? 600 : 500,
                cursor:'pointer', fontFamily:'var(--font-sans)', textAlign:'left',
                transition:'background 0.12s, color 0.12s',
              }}>
                <span style={{color: active ? 'var(--accent)' : 'var(--text-subtle)', display:'flex', flexShrink:0}}>
                  <Icon name={item.icon}/>
                </span>
                {item.label}
                {item.key === 'alerts' && alertCount > 0 && (
                  <span style={{ marginLeft:'auto', fontSize:'0.6rem', fontWeight:700,
                    background:'#ff4444', color:'#fff', borderRadius:'10px', padding:'0.08rem 0.38rem' }}>
                    {alertCount}
                  </span>
                )}
              </button>
            )
          })}
        </nav>

        {/* Bottom actions */}
        <div style={{borderTop:'1px solid var(--border)', padding:'0.5rem 0'}}>
          <button onClick={() => setShowReset(true)} style={{
            display:'flex', alignItems:'center', gap:'0.6rem', width:'100%',
            padding:'0.5rem 1rem', border:'none', background:'transparent',
            color:'var(--text-muted)', fontSize:'0.81rem', cursor:'pointer', fontFamily:'var(--font-sans)'}}>
            <span style={{color:'var(--text-subtle)', display:'flex'}}><Icon name="reset"/></span>
            Reset Password
          </button>
          <LogoutPage/>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <div style={{flex:1, marginLeft:'210px', display:'flex', flexDirection:'column', minHeight:'100vh'}}>

        {/* Topbar */}
        <header style={{display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'0.6rem 1.5rem', borderBottom:'1px solid var(--border)',
          background:'var(--surface)', position:'sticky', top:0, zIndex:50, gap:'1rem'}}>
          <div style={{display:'flex', alignItems:'center', gap:'0.6rem'}}>
            <svg width="18" height="18" viewBox="0 0 28 28" fill="none">
              <rect width="28" height="28" rx="6" fill="#00ff41" fillOpacity="0.12"/>
              <polyline points="5,18 10,12 14,15 19,8 23,11" stroke="#00ff41" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="23" cy="11" r="2" fill="#00ff41"/>
            </svg>
            <span style={{fontSize:'0.88rem', fontWeight:700, color:'var(--text)'}}>
              StockWise <span style={{ color:'var(--accent)' }}>AI</span>
            </span>
            <span style={{fontSize:'0.58rem', fontWeight:700, letterSpacing:'0.1em',
              background:'rgba(255,140,0,0.12)', color:'#ff8c00',
              border:'1px solid rgba(255,140,0,0.25)', borderRadius:'4px', padding:'0.1rem 0.38rem'}}>
              ADM
            </span>
          </div>

          <span style={{fontSize:'0.7rem', color:'var(--text-subtle)', letterSpacing:'0.04em'}}>
            ADMINISTRATOR PORTAL — RESTRICTED ACCESS
          </span>

          <div style={{display:'flex', alignItems:'center', gap:'0.6rem'}}>
            <button onClick={()=>goTab('alerts')} style={{position:'relative', background:'none',
              border:'none', cursor:'pointer', color:'var(--text-muted)', display:'flex', padding:'0.25rem'}}>
              <Icon name="bell" size={16}/>
              {alertCount > 0 && (
                <span style={{position:'absolute', top:'1px', right:'1px', width:'6px', height:'6px',
                  borderRadius:'50%', background:'#ff4444'}}/>
              )}
            </button>
            <div style={{width:'28px', height:'28px', borderRadius:'50%', background:'var(--accent)',
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:'0.68rem', fontWeight:700, color:'#000'}}>
              {initials}
            </div>
            <span style={{fontSize:'0.8rem', color:'var(--text)', fontWeight:600}}>
              {user?.name || 'Admin'}
            </span>
          </div>
        </header>

        {/* Breadcrumb */}
        <div style={{padding:'0.55rem 1.5rem', borderBottom:'1px solid var(--border)',
          background:'var(--surface)', fontSize:'0.76rem', color:'var(--text-muted)',
          display:'flex', alignItems:'center', gap:'0.4rem'}}>
          <span>Admin</span>
          <span style={{opacity:0.5}}>›</span>
          <span style={{color:'var(--text)', fontWeight:500}}>
            {NAV.find(n => n.key === activeTab)?.label || 'Dashboard'}
          </span>
        </div>

        {/* Content */}
        <div style={{ flex:1, padding:'1.75rem', maxWidth:'1200px', width:'100%' }}>
          {activeTab==='overview' && <OverviewPanel stats={stats} onNav={goTab}/>}
          {activeTab==='users' && <ManageUserAccountsPage/>}
          {activeTab==='landing' && <LandingPageEditorPage/>}
          {activeTab==='model' && <ViewModelPerformancePage/>}
          {activeTab==='apis' && <ManageAPIPage/>}
          {activeTab==='feedback' && <ManageFeedbacksPage/>}
          {activeTab==='alerts' && <ViewAlertsPage/>}
        </div>
      </div>

      {showReset && <ResetPasswordModal onClose={()=>setShowReset(false)}/>}
      <div id="toast-container"/>
    </div>
  )
}

function OverviewPanel({stats, onNav}){
  const s = stats || {}

  const cards=[
    {label:'Total Users', val: s.total_users ?? '—', nav:'users',color:''},
    {label:'Model Accuracy', val: s.model_accuracy != null ? s.model_accuracy.toFixed(1)+'%' : '—', nav:'model',color:'var(--accent)'},
    {label:'Pending Feedback', val: s.pending_feedback ?? '—', nav:'feedback', color:''},
    {label:'Open Alerts',val: s.open_alerts ?? '—', nav:'alerts',color: (s.open_alerts > 0) ? '#ff4444' : ''},
  ]

  const attention = []
  if (s.open_alerts > 0)      
	  attention.push({label:`${s.open_alerts} open alert${s.open_alerts!==1?'s':''}`, nav:'alerts',color:'#ff4444'})
  if (s.pending_feedback > 0) 
	  attention.push({ label:`${s.pending_feedback} feedback item${s.pending_feedback!==1?'s':''} awaiting review`, nav:'feedback', color:'#ffd600'})
  if (s.suspended_users > 0)  
	  attention.push({ label:`${s.suspended_users} suspended user${s.suspended_users!==1?'s':''}`,   nav:'users',    color:'#ff8c00'})

  return(
    <div>
      <div style={{marginBottom:'1.75rem'}}>
        <h1 style={{fontSize:'1.3rem', fontWeight:700, color:'var(--text)', margin:'0 0 0.25rem', letterSpacing:'-0.02em'}}>
          Dashboard
        </h1>
        <p style={{ fontSize:'0.82rem', color:'var(--text-muted)', margin:0 }}>
          {new Date().toLocaleDateString('en-SG', {weekday:'long', year:'numeric', month:'long', day:'numeric'})}
        </p>
      </div>

      {/* Needs attention — only renders if there's something to flag */}
      {attention.length > 0 && (
        <div style={{marginBottom:'1.75rem'}}>
          <div style={{fontSize:'0.7rem', fontWeight:600, letterSpacing:'0.07em', textTransform:'uppercase', color:'var(--text-muted)', marginBottom:'0.6rem'}}>
            Needs Attention
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem' }}>
            {attention.map(a => (
              <button key={a.label} onClick={() => onNav(a.nav)} style={{
                display:'flex', alignItems:'center', gap:'0.6rem', width:'100%',
                textAlign:'left', padding:'0.7rem 1rem', cursor:'pointer',
                border:'1px solid var(--border)', background:'var(--surface)',
                borderRadius:'8px', fontFamily:'var(--font-sans)', fontSize:'0.85rem', color:'var(--text)',
              }}>
                <span style={{ width:'7px', height:'7px', borderRadius:'50%', background:a.color, flexShrink:0 }}/>
                {a.label}
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ marginLeft:'auto', color:'var(--text-subtle)' }}>
                  <path d="M4.5 2.5L8 6l-3.5 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Core stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(165px,1fr))', gap:'1rem' }}>
        {cards.map(c => (
          <div key={c.label} onClick={() => onNav(c.nav)}
            style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'10px',
              padding:'1.1rem 1.25rem', cursor:'pointer', transition:'border-color 0.15s' }}
            onMouseEnter={e=> e.currentTarget.style.borderColor='rgba(255,255,255,0.15)'}
            onMouseLeave={e=> e.currentTarget.style.borderColor=''}>
            <div style={{fontSize:'0.68rem', fontWeight:600, letterSpacing:'0.07em', textTransform:'uppercase', color:'var(--text-muted)', marginBottom:'0.45rem'}}>{c.label}</div>
            <div style={{fontSize:'1.75rem', fontWeight:800, fontFamily:'var(--font-mono)', letterSpacing:'-0.03em', lineHeight:1, color: c.color || 'var(--text)'}}>{c.val}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default DashboardPage

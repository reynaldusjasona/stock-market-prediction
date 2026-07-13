import {adminLogout} from '../../js/adminUi'
import '../../styles/admin/adminShared.css'

function LogoutPage(){
  const handleLogout=()=>{
    adminLogout().finally(()=>window.location.replace('/admin/login'))
  }

  return(
    <button
      onClick={handleLogout}
      style={{display:'flex', alignItems:'center', gap:'0.6rem', width:'100%',
        padding:'0.5rem 1rem', border:'none', background:'transparent',
        color:'var(--text-muted)', fontSize:'0.81rem', cursor:'pointer',
        fontFamily:'var(--font-sans)', textAlign:'left'}}
      onMouseEnter={e=>{e.currentTarget.style.color = '#ff4444'}}
      onMouseLeave={e=>{ e.currentTarget.style.color = 'var(--text-muted)'}}
    >
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
        <path d="M10 2h2a2 2 0 012 2v8a2 2 0 01-2 2h-2" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
        <path d="M7 11l-3-3 3-3M4 8h8" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      Log Out
    </button>
  )
}

export default LogoutPage

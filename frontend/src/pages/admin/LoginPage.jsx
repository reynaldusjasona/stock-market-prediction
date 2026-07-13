import { useEffect, useState } from 'react'
import { api } from '../../api/api'

function LoginPage(){
  const[step,setStep]= useState('credentials')
  const[modal,setModal]= useState(null)

  // Credentials
  const[email,setEmail]= useState('')
  const[password,setPassword]= useState('')
  const[showPass,setShowPass]= useState(false)
  const[credAlert,setCredAlert]= useState({ msg:'', type:'' })
  const[credLoad,setCredLoad]= useState(false)

  const[pin,setPin]= useState(['','','','','',''])
  const[twoFaAlert,setTwoFaAlert]= useState({ msg:'', type:'' })
  const[twoFaLoad,setTwoFaLoad]= useState(false)
  const[resendLoad,setResendLoad]= useState(false)
  const[resendCool,setResendCool]= useState(0)

  const[fpEmail,setFpEmail]= useState('')
  const[fpAlert,setFpAlert]= useState({ msg:'', type:'' })
  const[fpLoad,setFpLoad]= useState(false)

  useEffect(()=>{
    document.title= 'Admin Login — StockWise AI'
    // TODO: unify token storage with AuthContext (localStorage vs sessionStorage)
    const token= sessionStorage.getItem('sw_token')
    const role= sessionStorage.getItem('sw_role')
    if (token && role === 'admin') {
      window.location.replace('/admin')
    }
  }, [])

  useEffect(()=>{
    if (resendCool <= 0) 
		return
    const t=setTimeout(()=>setResendCool(c => c - 1),1000)
    return ()=>clearTimeout(t)
  }, [resendCool])

  const handleCredentials= async(e)=>{
    e.preventDefault()
    setCredAlert({msg:'', type:''})
    if (!email.trim()){ 
		setCredAlert({msg:'Please enter your email address.', type:'error'}); 
		return 
	}
    if (!password.trim()){ 
		setCredAlert({ msg:'Please enter your password.',type:'error'}); 
		return 
	}
    setCredLoad(true)
    try{
      const data= await api.post('/auth/login', {email: email.trim(), password})

      if (data?.user?.role !== 'admin'){
        setCredAlert({msg:'Access denied. Administrator accounts only.', type:'error'})
        setCredLoad(false)
        return
      }

      // TODO: unify token storage with AuthContext (localStorage vs sessionStorage)
      sessionStorage.setItem('sw_token_pending', data.token)
      sessionStorage.setItem('sw_user_pending', JSON.stringify(data.user))

      await api.post('/auth/send-2fa', {email: email.trim()})

      setCredLoad(false)
      setStep('2fa')
    }
	catch (err){
      setCredAlert({msg: err.message || 'Login failed. Please check your credentials.', type:'error'})
      setCredLoad(false)
    }
  }

  const handleVerify2fa= async(e)=>{
    e.preventDefault()
    setTwoFaAlert({msg:'', type:''})
    const code = pin.join('')
    if (code.length < 6){ 
		setTwoFaAlert({msg:'Please enter the full 6-digit PIN.', type:'error'}); 
		return 
	}
    setTwoFaLoad(true)
    try{
      await api.post('/auth/verify-2fa', {email: email.trim(), otp_code: code})

      const token= sessionStorage.getItem('sw_token_pending')
      const user= JSON.parse(sessionStorage.getItem('sw_user_pending') || '{}')
      sessionStorage.removeItem('sw_token_pending')
      sessionStorage.removeItem('sw_user_pending')
      // TODO: unify token storage with AuthContext (localStorage vs sessionStorage)
      sessionStorage.setItem('sw_token',token)
      sessionStorage.setItem('sw_role',user.role)
      sessionStorage.setItem('sw_user',JSON.stringify(user))
      sessionStorage.setItem('sw_uid',user.id)

      window.location.replace('/admin')
    } 
	catch (err){
      setTwoFaAlert({msg: err.message || 'Invalid or expired PIN. Please try again.', type:'error'})
      setPin(['','','','','',''])
      document.getElementById('pin-0')?.focus()
    } finally { setTwoFaLoad(false) }
  }

  const handleResend= async()=>{
    setResendLoad(true)
    try{
      await api.post('/auth/send-2fa', {email: email.trim()})
      setTwoFaAlert({msg:'A new PIN has been sent to your email.', type:'success'})
      setResendCool(30)
    } 
	catch (err){
      setTwoFaAlert({msg: err.message || 'Failed to resend PIN.', type:'error'})
    } 
	finally{ 
	  setResendLoad(false) 
	}
  }

  const handlePinChange=(i, val)=>{
    const v= val.replace(/\D/,'').slice(-1)
    const next= [...pin]; next[i] = v; setPin(next)
    if (v && i < 5) 
		document.getElementById(`pin-${i+1}`)?.focus()
  }

  const handlePinKeyDown = (i, e)=>{
    if (e.key==='Backspace' && !pin[i] && i > 0) 
		document.getElementById(`pin-${i-1}`)?.focus()
    if (e.key==='ArrowLeft'  && i > 0) 
		document.getElementById(`pin-${i-1}`)?.focus()
    if (e.key==='ArrowRight' && i < 5) 
		document.getElementById(`pin-${i+1}`)?.focus()
  }

  const handlePinPaste=(e)=>{
    const text= e.clipboardData.getData('text').replace(/\D/g,'').slice(0,6)
    if (!text) 
		return
    e.preventDefault()
    const next= ['','','','','','']
    text.split('').forEach((c, i)=> { next[i] = c })
    setPin(next)
    document.getElementById(`pin-${Math.min(text.length, 5)}`)?.focus()
  }

  const handleForgotPassword= async(e)=>{
    e.preventDefault()
    setFpAlert({msg:'', type:''})
    if (!fpEmail.trim()){ 
		setFpAlert({msg:'Please enter your email address.', type:'error'}); 
		return 
	}
    setFpLoad(true)
    try{
      await api.post('/auth/reset-password', {email: fpEmail.trim()})
      setFpAlert({msg:`Reset link sent to ${fpEmail}. Check your inbox.`, type:'success'})
      setFpEmail('')
    } 
	catch (err){
      setFpAlert({msg: err.message || 'Failed to send reset link.', type:'error'})
    } 
	finally{ 
	  setFpLoad(false) 
	}
  }

  const closeForgot=()=>{setModal(null); setFpAlert({msg:'', type:''}); setFpEmail('')}

  return(
    <div style={S.page}>
      {/* Top bar */}
      <div style={S.topbar}>
        <div style={S.topbarBrand}>
          <svg width="22" height="22" viewBox="0 0 28 28" fill="none">
            <rect width="28" height="28" rx="6" fill="#00ff41" fillOpacity="0.15"/>
            <polyline points="5,18 10,12 14,15 19,8 23,11" stroke="#00ff41" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="23" cy="11" r="2" fill="#00ff41"/>
          </svg>
          <span style={S.topbarName}>StockWise <em style={{ color:'var(--accent)' }}>AI</em></span>
          <span style={S.adminPill}>ADMIN</span>
        </div>
        <span style={S.topbarRight}>ADMINISTRATOR PORTAL — RESTRICTED ACCESS</span>
      </div>

      {/* Card */}
      <div style={S.center}>
        <div style={S.card}>
          <div style={S.iconWrap}>
            {step === '2fa' ? (
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <rect width="28" height="28" rx="6" fill="#00ff41" fillOpacity="0.12"/>
                <path d="M9 13V10a5 5 0 0110 0v3" stroke="#00ff41" strokeWidth="1.5" strokeLinecap="round"/>
                <rect x="6" y="13" width="16" height="10" rx="2" stroke="#00ff41" strokeWidth="1.5"/>
                <circle cx="14" cy="18" r="1.5" fill="#00ff41"/>
              </svg>
            ) : (
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <path d="M14 2L4 6v8c0 6 6 10 10 12C18 24 24 20 24 14V6L14 2z" stroke="#00ff41" strokeWidth="1.5" strokeLinejoin="round"/>
                <path d="M10 14l3 3 5-6" stroke="#00ff41" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </div>

          {/* ── STEP 1: Credentials ── */}
          {step === 'credentials' && (
            <>
              <h1 style={S.title}>Administrator Login</h1>
              <p style={S.sub}>Restricted to authorized administrators only</p>

              <div style={S.warnBanner}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink:0, marginTop:'1px' }}>
                  <path d="M7 1.5L13 12H1L7 1.5z" stroke="#ff8c00" strokeWidth="1.2" strokeLinejoin="round"/>
                  <path d="M7 5.5v3M7 10v.5" stroke="#ff8c00" strokeWidth="1.2" strokeLinecap="round"/>
                </svg>
                <span>Unauthorized access is strictly prohibited and subject to criminal prosecution.</span>
              </div>

              {credAlert.msg && <div className={`al-alert al-alert--${credAlert.type}`}>{credAlert.msg}</div>}

              <form onSubmit={handleCredentials} style={S.form} noValidate>
                <div style={S.fieldGroup}>
                  <label style={S.label} htmlFor="alEmail">ADMIN EMAIL</label>
                  <input id="alEmail" type="email" style={S.input}
                    placeholder="admin@stockwise.ai"
                    value={email} onChange={e => setEmail(e.target.value)}
                    autoComplete="email" required/>
                </div>

                <div style={S.fieldGroup}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'0.4rem' }}>
                    <label style={S.label} htmlFor="alPass">PASSWORD</label>
                    <button type="button" onClick={() => setModal('forgot')}
                      style={{ background:'none', border:'none', color:'var(--accent)', fontSize:'0.75rem', cursor:'pointer', padding:0, fontFamily:'inherit', textDecoration:'underline' }}>
                      Forgot password?
                    </button>
                  </div>
                  <div style={{ position:'relative' }}>
                    <input id="alPass" type={showPass ? 'text' : 'password'}
                      style={{ ...S.input, paddingRight:'2.5rem' }}
                      placeholder="••••••••••••"
                      value={password} onChange={e => setPassword(e.target.value)}
                      autoComplete="current-password" required/>
                    <button type="button" onClick={() => setShowPass(v => !v)}
                      style={{ position:'absolute', right:'0.75rem', top:'50%', transform:'translateY(-50%)',
                        background:'none', border:'none', cursor:'pointer', color:'var(--text-subtle)', padding:0, display:'flex' }}>
                      <svg width="17" height="17" viewBox="0 0 17 17" fill="none">
                        <path d="M1 8.5C1 8.5 3.5 3 8.5 3S16 8.5 16 8.5 13.5 14 8.5 14 1 8.5 1 8.5z" stroke="currentColor" strokeWidth="1.25"/>
                        <circle cx="8.5" cy="8.5" r="2.5" stroke="currentColor" strokeWidth="1.25"/>
                        {!showPass && <line x1="2" y1="2" x2="15" y2="15" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>}
                      </svg>
                    </button>
                  </div>
                </div>

                <button type="submit" style={{ ...S.submitBtn, opacity: credLoad ? 0.6 : 1 }} disabled={credLoad}>
                  {credLoad
                    ? <><span className="spinner" style={{ width:'16px', height:'16px', borderWidth:'2px', borderTopColor:'#000' }}/> Verifying…</>
                    : 'LOG IN TO ADMIN PORTAL'
                  }
                </button>
              </form>
              <div style={S.sessionInfo}><span>🔒 ENCRYPTED TLS 1.3 SESSION</span></div>
            </>
          )}

          {/* ── STEP 2: 2FA PIN ── */}
          {step === '2fa' && (
            <>
              <h1 style={S.title}>Two-Factor Authentication</h1>
              <p style={S.sub}>
                A 6-digit PIN has been sent to<br/>
                <strong style={{ color:'var(--text)' }}>{email}</strong>
              </p>

              {twoFaAlert.msg && <div className={`al-alert al-alert--${twoFaAlert.type}`} style={{ marginBottom:'1.25rem' }}>{twoFaAlert.msg}</div>}

              <form onSubmit={handleVerify2fa} style={S.form} noValidate>
                <div style={{ display:'flex', gap:'0.5rem', justifyContent:'center', marginBottom:'1.5rem' }}>
                  {pin.map((val, i) => (
                    <input key={i} id={`pin-${i}`}
                      type="text" inputMode="numeric" maxLength={1}
                      value={val}
                      onChange={e => handlePinChange(i, e.target.value)}
                      onKeyDown={e => handlePinKeyDown(i, e)}
                      onPaste={i === 0 ? handlePinPaste : undefined}
                      style={{
                        width:'44px', height:'52px', textAlign:'center',
                        fontSize:'1.4rem', fontWeight:700, fontFamily:'var(--font-mono)',
                        background:'var(--bg)', border:`2px solid ${val ? 'var(--accent)' : 'var(--border)'}`,
                        borderRadius:'8px', color:'var(--text)', outline:'none', transition:'border-color 0.15s',
                      }}
                    />
                  ))}
                </div>
                <button type="submit"
                  style={{ ...S.submitBtn, opacity: (twoFaLoad || pin.join('').length < 6) ? 0.6 : 1 }}
                  disabled={twoFaLoad || pin.join('').length < 6}>
                  {twoFaLoad
                    ? <><span className="spinner" style={{ width:'16px', height:'16px', borderWidth:'2px', borderTopColor:'#000' }}/> Verifying…</>
                    : 'VERIFY & SIGN IN'
                  }
                </button>
              </form>

              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:'1.25rem' }}>
                <button type="button"
                  onClick={() => { setStep('credentials'); setPin(['','','','','','']); setTwoFaAlert({ msg:'', type:'' }) }}
                  style={{ background:'none', border:'none', color:'var(--text-subtle)', fontSize:'0.78rem', cursor:'pointer', fontFamily:'inherit' }}>
                  ← Back
                </button>
                <button type="button" onClick={handleResend}
                  disabled={resendLoad || resendCool > 0}
                  style={{ background:'none', border:'none',
                    color: resendCool > 0 ? 'var(--text-subtle)' : 'var(--accent)',
                    fontSize:'0.78rem', cursor: resendCool > 0 ? 'not-allowed' : 'pointer', fontFamily:'inherit' }}>
                  {resendLoad ? 'Sending…' : resendCool > 0 ? `Resend in ${resendCool}s` : 'Resend PIN'}
                </button>
              </div>
              <div style={{ ...S.sessionInfo, marginTop:'1rem' }}>
                <span>PIN expires in 10 minutes</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer style={S.footer}>
        <span>© 2026 StockWise AI.</span>
        <div style={{ display:'flex', gap:'1.5rem' }}>
          <a href="#" style={S.footerLink}>Privacy Policy</a>
          <a href="#" style={S.footerLink}>Terms of Service</a>
          <a href="#" style={S.footerLink}>SEC Disclosures</a>
        </div>
      </footer>

      {/* ── Forgot Password Modal ── */}
      {modal === 'forgot' && (
        <div style={S.overlay} onClick={e => e.target===e.currentTarget && closeForgot()}>
          <div style={S.modalBox}>
            <div style={S.modalHeader}>
              <span style={{ fontWeight:700, fontSize:'0.98rem', color:'var(--text)' }}>Reset Password</span>
              <button onClick={closeForgot}
                style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', display:'flex', padding:0 }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
            <form onSubmit={handleForgotPassword} style={{ padding:'1.5rem' }}>
              <p style={{ margin:'0 0 1.25rem', fontSize:'0.875rem', color:'var(--text-muted)', lineHeight:1.6 }}>
                Enter your administrator email address and we'll send you a link to reset your password.
              </p>
              {fpAlert.msg && <div className={`al-alert al-alert--${fpAlert.type}`}>{fpAlert.msg}</div>}
              <div style={S.fieldGroup}>
                <label style={S.label} htmlFor="fpEmail">ADMIN EMAIL</label>
                <input id="fpEmail" type="email" style={S.input}
                  placeholder="admin@stockwise.ai"
                  value={fpEmail} onChange={e => setFpEmail(e.target.value)} required/>
              </div>
              <div style={{ display:'flex', gap:'0.75rem', justifyContent:'flex-end', marginTop:'0.5rem' }}>
                <button type="button" onClick={closeForgot} style={S.ghostBtn} disabled={fpLoad}>Cancel</button>
                <button type="submit"
                  style={{ ...S.submitBtn, width:'auto', padding:'0.55rem 1.25rem', marginTop:0 }}
                  disabled={fpLoad}>
                  {fpLoad
                    ? <><span className="spinner" style={{ width:'14px', height:'14px', borderWidth:'2px', borderTopColor:'#000' }}/> Sending…</>
                    : 'Send Reset Link'
                  }
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        .al-alert{display:flex;align-items:flex-start;gap:0.5rem;padding:0.7rem 0.9rem;border-radius:8px;font-size:0.8rem;line-height:1.5;margin-bottom:1rem;}
        .al-alert--error{background:rgba(255,68,68,0.1);border:1px solid rgba(255,68,68,0.3);color:#ff6b6b;}
        .al-alert--success{background:rgba(0,255,65,0.08);border:1px solid rgba(0,255,65,0.25);color:#00e838;}
        input[type="text"]:focus,input[type="email"]:focus,input[type="password"]:focus{outline:none;border-color:var(--accent)!important;}
      `}</style>
    </div>
  )
}

const S = {
  page:{ minHeight:'100vh', background:'var(--bg)', display:'flex', flexDirection:'column', fontFamily:'var(--font-sans)' },
  topbar:{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0.75rem 2rem', borderBottom:'1px solid var(--border)', background:'var(--surface)' },
  topbarBrand:{ display:'flex', alignItems:'center', gap:'0.6rem' },
  topbarName:{ fontSize:'1rem', fontWeight:700, color:'var(--text)' },
  adminPill:{ fontSize:'0.6rem', fontWeight:700, letterSpacing:'0.1em', background:'rgba(255,140,0,0.15)', color:'#ff8c00', border:'1px solid rgba(255,140,0,0.3)', borderRadius:'4px', padding:'0.15rem 0.45rem' },
  topbarRight:{ fontSize:'0.72rem', color:'var(--text-subtle)', letterSpacing:'0.05em' },
  center:{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', padding:'2rem' },
  card:{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'14px', padding:'2.5rem 2rem', width:'100%', maxWidth:'400px', boxShadow:'0 8px 32px rgba(0,0,0,0.4)' },
  iconWrap:{ width:'52px', height:'52px', borderRadius:'14px', background:'rgba(0,255,65,0.08)', border:'1px solid rgba(0,255,65,0.2)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 1.25rem' },
  title:{ fontSize:'1.35rem', fontWeight:700, color:'var(--text)', textAlign:'center', margin:'0 0 0.35rem' },
  sub:{ fontSize:'0.82rem', color:'var(--text-muted)', textAlign:'center', margin:'0 0 1.5rem', lineHeight:1.6 },
  warnBanner:{ display:'flex', alignItems:'flex-start', gap:'0.5rem', background:'rgba(255,140,0,0.07)', border:'1px solid rgba(255,140,0,0.2)', borderRadius:'8px', padding:'0.65rem 0.85rem', fontSize:'0.75rem', color:'#ff8c00', lineHeight:1.5, marginBottom:'1.5rem' },
  form:{ display:'flex', flexDirection:'column' },
  fieldGroup:{ marginBottom:'1.1rem' },
  label:{ display:'block', fontSize:'0.68rem', fontWeight:700, letterSpacing:'0.08em', color:'var(--text-muted)', marginBottom:'0.4rem', textTransform:'uppercase' },
  input:{ width:'100%', padding:'0.6rem 0.85rem', background:'var(--bg)', border:'1px solid var(--border)', borderRadius:'8px', color:'var(--text)', fontSize:'0.875rem', fontFamily:'var(--font-sans)', boxSizing:'border-box', transition:'border-color 0.15s' },
  submitBtn:{ width:'100%', padding:'0.7rem 1rem', marginTop:'0.5rem', background:'var(--accent)', color:'#000', border:'none', borderRadius:'8px', fontSize:'0.82rem', fontWeight:700, letterSpacing:'0.06em', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:'0.5rem', transition:'opacity 0.15s', fontFamily:'var(--font-sans)' },
  ghostBtn:{ padding:'0.55rem 1rem', background:'transparent', border:'1px solid var(--border)', borderRadius:'8px', color:'var(--text-muted)', fontSize:'0.8rem', fontWeight:600, cursor:'pointer', fontFamily:'var(--font-sans)' },
  sessionInfo:{ marginTop:'1.5rem', paddingTop:'1rem', borderTop:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.65rem', color:'var(--text-subtle)', letterSpacing:'0.04em' },
  footer:{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'1rem 2rem', borderTop:'1px solid var(--border)', fontSize:'0.75rem', color:'var(--text-subtle)' },
  footerLink:{ color:'var(--text-subtle)', textDecoration:'none' },
  overlay:{ position:'fixed', inset:0, background:'rgba(0,0,0,0.65)', backdropFilter:'blur(4px)', zIndex:300, display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem' },
  modalBox:{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'14px', width:'100%', maxWidth:'440px', boxShadow:'0 24px 64px rgba(0,0,0,0.5)' },
  modalHeader:{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'1.2rem 1.5rem', borderBottom:'1px solid var(--border)' },
}

export default LoginPage

import { useEffect } from 'react'
import '../styles/shared.css'
import '../styles/login.css'

export default function Login() {
  useEffect(() => {
    document.title = 'Sign In — StockWise AI'

    redirectIfLoggedIn('/dashboard');

    const form       = document.getElementById('loginForm');
    const emailEl    = document.getElementById('email');
    const passEl     = document.getElementById('password');
    const alertBox   = document.getElementById('alertBox');
    const submitBtn  = document.getElementById('submitBtn');
    const submitLbl  = document.getElementById('submitLabel');
    const submitSpn  = document.getElementById('submitSpinner');
    const togglePwd  = document.getElementById('togglePwd');

    /* Show/hide password */
    togglePwd.addEventListener('click', () => {
      const isHidden = passEl.type === 'password';
      passEl.type = isHidden ? 'text' : 'password';
      document.getElementById('eyeIcon').style.opacity = isHidden ? '0.5' : '1';
    });

    function showAlert(msg, type = 'error') {
      alertBox.textContent = '';
      alertBox.className = `auth-alert ${type}`;
      const icon = type === 'error'
        ? '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" style="flex-shrink:0"><circle cx="8" cy="8" r="6.5" stroke="#ff4444" stroke-width="1.25"/><path d="M8 5v3.5M8 10.5v.5" stroke="#ff4444" stroke-width="1.5" stroke-linecap="round"/></svg>'
        : '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" style="flex-shrink:0"><circle cx="8" cy="8" r="6.5" stroke="#00ff41" stroke-width="1.25"/><path d="M5 8l2 2 4-4" stroke="#00ff41" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      alertBox.innerHTML = `${icon}<span>${escHtml(msg)}</span>`;
    }
    function hideAlert() { alertBox.className = 'auth-alert'; alertBox.innerHTML = ''; }

    function setLoading(on) {
      submitBtn.disabled  = on;
      submitLbl.style.display  = on ? 'none' : '';
      submitSpn.style.display  = on ? 'inline-block' : 'none';
    }

    form.addEventListener('submit', async e => {
      e.preventDefault();
      hideAlert();

      const email    = emailEl.value.trim();
      const password = passEl.value;

      if (!email)    { showAlert('Please enter your email address.'); emailEl.focus(); return; }
      if (!password) { showAlert('Please enter your password.'); passEl.focus(); return; }

      setLoading(true);
      try {
        await api.login(email, password);
        showAlert('Login successful! Redirecting…', 'success');
        setTimeout(() => { window.location.href = '/dashboard'; }, 800);
      } catch (err) {
        showAlert(err.message || 'Login failed. Please check your credentials.');
        setLoading(false);
      }
    });

    initHoverSidebar();
    initAvatarDropdown();
    populateAvatar();
  }, [])

  return (
    <>
      {/* Sidebar */}
      <div className="sidebar-overlay" id="sidebarOverlay" onClick={() => closeSidebar()}></div>
      <aside className="sidebar" id="sidebar" aria-label="Navigation sidebar">
        <div className="sidebar-header">
          <a href="/" className="sidebar-logo">
            <svg width="24" height="24" viewBox="0 0 28 28" fill="none" aria-hidden="true">
              <rect width="28" height="28" rx="6" fill="#00ff41" fillOpacity="0.12"/>
              <polyline points="5,18 10,12 14,15 19,8 23,11" stroke="#00ff41" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="23" cy="11" r="2" fill="#00ff41"/>
            </svg>
            StockWise <em>AI</em>
          </a>
          <button className="sidebar-close" onClick={() => closeSidebar()} aria-label="Close sidebar">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </button>
        </div>
        <div className="sidebar-body">
          <nav className="sidebar-nav-top">
            <a href="/dashboard" className="sidebar-link">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><rect x="2" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.25"/><rect x="9" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.25"/><rect x="2" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.25"/><rect x="9" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.25"/></svg>
              Dashboard
            </a>
            <a href="/alerts" className="sidebar-link">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M8 1.5a5.5 5.5 0 00-5.5 5.5v3l-1 1.5h13l-1-1.5V7A5.5 5.5 0 008 1.5z" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round"/><path d="M6.5 12.5a1.5 1.5 0 003 0" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/></svg>
              Alerts
            </a>
            <a href="/settings" className="sidebar-link">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.25"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M2.93 2.93l1.41 1.41M11.66 11.66l1.41 1.41M2.93 13.07l1.41-1.41M11.66 4.34l1.41-1.41" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/></svg>
              Settings
            </a>
          </nav>
          <nav className="sidebar-nav-bottom">
            <div className="sidebar-divider"></div>
            <a href="/help" className="sidebar-link">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.25"/><path d="M8 11v.5M8 5a2 2 0 010 4" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/></svg>
              Help
            </a>
            <button className="sidebar-link danger" onClick={() => api.logout()} style={{background:'none',border:'none',width:'100%',textAlign:'left',cursor:'pointer',fontFamily:'inherit'}}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M10 2h2a2 2 0 012 2v8a2 2 0 01-2 2h-2" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/><path d="M7 11l-3-3 3-3M4 8h8" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Log Out
            </button>
          </nav>
        </div>
      </aside>

      {/* Minimal nav bar for login */}
      <nav className="navbar" aria-label="Top navigation" style={{position:'fixed'}}>
        <div className="navbar-inner">
          <a href="/" className="logo-btn" aria-label="Go to homepage">
            <svg width="26" height="26" viewBox="0 0 28 28" fill="none" aria-hidden="true">
              <rect width="28" height="28" rx="6" fill="#00ff41" fillOpacity="0.12"/>
              <polyline points="5,18 10,12 14,15 19,8 23,11" stroke="#00ff41" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="23" cy="11" r="2" fill="#00ff41"/>
            </svg>
            StockWise <em>AI</em>
          </a>
          <div className="navbar-actions">
            <div className="guest-only" style={{display:'flex',gap:'0.5rem',alignItems:'center'}}>
              <a href="/" className="btn btn-ghost btn-sm">← Back</a>
              <a href="/register" className="btn btn-accent btn-sm">Create Account</a>
            </div>
            <div className="nav-avatar-wrap" id="avatarWrap" style={{display:'none'}}>
              <button className="nav-avatar-btn" id="avatarBtn" aria-expanded="false" aria-haspopup="true">
                <span className="nav-avatar" id="navAvatar">?</span>
                <span id="navAvatarName">Account</span>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
              <div className="nav-dropdown" id="navDropdown" role="menu">
                <div className="nav-dropdown-user">
                  <span id="ddName">—</span>
                  <span id="ddEmail" className="muted">—</span>
                </div>
                <div className="nav-dropdown-divider"></div>
                <a href="/account" className="nav-dropdown-item" role="menuitem">
                  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true"><circle cx="7.5" cy="5" r="3" stroke="currentColor" strokeWidth="1.2"/><path d="M2 13c0-3.038 2.462-5.5 5.5-5.5S13 9.962 13 13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
                  My Account
                </a>
                <div className="nav-dropdown-divider"></div>
                <button className="nav-dropdown-item danger" role="menuitem" onClick={() => api.logout()}>
                  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true"><path d="M9.5 2h2a1.5 1.5 0 011.5 1.5v8A1.5 1.5 0 0111.5 13h-2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/><path d="M6.5 10.5L4 8l2.5-2.5M4 8h7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  Log Out
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <div className="page-top" style={{flex:'1',display:'flex'}}>
        <div className="auth-page">

          {/* Brand panel */}
          <div className="auth-brand" aria-hidden="true">
            <div className="brand-top">
              <a href="/" className="brand-logo">
                <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                  <rect width="28" height="28" rx="6" fill="#00ff41" fillOpacity="0.12"/>
                  <polyline points="5,18 10,12 14,15 19,8 23,11" stroke="#00ff41" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <circle cx="23" cy="11" r="2" fill="#00ff41"/>
                </svg>
                StockWise <em>AI</em>
              </a>
            </div>
            <div className="brand-center">
              <h2 className="brand-headline">Make smarter<br/><span className="hi">investment</span><br/>decisions</h2>
              <p className="brand-subline">AI-powered predictions, real-time market data, and personalised insights to help you invest with confidence.</p>
              <div className="brand-features">
                <div className="brand-feat"><span className="brand-feat-dot"></span>AI price predictions with 78% accuracy</div>
                <div className="brand-feat"><span className="brand-feat-dot"></span>Live market data &amp; technical indicators</div>
                <div className="brand-feat"><span className="brand-feat-dot"></span>Personalised to your risk profile</div>
                <div className="brand-feat"><span className="brand-feat-dot"></span>Interactive charts &amp; order book depth</div>
              </div>
            </div>
            <div className="brand-bottom">
              FYP-26-S2-26 · University of Wollongong SIM Singapore
            </div>
          </div>

          {/* Form panel */}
          <div className="auth-form-panel">
            <div className="auth-form-box">
              <div className="auth-form-header">
                <h1 className="auth-form-title">Welcome back</h1>
                <p className="auth-form-sub">
                  Don't have an account? <a href="/register">Create one for free</a>
                </p>
              </div>

              <div className="auth-alert" id="alertBox" role="alert" aria-live="polite"></div>

              <form className="auth-form" id="loginForm" noValidate>
                <div className="form-group">
                  <label htmlFor="email" className="form-label">Email address</label>
                  <input type="email" id="email" name="email" className="form-input"
                         placeholder="you@example.com" autoComplete="email" required/>
                </div>

                <div className="form-group">
                  <label htmlFor="password" className="form-label">Password</label>
                  <div className="input-wrap">
                    <input type="password" id="password" name="password" className="form-input"
                           placeholder="••••••••" autoComplete="current-password" required/>
                    <button type="button" className="input-suffix" id="togglePwd" aria-label="Toggle password visibility">
                      <svg id="eyeIcon" width="17" height="17" viewBox="0 0 17 17" fill="none">
                        <path d="M1 8.5C1 8.5 3.5 3 8.5 3S16 8.5 16 8.5 13.5 14 8.5 14 1 8.5 1 8.5z" stroke="currentColor" strokeWidth="1.25"/>
                        <circle cx="8.5" cy="8.5" r="2.5" stroke="currentColor" strokeWidth="1.25"/>
                      </svg>
                    </button>
                  </div>
                  <a href="#" className="forgot-link">Forgot password?</a>
                </div>

                <button type="submit" className="btn btn-accent btn-full" id="submitBtn">
                  <span id="submitLabel">Sign In</span>
                  <span id="submitSpinner" className="spinner" style={{display:'none',width:'16px',height:'16px',borderWidth:'2px'}}></span>
                </button>
              </form>

              <div className="auth-footer-note">
                By signing in, you agree to our
                <a href="#"> Terms of Service</a> and <a href="#">Privacy Policy</a>.
              </div>
            </div>
          </div>

        </div>
      </div>

      <div id="toast-container"></div>
    </>
  )
}

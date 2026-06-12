import { useEffect } from 'react'
import '../styles/shared.css'
import '../styles/register.css'

export default function Register() {
  useEffect(() => {
    document.title = 'Create Account — StockWise AI'

    redirectIfLoggedIn('/dashboard');

    const SECTORS = [
      'Technology','Finance','Healthcare','Energy',
      'Consumer','Real Estate','Industrials','Materials',
      'Utilities','Communication','Transportation','Biotech'
    ];

    let currentStep = 1;

    /* Build sector grid */
    const grid = document.getElementById('sectorGrid');
    grid.innerHTML = SECTORS.map((s, i) => `
      <div class="sector-item">
        <input type="checkbox" id="sec-${i}" value="${s}" onchange="updateCount()"/>
        <label for="sec-${i}" class="sector-label">
          <span class="sector-check">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5 4-4" stroke="#000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </span>
          ${s}
        </label>
      </div>`).join('');

    function updateCount() {
      const n = document.querySelectorAll('#sectorGrid input:checked').length;
      document.getElementById('sectorCount').textContent = `${n} selected`;
      document.getElementById('selectAllBtn').textContent = n === SECTORS.length ? 'Deselect all' : 'Select all';
    }

    window.toggleSelectAll = function() {
      const boxes = document.querySelectorAll('#sectorGrid input[type="checkbox"]');
      const allChecked = [...boxes].every(b => b.checked);
      boxes.forEach(b => b.checked = !allChecked);
      updateCount();
    };

    function showAlert(msg) {
      const a = document.getElementById('alertBox');
      a.innerHTML = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" style="flex-shrink:0"><circle cx="8" cy="8" r="6.5" stroke="#ff4444" stroke-width="1.25"/><path d="M8 5v3.5M8 10.5v.5" stroke="#ff4444" stroke-width="1.5" stroke-linecap="round"/></svg><span>${escHtml(msg)}</span>`;
      a.className = 'auth-alert error';
    }
    function hideAlert() {
      const a = document.getElementById('alertBox');
      a.className = 'auth-alert';
      a.innerHTML = '';
    }

    function goToStep(n) {
      hideAlert();
      const old = currentStep;
      currentStep = n;

      document.getElementById(`panel-${old}`).classList.remove('active');
      document.getElementById(`panel-${n}`).classList.add('active');

      [1,2,3].forEach(i => {
        const ind = document.getElementById(`step-ind-${i}`);
        ind.classList.remove('active','done');
        if (i < n) ind.classList.add('done');
        if (i === n) ind.classList.add('active');
      });
      [1,2].forEach(i => {
        const line = document.getElementById(`line-${i}`);
        line.classList.toggle('done', i < n);
      });

      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    window.goToStep = goToStep;

    window.goStep2 = function() {
      const name  = document.getElementById('name').value.trim();
      const email = document.getElementById('email').value.trim();
      const pass  = document.getElementById('password').value;
      const conf  = document.getElementById('confirm').value;

      if (!name)  { showAlert('Please enter your full name.'); return; }
      if (!email) { showAlert('Please enter your email address.'); return; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showAlert('Please enter a valid email address.'); return; }
      if (pass.length < 8) { showAlert('Password must be at least 8 characters.'); return; }
      if (pass !== conf)   { showAlert('Passwords do not match.'); return; }

      goToStep(2);
    };

    window.goStep3 = function() {
      const selected = document.querySelector('input[name="accountRole"]:checked');
      if (!selected) { showAlert('Please choose an account type to continue.'); return; }
      goToStep(3);
    };

    window.submitForm = async function() {
      hideAlert();
      const name     = document.getElementById('name').value.trim();
      const email    = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value;
      const role     = document.querySelector('input[name="accountRole"]:checked')?.value || 'investor';
      const sectors  = [...document.querySelectorAll('#sectorGrid input:checked')].map(b => b.value);
      const level    = document.querySelector('input[name="riskLevel"]:checked')?.value || 'moderate';

      const btn  = document.getElementById('submitBtn');
      const lbl  = document.getElementById('submitLabel');
      const spn  = document.getElementById('submitSpinner');
      btn.disabled = true;
      lbl.style.display = 'none';
      spn.style.display = 'inline-block';

      try {
        await api.register(name, email, password, sectors, level);
        showToast('Account created! Signing you in…', 'success');
        await api.login(email, password);
        localStorage.setItem('sw_role', role);
        window.location.href = '/dashboard';
      } catch (err) {
        showAlert(err.message || 'Registration failed. Please try again.');
        btn.disabled = false;
        lbl.style.display = '';
        spn.style.display = 'none';
      }
    };

    window.togglePass = function(inputId, iconId) {
      const inp = document.getElementById(inputId);
      inp.type = inp.type === 'password' ? 'text' : 'password';
      document.getElementById(iconId).style.opacity = inp.type === 'text' ? '0.5' : '1';
    };

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
            <a href="alerts.html" className="sidebar-link">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M8 1.5a5.5 5.5 0 00-5.5 5.5v3l-1 1.5h13l-1-1.5V7A5.5 5.5 0 008 1.5z" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round"/><path d="M6.5 12.5a1.5 1.5 0 003 0" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/></svg>
              Alerts
            </a>
            <a href="settings.html" className="sidebar-link">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.25"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M2.93 2.93l1.41 1.41M11.66 11.66l1.41 1.41M2.93 13.07l1.41-1.41M11.66 4.34l1.41-1.41" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/></svg>
              Settings
            </a>
          </nav>
          <nav className="sidebar-nav-bottom">
            <div className="sidebar-divider"></div>
            <a href="help.html" className="sidebar-link">
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

      <nav className="navbar" aria-label="Top navigation">
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
              <a href="/login" className="btn btn-ghost btn-sm">Sign In</a>
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
                <a href="account.html" className="nav-dropdown-item" role="menuitem">
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

      <div className="page-top reg-page">
        <div className="reg-box">

          {/* Step indicator */}
          <div className="steps" role="list" aria-label="Registration steps">
            <div className="step active" id="step-ind-1" role="listitem">
              <div className="step-circle" aria-label="Step 1: Account">1</div>
              <span className="step-label">Account</span>
            </div>
            <div className="step-line" id="line-1"></div>
            <div className="step" id="step-ind-2" role="listitem">
              <div className="step-circle" aria-label="Step 2: Account type">2</div>
              <span className="step-label">Role</span>
            </div>
            <div className="step-line" id="line-2"></div>
            <div className="step" id="step-ind-3" role="listitem">
              <div className="step-circle" aria-label="Step 3: Investment DNA">3</div>
              <span className="step-label">DNA</span>
            </div>
          </div>

          <div className="auth-alert" id="alertBox" role="alert" aria-live="polite"></div>

          {/* STEP 1: Account Info */}
          <div className="step-panel active" id="panel-1" aria-label="Step 1: Account information">
            <div className="step-heading">
              <h2>Create your account</h2>
              <p>Enter your details to get started with StockWise AI.</p>
            </div>

            <div className="form-group">
              <label htmlFor="name" className="form-label">Full name</label>
              <input type="text" id="name" className="form-input" placeholder="Full Name" autoComplete="name" required/>
            </div>

            <div className="form-group">
              <label htmlFor="email" className="form-label">Email address</label>
              <input type="email" id="email" className="form-input" placeholder="you@example.com" autoComplete="email" required/>
            </div>

            <div className="form-group">
              <label htmlFor="password" className="form-label">Password</label>
              <div className="input-wrap">
                <input type="password" id="password" className="form-input" placeholder="Minimum 8 characters" autoComplete="new-password" required/>
                <button type="button" className="input-suffix" onClick={() => window.togglePass('password','eye1')} aria-label="Toggle password">
                  <svg id="eye1" width="17" height="17" viewBox="0 0 17 17" fill="none"><path d="M1 8.5C1 8.5 3.5 3 8.5 3S16 8.5 16 8.5 13.5 14 8.5 14 1 8.5 1 8.5z" stroke="currentColor" strokeWidth="1.25"/><circle cx="8.5" cy="8.5" r="2.5" stroke="currentColor" strokeWidth="1.25"/></svg>
                </button>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="confirm" className="form-label">Confirm password</label>
              <div className="input-wrap">
                <input type="password" id="confirm" className="form-input" placeholder="Repeat your password" autoComplete="new-password" required/>
                <button type="button" className="input-suffix" onClick={() => window.togglePass('confirm','eye2')} aria-label="Toggle password">
                  <svg id="eye2" width="17" height="17" viewBox="0 0 17 17" fill="none"><path d="M1 8.5C1 8.5 3.5 3 8.5 3S16 8.5 16 8.5 13.5 14 8.5 14 1 8.5 1 8.5z" stroke="currentColor" strokeWidth="1.25"/><circle cx="8.5" cy="8.5" r="2.5" stroke="currentColor" strokeWidth="1.25"/></svg>
                </button>
              </div>
            </div>

            <div className="step-nav">
              <div></div>
              <button className="btn btn-accent btn-lg" onClick={() => window.goStep2()}>
                Continue
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
            </div>

            <p className="sign-in-link">Already have an account? <a href="/login">Sign in</a></p>
          </div>

          {/* STEP 2: Account Type */}
          <div className="step-panel" id="panel-2" aria-label="Step 2: Choose your account type">
            <div className="step-heading">
              <h2>Choose your account type</h2>
              <p>Select the experience that matches your investment style.</p>
            </div>

            <div className="role-grid" role="radiogroup" aria-label="Account type">

              {/* Investor card */}
              <div className="role-item">
                <input type="radio" name="accountRole" id="role-investor" value="investor"/>
                <label htmlFor="role-investor" className="role-card">
                  <div className="role-card-top">
                    <div className="role-card-icon">
                      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
                        <rect x="2" y="10" width="18" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
                        <path d="M6 10V7a5 5 0 0110 0v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                        <circle cx="11" cy="15" r="1.5" fill="currentColor"/>
                      </svg>
                    </div>
                    <div className="role-card-check">
                      <svg width="9" height="9" viewBox="0 0 9 9" fill="none"><path d="M1.5 4.5l2 2 4-4" stroke="#000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </div>
                  </div>
                  <div className="role-card-title">Investor</div>
                  <div className="role-card-desc">Focused on long-term growth, portfolio diversification, and AI-driven insights for wealth preservation.</div>
                  <div className="role-card-features">
                    <span className="role-feature">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l2.5 2.5 5.5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      Fundamental analysis
                    </span>
                    <span className="role-feature">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l2.5 2.5 5.5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      News &amp; sentiment
                    </span>
                    <span className="role-feature">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l2.5 2.5 5.5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      AI predictions
                    </span>
                  </div>
                </label>
              </div>

              {/* Trader card */}
              <div className="role-item">
                <input type="radio" name="accountRole" id="role-trader" value="trader"/>
                <label htmlFor="role-trader" className="role-card">
                  <div className="role-card-top">
                    <div className="role-card-icon">
                      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
                        <path d="M13 2L5 13h6l-2 7 8-11h-6l2-7z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                    <div className="role-card-check">
                      <svg width="9" height="9" viewBox="0 0 9 9" fill="none"><path d="M1.5 4.5l2 2 4-4" stroke="#000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </div>
                  </div>
                  <div className="role-card-title">Trader</div>
                  <div className="role-card-desc">Designed for high-frequency market participants requiring real-time data, technical signals, and execution speed.</div>
                  <div className="role-card-features">
                    <span className="role-feature">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l2.5 2.5 5.5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      Advanced indicators (MACD, BB)
                    </span>
                    <span className="role-feature">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l2.5 2.5 5.5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      Customisable chart overlays
                    </span>
                    <span className="role-feature">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l2.5 2.5 5.5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      Short-term signals
                    </span>
                  </div>
                </label>
              </div>

            </div>

            <div className="step-nav">
              <button className="btn btn-ghost btn-lg" onClick={() => window.goToStep(1)}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M13 8H3M7 4L3 8l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                Back
              </button>
              <button className="btn btn-accent btn-lg" onClick={() => window.goStep3()}>
                Continue
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
            </div>
          </div>

          {/* STEP 3: Investment DNA */}
          <div className="step-panel" id="panel-3" aria-label="Step 3: Investment DNA">
            <div className="step-heading">
              <h2>Investment DNA</h2>
              <p>Personalise your experience by selecting your interests and risk profile.</p>
            </div>

            {/* Sectors */}
            <div className="dna-section">
              <div className="dna-label">Sectors of interest</div>
              <div>
                <div className="select-all-row">
                  <span className="sector-hint" id="sectorCount">0 selected</span>
                  <button className="select-all-btn" id="selectAllBtn" onClick={() => window.toggleSelectAll()}>Select all</button>
                </div>
                <div className="sector-grid" id="sectorGrid">
                  {/* Generated by JS */}
                </div>
              </div>
            </div>

            {/* Risk tolerance */}
            <div className="dna-section">
              <div className="dna-label">Risk tolerance</div>
              <div className="risk-options" role="radiogroup" aria-label="Risk tolerance">
                <div className="risk-item">
                  <input type="radio" name="riskLevel" id="risk-low" value="low"/>
                  <label htmlFor="risk-low" className="risk-label">
                    <div className="risk-icon">🛡️</div>
                    <div className="risk-text">
                      <h4>Conservative</h4>
                      <p>Capital preservation first. Stable, blue-chip stocks with steady dividends.</p>
                    </div>
                  </label>
                </div>
                <div className="risk-item">
                  <input type="radio" name="riskLevel" id="risk-moderate" value="moderate" defaultChecked/>
                  <label htmlFor="risk-moderate" className="risk-label">
                    <div className="risk-icon">⚖️</div>
                    <div className="risk-text">
                      <h4>Balanced</h4>
                      <p>Mix of growth and income. Comfortable with moderate short-term volatility.</p>
                    </div>
                  </label>
                </div>
                <div className="risk-item">
                  <input type="radio" name="riskLevel" id="risk-high" value="high"/>
                  <label htmlFor="risk-high" className="risk-label">
                    <div className="risk-icon">🚀</div>
                    <div className="risk-text">
                      <h4>Aggressive</h4>
                      <p>Maximum growth potential. High volatility tolerance for high-reward opportunities.</p>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            <div className="step-nav">
              <button className="btn btn-ghost btn-lg" onClick={() => window.goToStep(2)}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M13 8H3M7 4L3 8l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                Back
              </button>
              <button className="btn btn-accent btn-lg" id="submitBtn" onClick={() => window.submitForm()}>
                <span id="submitLabel">Create Account</span>
                <span id="submitSpinner" className="spinner" style={{display:'none',width:'16px',height:'16px',borderWidth:'2px'}}></span>
              </button>
            </div>
          </div>

        </div>
      </div>

      <div id="toast-container"></div>
    </>
  )
}

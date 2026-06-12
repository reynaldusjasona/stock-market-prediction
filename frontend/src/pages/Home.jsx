import { useEffect } from 'react'
import '../styles/shared.css'
import '../styles/home.css'

export default function Home() {
  useEffect(() => {
    document.title = 'StockWise AI — AI-Powered Stock Predictions'

    /* Update sidebar for logged-in users */
    if (api.isLoggedIn()) {
      const loginLink = document.getElementById('sbLoginLink');
      const regLink   = document.getElementById('sbRegLink');
      if (loginLink) { loginLink.innerHTML = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="2" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.25"/><rect x="9" y="2" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.25"/><rect x="2" y="9" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.25"/><rect x="9" y="9" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.25"/></svg>Dashboard`; loginLink.href='/dashboard'; }
      if (regLink) regLink.style.display = 'none';
    }

    /* Load trending stocks */
    async function loadTrending() {
      const grid = document.getElementById('trendingGrid');
      try {
        const data = await api.getTrending();
        const stocks = Array.isArray(data) ? data : (data.tickers || data.trending || []);
        if (!stocks.length) { grid.innerHTML = '<p style="color:var(--text-muted);grid-column:1/-1;padding:2rem 0;">No trending data available.</p>'; return; }
        grid.innerHTML = stocks.slice(0, 8).map(s => {
          const ticker   = escHtml(s.ticker || s.symbol || s);
          const name     = escHtml(s.name || s.company_name || '');
          const price    = s.price ? `$${fmt(s.price)}` : '—';
          const chg      = s.change_pct != null ? s.change_pct : (s.change_percent || null);
          const { text: chgTxt, cls: chgCls } = fmtChange(chg);
          return `
            <a href="/stock?ticker=${ticker}" class="stock-card">
              <div class="stock-card-top">
                <div>
                  <div class="stock-ticker">${ticker}</div>
                  <div class="stock-sector">${name}</div>
                </div>
                <span class="badge ${chgCls}">${chgTxt}</span>
              </div>
              <div class="stock-price">${price}</div>
            </a>`;
        }).join('');
      } catch (e) {
        grid.innerHTML = `<p style="color:var(--text-muted);grid-column:1/-1;padding:2rem 0;">Could not load trending stocks. <a href="#" onclick="loadTrending();return false;" style="color:var(--accent)">Retry</a></p>`;
      }
    }
    loadTrending();

    /* Navbar search */
    const navInput = document.getElementById('navSearchInput');
    const navDrop  = document.getElementById('navSearchDropdown');

    navInput.addEventListener('input', debounce(async () => {
      const q = navInput.value.trim();
      if (!q) { navDrop.classList.remove('open'); return; }
      navDrop.innerHTML = '<div class="search-empty"><span class="spinner"></span></div>';
      navDrop.classList.add('open');
      try {
        const results = await api.searchStocks(q);
        const items = Array.isArray(results) ? results : (results.results || []);
        if (!items.length) { navDrop.innerHTML = '<div class="search-empty">No results found</div>'; return; }
        navDrop.innerHTML = items.slice(0,6).map(s => {
          const t = escHtml(s.ticker || s.symbol || '');
          const n = escHtml(s.name || s.company_name || '');
          return `<div class="search-item" onclick="window.location='/stock?ticker=${t}'"><div class="search-item-left"><span class="search-ticker">${t}</span><span class="search-name">${n}</span></div></div>`;
        }).join('');
      } catch { navDrop.innerHTML = '<div class="search-empty">Search unavailable</div>'; }
    }));

    document.addEventListener('click', e => {
      if (!document.getElementById('navSearch').contains(e.target)) navDrop.classList.remove('open');
    });

    /* Hero search */
    const heroInput = document.getElementById('heroSearchInput');
    const heroDrop  = document.getElementById('heroDropdown');

    heroInput.addEventListener('input', debounce(async () => {
      const q = heroInput.value.trim();
      if (!q) { heroDrop.classList.remove('open'); return; }
      heroDrop.innerHTML = '<div class="search-empty"><span class="spinner"></span></div>';
      heroDrop.classList.add('open');
      try {
        const results = await api.searchStocks(q);
        const items = Array.isArray(results) ? results : (results.results || []);
        if (!items.length) { heroDrop.innerHTML = '<div class="search-empty">No results found</div>'; return; }
        heroDrop.innerHTML = items.slice(0,6).map(s => {
          const t = escHtml(s.ticker || s.symbol || '');
          const n = escHtml(s.name || s.company_name || '');
          return `<div class="search-item" onclick="window.location='/stock?ticker=${t}'"><div class="search-item-left"><span class="search-ticker">${t}</span><span class="search-name">${n}</span></div></div>`;
        }).join('');
      } catch { heroDrop.innerHTML = '<div class="search-empty">Search unavailable</div>'; }
    }));

    window.doHeroSearch = function() {
      const q = heroInput.value.trim();
      if (q) window.location.href = `/stock?ticker=${encodeURIComponent(q.toUpperCase())}`;
    };
    heroInput.addEventListener('keydown', e => { if (e.key === 'Enter') window.doHeroSearch(); });

    document.addEventListener('click', e => {
      if (!heroInput.closest('.hero-search')?.contains(e.target)) heroDrop.classList.remove('open');
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

      {/* Navbar */}
      <header>
        <nav className="navbar" aria-label="Main navigation">
          <div className="navbar-inner">
            <a href="/" className="logo-btn" aria-label="StockWise AI — home">
              <svg width="26" height="26" viewBox="0 0 28 28" fill="none" aria-hidden="true">
                <rect width="28" height="28" rx="6" fill="#00ff41" fillOpacity="0.12"/>
                <polyline points="5,18 10,12 14,15 19,8 23,11" stroke="#00ff41" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="23" cy="11" r="2" fill="#00ff41"/>
              </svg>
              StockWise <em>AI</em>
            </a>

            <div className="navbar-center">
              <div className="search-wrap" id="navSearch">
                <svg className="search-icon" width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
                  <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.25"/>
                  <path d="M10 10l3 3" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
                </svg>
                <input type="text" placeholder="Search stocks (e.g. AAPL, Tesla…)" id="navSearchInput" autoComplete="off"/>
                <div className="search-dropdown" id="navSearchDropdown"></div>
              </div>
            </div>

            <div className="navbar-actions">
              <a href="/login" className="btn btn-ghost btn-sm hide-mobile guest-only">Sign In</a>
              <a href="/register" className="btn btn-accent btn-sm guest-only">Get Started</a>
              <div className="nav-avatar-wrap" id="avatarWrap" style={{display:'none'}}>
                <button className="nav-avatar-btn" id="avatarBtn" aria-label="Account menu" aria-expanded="false">
                  <div className="nav-avatar" id="navAvatar">?</div>
                  <span className="nav-avatar-name" id="navAvatarName">Account</span>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>
                <div className="nav-dropdown" id="navDropdown" role="menu">
                  <div className="nav-dropdown-user">
                    <div className="nav-dropdown-name" id="ddName">—</div>
                    <div className="nav-dropdown-email" id="ddEmail">—</div>
                  </div>
                  <div className="nav-dropdown-divider"></div>
                  <a href="account.html" className="nav-dropdown-item" role="menuitem">
                    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true"><circle cx="7.5" cy="5" r="3" stroke="currentColor" strokeWidth="1.2"/><path d="M2 13.5c0-3.038 2.462-5.5 5.5-5.5s5.5 2.462 5.5 5.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
                    My Account
                  </a>
                  <div className="nav-dropdown-divider"></div>
                  <button className="nav-dropdown-item danger" onClick={() => api.logout()} role="menuitem">
                    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true"><path d="M9.5 2H12a1.5 1.5 0 011.5 1.5v8A1.5 1.5 0 0112 13H9.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/><path d="M6 10l-3-2.5L6 5M3 7.5h8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    Log Out
                  </button>
                </div>
              </div>
            </div>
          </div>
        </nav>
      </header>

      <main className="page-top">

        {/* Ticker tape */}
        <div className="ticker-wrap" id="tickerWrap" aria-hidden="true">
          <div className="ticker-track" id="tickerTrack">
            <div className="ticker-item"><span className="t-sym">AAPL</span><span className="t-up">▲ 189.42 (+1.23%)</span></div>
            <div className="ticker-item"><span className="t-sym">MSFT</span><span className="t-up">▲ 412.08 (+0.87%)</span></div>
            <div className="ticker-item"><span className="t-sym">NVDA</span><span className="t-up">▲ 875.53 (+2.14%)</span></div>
            <div className="ticker-item"><span className="t-sym">TSLA</span><span className="t-dn">▼ 248.11 (-1.05%)</span></div>
            <div className="ticker-item"><span className="t-sym">AMZN</span><span className="t-up">▲ 186.92 (+0.63%)</span></div>
            <div className="ticker-item"><span className="t-sym">GOOGL</span><span className="t-up">▲ 172.34 (+0.45%)</span></div>
            <div className="ticker-item"><span className="t-sym">META</span><span className="t-dn">▼ 502.87 (-0.38%)</span></div>
            <div className="ticker-item"><span className="t-sym">JPM</span><span className="t-up">▲ 203.15 (+0.91%)</span></div>
            <div className="ticker-item"><span className="t-sym">NFLX</span><span className="t-up">▲ 635.20 (+1.67%)</span></div>
            <div className="ticker-item"><span className="t-sym">AMD</span><span className="t-up">▲ 162.88 (+1.42%)</span></div>
            {/* duplicate for loop */}
            <div className="ticker-item"><span className="t-sym">AAPL</span><span className="t-up">▲ 189.42 (+1.23%)</span></div>
            <div className="ticker-item"><span className="t-sym">MSFT</span><span className="t-up">▲ 412.08 (+0.87%)</span></div>
            <div className="ticker-item"><span className="t-sym">NVDA</span><span className="t-up">▲ 875.53 (+2.14%)</span></div>
            <div className="ticker-item"><span className="t-sym">TSLA</span><span className="t-dn">▼ 248.11 (-1.05%)</span></div>
            <div className="ticker-item"><span className="t-sym">AMZN</span><span className="t-up">▲ 186.92 (+0.63%)</span></div>
            <div className="ticker-item"><span className="t-sym">GOOGL</span><span className="t-up">▲ 172.34 (+0.45%)</span></div>
            <div className="ticker-item"><span className="t-sym">META</span><span className="t-dn">▼ 502.87 (-0.38%)</span></div>
            <div className="ticker-item"><span className="t-sym">JPM</span><span className="t-up">▲ 203.15 (+0.91%)</span></div>
            <div className="ticker-item"><span className="t-sym">NFLX</span><span className="t-up">▲ 635.20 (+1.67%)</span></div>
            <div className="ticker-item"><span className="t-sym">AMD</span><span className="t-up">▲ 162.88 (+1.42%)</span></div>
          </div>
        </div>

        {/* Hero */}
        <section className="hero" aria-labelledby="heroTitle">
          <div className="container hero-inner">

            <div className="hero-content">
              <div className="hero-badge">
                <span className="badge-dot" aria-hidden="true"></span>
                Live AI Predictions
              </div>
              <h1 className="hero-title" id="heroTitle">
                Predict Tomorrow's<br/>
                Markets <span className="hi">Today</span>
              </h1>
              <p className="hero-tagline">
                Real-time stock data, machine learning forecasts, and personalised investment insights — all in one platform built for smarter decisions.
              </p>

              <div className="hero-search">
                <svg className="hero-search-icon" width="17" height="17" viewBox="0 0 17 17" fill="none" aria-hidden="true">
                  <circle cx="7" cy="7" r="5.25" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M11 11l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                <input type="text" id="heroSearchInput" placeholder="Search a stock — AAPL, TSLA, NVDA…" autoComplete="off"/>
                <button className="btn btn-accent btn-sm hero-search-btn" onClick={() => window.doHeroSearch()}>Go</button>
                <div className="search-dropdown" id="heroDropdown"></div>
              </div>

              <div className="hero-actions" style={{marginTop:'1.5rem'}}>
                <a href="/register" className="btn btn-accent btn-lg">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M8 1v14M1 8h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                  Start for Free
                </a>
                <a href="/login" className="btn btn-ghost btn-lg">Sign In →</a>
              </div>

              <div className="hero-stats">
                <div className="hero-stat">
                  <div className="stat-value">78%</div>
                  <div className="stat-label">Prediction Accuracy</div>
                </div>
                <div className="hero-stat">
                  <div className="stat-value">500+</div>
                  <div className="stat-label">Stocks Tracked</div>
                </div>
                <div className="hero-stat">
                  <div className="stat-value">Live</div>
                  <div className="stat-label">Market Data</div>
                </div>
              </div>
            </div>

            {/* Visual preview card */}
            <div className="hero-visual" aria-hidden="true">
              <div className="preview-card">
                <div className="preview-card-top">
                  <div>
                    <div className="preview-ticker">NVDA</div>
                    <div className="preview-company">NVIDIA Corporation</div>
                  </div>
                  <div style={{textAlign:'right'}}>
                    <div className="preview-price">$875.53</div>
                    <div className="preview-change">▲ +18.32 (+2.14%)</div>
                  </div>
                </div>
                <svg className="sparkline" viewBox="0 0 320 88" preserveAspectRatio="none" role="img" aria-label="NVDA price trend">
                  <defs>
                    <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#00ff41" stopOpacity="0.28"/>
                      <stop offset="100%" stopColor="#00ff41" stopOpacity="0"/>
                    </linearGradient>
                  </defs>
                  <path d="M0,72 L25,65 L50,68 L75,55 L100,50 L125,42 L150,45 L175,33 L200,28 L225,20 L250,22 L275,12 L300,8 L320,6 L320,88 L0,88 Z" fill="url(#sg)"/>
                  <polyline points="0,72 25,65 50,68 75,55 100,50 125,42 150,45 175,33 200,28 225,20 250,22 275,12 300,8 320,6" fill="none" stroke="#00ff41" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <polyline points="320,6 340,2 360,0" fill="none" stroke="#00ff41" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.5"/>
                </svg>
                <div className="ai-badge">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.4"/><path d="M5 7l1.5 1.5L9 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  AI Signal: BUY · 82% confidence
                </div>
              </div>
              <div className="float-card float-card-1">
                <div className="fc-lbl">RSI (14)</div>
                <div className="fc-val fc-green">68.4 — Bullish</div>
              </div>
              <div className="float-card float-card-2">
                <div className="fc-lbl">Volume 24h</div>
                <div className="fc-val fc-muted">42.1M</div>
              </div>
            </div>

          </div>
        </section>

        {/* Trending stocks */}
        <section className="section" style={{paddingTop:'3rem'}} aria-labelledby="trendingTitle">
          <div className="container">
            <div className="section-top">
              <div>
                <span className="section-label">Markets</span>
                <h2 className="section-title" id="trendingTitle">Trending Stocks</h2>
              </div>
              <a href="/dashboard" className="btn btn-ghost btn-sm">View all →</a>
            </div>
            <div className="stocks-grid" id="trendingGrid">
              {/* skeletons */}
              <div className="stock-card stocks-grid-skeleton"><div className="skeleton" style={{height:'100px',borderRadius:'8px'}}></div></div>
              <div className="stock-card stocks-grid-skeleton"><div className="skeleton" style={{height:'100px',borderRadius:'8px'}}></div></div>
              <div className="stock-card stocks-grid-skeleton"><div className="skeleton" style={{height:'100px',borderRadius:'8px'}}></div></div>
              <div className="stock-card stocks-grid-skeleton"><div className="skeleton" style={{height:'100px',borderRadius:'8px'}}></div></div>
              <div className="stock-card stocks-grid-skeleton"><div className="skeleton" style={{height:'100px',borderRadius:'8px'}}></div></div>
              <div className="stock-card stocks-grid-skeleton"><div className="skeleton" style={{height:'100px',borderRadius:'8px'}}></div></div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="section features-bg" aria-labelledby="featTitle">
          <div className="container">
            <div className="features-header">
              <span className="section-label" style={{justifyContent:'center'}}>Platform</span>
              <h2 id="featTitle">Everything you need to trade smarter</h2>
              <p>From live prices to AI-powered predictions — StockWise AI gives you the edge.</p>
            </div>
            <div className="features-grid">
              <div className="feat-card">
                <div className="feat-icon">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M10 2l3 6H4l3-6" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/><path d="M4 8l-1 8h14l-1-8" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/><circle cx="10" cy="12" r="2" stroke="currentColor" strokeWidth="1.5"/></svg>
                </div>
                <div className="feat-title">AI Price Prediction</div>
                <div className="feat-desc">XGBoost &amp; ensemble ML models trained on historical data to forecast short-term price movements with confidence scores.</div>
              </div>
              <div className="feat-card">
                <div className="feat-icon">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><polyline points="2,14 6,9 10,11 14,5 18,7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
                <div className="feat-title">Interactive Charts</div>
                <div className="feat-desc">Visualise price history and AI-predicted paths with period selectors — 1W, 1M, 3M, 1Y — overlaid with technical indicators.</div>
              </div>
              <div className="feat-card">
                <div className="feat-icon">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M3 10h14M3 5h9M3 15h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><circle cx="16" cy="14" r="3" stroke="currentColor" strokeWidth="1.5"/></svg>
                </div>
                <div className="feat-title">Technical Indicators</div>
                <div className="feat-desc">Full suite: RSI, MACD, Bollinger Bands, SMA, EMA — surfaced clearly on each stock detail page.</div>
              </div>
              <div className="feat-card">
                <div className="feat-icon">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="2" y="4" width="7" height="3" rx="1" stroke="currentColor" strokeWidth="1.5"/><rect x="11" y="4" width="7" height="3" rx="1" stroke="currentColor" strokeWidth="1.5"/><rect x="2" y="9" width="5" height="3" rx="1" stroke="currentColor" strokeWidth="1.5"/><rect x="13" y="9" width="5" height="3" rx="1" stroke="currentColor" strokeWidth="1.5"/></svg>
                </div>
                <div className="feat-title">Order Book Depth</div>
                <div className="feat-desc">Visualise bid/ask pressure zones and understand market microstructure to time your entries and exits.</div>
              </div>
              <div className="feat-card">
                <div className="feat-icon">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="8" r="4" stroke="currentColor" strokeWidth="1.5"/><path d="M3 18c0-3.866 3.134-7 7-7s7 3.134 7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                </div>
                <div className="feat-title">Personalised for You</div>
                <div className="feat-desc">Set your sector preferences and risk tolerance. Get recommendations tailored to your investment profile.</div>
              </div>
              <div className="feat-card">
                <div className="feat-icon">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="2" fill="currentColor"/><path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.93 4.93l1.41 1.41M13.66 13.66l1.41 1.41M4.93 15.07l1.41-1.41M13.66 6.34l1.41-1.41" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                </div>
                <div className="feat-title">Real-Time Data</div>
                <div className="feat-desc">Live market feeds for prices, volume, bid/ask spreads refreshed in real time for always-accurate analysis.</div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="section cta-section" aria-labelledby="ctaTitle">
          <div className="container">
            <span className="section-label" style={{justifyContent:'center'}}>Get Started</span>
            <h2 id="ctaTitle">Ready to trade with an edge?</h2>
            <p>Create a free account and start getting AI-powered stock predictions in under 2 minutes.</p>
            <div className="cta-actions">
              <a href="/register" className="btn btn-accent btn-lg">Create Free Account</a>
              <a href="/login" className="btn btn-ghost btn-lg">Already have an account?</a>
            </div>
          </div>
        </section>

      </main>

      <footer className="footer" role="contentinfo">
        <div className="container footer-inner">
          <div className="footer-logo">
            <svg width="20" height="20" viewBox="0 0 28 28" fill="none" aria-hidden="true">
              <rect width="28" height="28" rx="6" fill="#00ff41" fillOpacity="0.12"/>
              <polyline points="5,18 10,12 14,15 19,8 23,11" stroke="#00ff41" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="23" cy="11" r="2" fill="#00ff41"/>
            </svg>
            StockWise <em>AI</em>
          </div>
          <div className="footer-links">
            <a href="/login">Sign In</a>
            <a href="/register">Register</a>
            <a href="/dashboard">Dashboard</a>
          </div>
          <p className="footer-copy">FYP-26-S2-26 · University of Wollongong SIM Singapore</p>
        </div>
      </footer>

      <div id="toast-container"></div>
    </>
  )
}

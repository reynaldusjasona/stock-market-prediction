import { useEffect } from 'react'
import '../styles/shared.css'
import '../styles/dashboard.css'

export default function Dashboard() {
  useEffect(() => {
    document.title = 'Dashboard — StockWise AI'

    if (!requireAuth()) return;

    /* ================================================================
       AVATAR COLOURS — consistent per ticker
    ================================================================ */
    const AVT_COLORS = ['#2563eb','#7c3aed','#0891b2','#0d9488','#d97706','#dc2626','#9333ea','#16a34a'];
    function avatarColor(str) {
      let h = 0;
      for (const c of (str || '')) h = (h * 31 + c.charCodeAt(0)) % AVT_COLORS.length;
      return AVT_COLORS[h];
    }

    /* ================================================================
       BAR CHART SPARKLINE
    ================================================================ */
    function barSparkline(prices, up) {
      if (!prices || prices.length < 2) {
        const bars = Array.from({length: 8}, (_, i) => {
          const h = 12 + Math.sin(i * 0.9) * 10 + i * 2;
          return `<rect x="${i * 13}" y="${48 - h}" width="10" height="${h}" rx="2" fill="${up ? '#00ff41' : '#ff4444'}" opacity="0.3"/>`;
        }).join('');
        return `<svg viewBox="0 0 104 48" preserveAspectRatio="none" aria-hidden="true">${bars}</svg>`;
      }
      const n = Math.min(prices.length, 12);
      const recent = prices.slice(-n);
      const W = 200, H = 48, gap = 3;
      const barW = (W - gap * (n - 1)) / n;
      const min = Math.min(...recent);
      const max = Math.max(...recent);
      const rng = max - min || 1;
      const bars = recent.map((p, i) => {
        const x = i * (barW + gap);
        const h = Math.max(5, ((p - min) / rng) * (H - 6) + 6);
        const y = H - h;
        const isUp = i === 0 ? (p >= min) : (p >= recent[i - 1]);
        return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${h.toFixed(1)}" rx="2" fill="${isUp ? '#00ff41' : '#ff4444'}" opacity="0.85"/>`;
      }).join('');
      return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">${bars}</svg>`;
    }

    /* ================================================================
       SIGNAL BADGE
    ================================================================ */
    function signalBadge(raw) {
      const s = (raw ?? '').toString().toUpperCase().replace(/_/g, ' ').trim();
      if (s === 'STRONG BUY' || s === 'STRONG BUY SIGNAL') return ['sig-strong-buy', 'STRONG BUY'];
      if (s === 'BUY'  || s === 'BUY SIGNAL')  return ['sig-buy',  'BUY'];
      if (s === 'SELL' || s === 'SELL SIGNAL') return ['sig-sell', 'SELL'];
      if (s === 'HOLD' || s === 'HOLD SIGNAL' || s === 'NEUTRAL') return ['sig-hold', 'HOLD'];
      const n = parseFloat(raw);
      if (!isNaN(n)) {
        if (n >= 1.5)  return ['sig-strong-buy', 'STRONG BUY'];
        if (n >= 0.5)  return ['sig-buy', 'BUY'];
        if (n <= -0.5) return ['sig-sell', 'SELL'];
        return ['sig-hold', 'HOLD'];
      }
      return ['sig-hold', s || 'HOLD'];
    }

    function confColor(sigClass) {
      if (sigClass === 'sig-strong-buy' || sigClass === 'sig-buy') return '#00ff41';
      if (sigClass === 'sig-sell') return '#ff4444';
      return 'var(--text-subtle)';
    }

    /* ================================================================
       TRENDING TICKER CARDS  (pinned 4)
    ================================================================ */
    const PINNED = ['NVDA', 'AAPL', 'TSLA', 'MSFT'];

    function skeletonCard() {
      return `<div class="ticker-card" style="pointer-events:none;">
        <div class="ticker-card-top">
          <div>
            <div class="skeleton" style="height:13px;width:52px;border-radius:3px;"></div>
            <div class="skeleton" style="height:9px;width:80px;border-radius:3px;margin-top:5px;"></div>
          </div>
          <div class="skeleton" style="height:20px;width:50px;border-radius:10px;"></div>
        </div>
        <div class="skeleton" style="height:48px;border-radius:4px;margin-bottom:0.75rem;"></div>
        <div class="skeleton" style="height:18px;width:70px;border-radius:3px;"></div>
      </div>`;
    }

    async function loadTickerCards() {
      const grid = document.getElementById('tickerGrid');
      grid.innerHTML = PINNED.map(skeletonCard).join('');

      const settled = await Promise.allSettled(
        PINNED.map(async ticker => {
          const [sR, hR] = await Promise.allSettled([api.getStock(ticker), api.getHistory(ticker, '1M')]);
          return { ticker, stock: sR.value, hist: hR.value };
        })
      );

      grid.innerHTML = settled.map(r => {
        if (r.status !== 'fulfilled') return `<div class="ticker-card" style="color:var(--text-muted);font-size:0.875rem;">Failed</div>`;
        const { ticker, stock, hist } = r.value;
        const price = stock?.price ?? stock?.current_price ?? null;
        const chg   = stock?.change_pct ?? stock?.change_percent ?? stock?.change_pct_day ?? null;
        const name  = escHtml(stock?.name ?? stock?.company_name ?? '').toUpperCase();
        const up    = (chg ?? 0) >= 0;
        const { text: chgTxt, cls: chgCls } = fmtChange(chg);

        const raw    = Array.isArray(hist) ? hist : (hist?.history || hist?.prices || hist?.data || []);
        const prices = raw.map(p => typeof p === 'number' ? p : (p?.close ?? p?.price ?? null)).filter(v => v != null);

        return `<a href="/stock?ticker=${ticker}" class="ticker-card">
          <div class="ticker-card-top">
            <div>
              <div class="ticker-symbol">${ticker}</div>
              <div class="ticker-company">${name || '&nbsp;'}</div>
            </div>
            <span class="badge ${chgCls}">${chgTxt}</span>
          </div>
          <div class="ticker-sparkline">${barSparkline(prices, up)}</div>
          <div class="ticker-price">${price != null ? '$' + fmt(price) : '—'}</div>
        </a>`;
      }).join('');
    }

    loadTickerCards();

    /* ================================================================
       TOP GAINERS + LOSERS
    ================================================================ */
    async function loadGainersLosers() {
      const gBody = document.getElementById('gainersBody');
      const lBody = document.getElementById('losersBody');
      try {
        const data    = await api.getTrending();
        const stocks  = Array.isArray(data) ? data : (data.tickers || data.trending || []);
        const withChg = stocks.map(s => ({ ...s, _chg: parseFloat(s.change_pct ?? s.change_percent ?? 0) }));
        const gainers = [...withChg].sort((a, b) => b._chg - a._chg).filter(s => s._chg > 0).slice(0, 5);
        const losers  = [...withChg].sort((a, b) => a._chg - b._chg).filter(s => s._chg < 0).slice(0, 5);

        const toFetch = [...gainers, ...losers];
        const priceResults = await Promise.allSettled(
          toFetch.map(s => api.getStock(s.ticker || s.symbol))
        );
        const priceMap = {};
        priceResults.forEach((r, i) => {
          const ticker = toFetch[i].ticker || toFetch[i].symbol;
          if (r.status === 'fulfilled' && r.value) {
            priceMap[ticker] = r.value.price ?? r.value.current_price ?? null;
          }
        });

        function glRow(s) {
          const t       = escHtml(s.ticker || s.symbol || '');
          const rawPrice = priceMap[t] ?? s.price ?? null;
          const p       = rawPrice != null ? '$' + fmt(rawPrice) : '—';
          const { text: chgTxt, cls: chgCls } = fmtChange(s._chg);
          return `<tr onclick="window.location='/stock?ticker=${t}'">
            <td><span class="gl-ticker">${t}</span></td>
            <td><span class="gl-price">${p}</span></td>
            <td style="text-align:right;"><span class="badge ${chgCls}">${chgTxt}</span></td>
          </tr>`;
        }

        const empty = '<tr><td colspan="3" style="text-align:center;padding:1.25rem;color:var(--text-muted);">No data</td></tr>';
        gBody.innerHTML = gainers.length ? gainers.map(glRow).join('') : empty;
        lBody.innerHTML = losers.length  ? losers.map(glRow).join('')  : empty;
      } catch {
        const err = '<tr><td colspan="3" style="text-align:center;padding:1.25rem;color:var(--text-muted);">Could not load</td></tr>';
        gBody.innerHTML = err;
        lBody.innerHTML = err;
      }
    }
    loadGainersLosers();

    /* ================================================================
       AI RECOMMENDATIONS — personalized by user sector preferences
    ================================================================ */
    const SECTOR_TICKERS = {
      'Technology':  ['AAPL','MSFT','NVDA','GOOGL','META','AMD','INTC','ORCL','CRM','ADBE'],
      'Finance':     ['JPM','BAC','GS','MS','V','MA','AXP','WFC','C','BLK'],
      'Healthcare':  ['JNJ','UNH','PFE','ABBV','MRK','CVS','TMO','ABT','LLY','BMY'],
      'Energy':      ['XOM','CVX','SLB','COP','EOG','MPC','PSX','OXY','KMI','VLO'],
      'Consumer':    ['AMZN','TSLA','WMT','HD','NKE','MCD','SBUX','TGT','COST','LOW'],
      'Real Estate': ['AMT','PLD','EQIX','O','SPG','WELL','DLR','PSA','CCI','AVB'],
      'Industrials': ['CAT','DE','GE','HON','BA','UPS','LMT','RTX','MMM','ETN'],
      'Materials':   ['LIN','APD','ECL','SHW','NEM','FCX','NUE','ALB','DD','DOW'],
    };

    function buildRecTickerList() {
      const user    = api.getUser();
      const sectors = user?.sector_preferences;
      if (sectors && Array.isArray(sectors) && sectors.length) {
        return [...new Set(sectors.flatMap(s => SECTOR_TICKERS[s] || []))];
      }
      return [...new Set(Object.values(SECTOR_TICKERS).flat())];
    }

    const _recLoaded  = new Set();

    function _confInfo(pct) {
      if (pct >= 90) return { label: 'Very High Confidence', color: '#00ff41' };
      if (pct >= 75) return { label: 'High Confidence',      color: '#00d250' };
      if (pct >= 60) return { label: 'Moderate Confidence',  color: '#ffd600' };
      return              { label: 'Low Confidence',         color: '#9098b0' };
    }

    function _riskInfo(level) {
      const l = (level || '').toLowerCase();
      if (l === 'low')         return { pct: 16, txt: 'LOW',         cls: 'risk-low',  desc: 'Stable asset with low volatility and solid fundamentals.' };
      if (l === 'high')        return { pct: 84, txt: 'HIGH',        cls: 'risk-high', desc: 'Elevated risk — high volatility or stretched valuations.' };
      if (l === 'medium-high') return { pct: 66, txt: 'MEDIUM-HIGH', cls: 'risk-med',  desc: 'Moderately elevated risk, with some volatility expected.' };
      return                          { pct: 50, txt: 'MEDIUM',      cls: 'risk-med',  desc: 'Balanced risk profile with moderate growth and volatility.' };
    }

    function _bullets(sigCls, confPct) {
      if (sigCls === 'sig-strong-buy') return [
        'Price well above SMA20 and EMA20 — clear uptrend',
        'Momentum indicators showing sustained bullish strength',
        `Very high model conviction — ${confPct}% confidence signal`,
      ];
      if (sigCls === 'sig-buy') return [
        'Price trading above key moving average support',
        'Positive momentum building across recent sessions',
        `Buy signal confirmed with ${confPct}% model confidence`,
      ];
      if (sigCls === 'sig-sell') return [
        'Price breaking below key moving averages',
        'Bearish momentum confirmed by multiple indicators',
        `Sell signal generated with ${confPct}% model confidence`,
      ];
      return [
        'Price consolidating near key support / resistance',
        'Mixed signals — directional breakout not yet confirmed',
        `Hold signal with ${confPct}% model confidence`,
      ];
    }

    function _fmtLarge(n) {
      if (!n) return null;
      if (n >= 1e12) return '$' + (n / 1e12).toFixed(2) + 'T';
      if (n >= 1e9)  return '$' + (n / 1e9).toFixed(2) + 'B';
      if (n >= 1e6)  return '$' + (n / 1e6).toFixed(2) + 'M';
      return '$' + Number(n).toLocaleString();
    }

    window.toggleRec = function(ticker) {
      const mainRow   = document.querySelector(`.rec-row[data-ticker="${ticker}"]`);
      const detailRow = document.getElementById(`rcd-${ticker}`);
      if (!mainRow || !detailRow) return;
      const isOpen = mainRow.classList.contains('is-open');
      document.querySelectorAll('.rec-row.is-open').forEach(r => r.classList.remove('is-open'));
      document.querySelectorAll('.rec-detail-row').forEach(r => { r.style.display = 'none'; });
      if (!isOpen) {
        mainRow.classList.add('is-open');
        detailRow.style.display = '';
        if (!_recLoaded.has(ticker)) {
          _recLoaded.add(ticker);
          _loadRecMetrics(ticker);
        }
      }
    };

    async function _loadRecMetrics(ticker) {
      const el = document.getElementById(`rcm-${ticker}`);
      if (!el) return;
      try {
        const fund = await api.getFundamentals(ticker);
        const pe   = fund?.pe_ratio   != null ? fund.pe_ratio.toFixed(2)   : null;
        const eps  = fund?.eps        != null ? '$' + fund.eps.toFixed(2)  : null;
        const mcap = fund?.market_cap != null ? _fmtLarge(fund.market_cap) : null;
        const beta = fund?.beta       != null ? fund.beta.toFixed(2)       : null;
        const cards = [
          { name: 'P/E Ratio',  val: pe,   cls: '' },
          { name: 'EPS',        val: eps,  cls: eps  ? (parseFloat(eps.slice(1)) >= 0 ? 'pos' : 'neg') : '' },
          { name: 'Market Cap', val: mcap, cls: '' },
          { name: 'Beta',       val: beta, cls: '' },
        ];
        el.innerHTML = cards.map(c =>
          `<div class="rec-metric-card">
             <div class="rec-metric-name">${c.name}</div>
             <div class="rec-metric-val ${c.cls}">${c.val ?? '—'}</div>
           </div>`
        ).join('');
      } catch {
        el.innerHTML = `<div class="rec-metric-card" style="grid-column:1/-1;">
          <div class="rec-metric-name" style="color:var(--text-muted);">Metrics unavailable</div>
        </div>`;
      }
    }

    let recTickers    = [];
    let recOffset     = 0;
    let recLoading    = false;
    let recFilter     = 'high';
    let recAllRows    = [];
    const PAGE_SIZE   = 4;

    const LOAD_ICON = `<svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true"><path d="M6.5 1v11M6.5 12l-3.5-3.5M6.5 12l3.5-3.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

    function setBtn(text, disabled) {
      const btn = document.getElementById('loadMoreBtn');
      if (!btn) return;
      btn.disabled = disabled;
      btn.innerHTML = text + (disabled ? '' : ' ' + LOAD_ICON);
    }

    function renderRecRows() {
      const tbody = document.getElementById('recBody');
      const toShow = recFilter === 'high'
        ? recAllRows.filter(r => r.confPct != null && r.confPct >= 70)
        : recAllRows;
      if (!toShow.length) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:2.5rem;color:var(--text-muted);">
          ${recFilter === 'high' ? 'No high-confidence signals yet.' : 'No recommendations available yet.'}
        </td></tr>`;
        return;
      }
      tbody.innerHTML = toShow.map(r => r.html).join('');
    }

    async function loadRecs(append = false) {
      if (recLoading) return;
      recLoading = true;
      setBtn('Loading…', true);

      if (!api.isLoggedIn()) {
        document.getElementById('recBody').innerHTML = `<tr><td colspan="6" style="text-align:center;padding:2.5rem;color:var(--text-muted);">
          <a href="/login" style="color:var(--accent);font-weight:500;">Sign in</a> to view AI-powered recommendations.
        </td></tr>`;
        setBtn('LOAD MORE DATA', false);
        recLoading = false;
        return;
      }

      if (recTickers.length === 0) {
        recTickers = buildRecTickerList();
        if (!recTickers.length) {
          try {
            const data = await api.getTrending();
            const stocks = Array.isArray(data) ? data : (data.tickers || data.trending || []);
            recTickers = stocks.map(s => s.ticker || s.symbol).filter(Boolean);
          } catch { recTickers = []; }
        }
      }

      if (!recTickers.length) {
        document.getElementById('recBody').innerHTML = `<tr><td colspan="6" style="text-align:center;padding:2.5rem;color:var(--text-muted);">No stock data from server.</td></tr>`;
        setBtn('LOAD MORE DATA', false);
        recLoading = false;
        return;
      }

      const batch = recTickers.slice(recOffset, recOffset + PAGE_SIZE);
      if (!batch.length) {
        showToast('All recommendations loaded', 'success');
        setBtn('LOAD MORE DATA', false);
        recLoading = false;
        return;
      }

      if (!append) {
        document.getElementById('recBody').innerHTML = `<tr><td colspan="6" style="text-align:center;padding:2.5rem;"><span class="spinner"></span></td></tr>`;
      }

      const results = await Promise.allSettled(
        batch.map(async ticker => {
          const [sR, pR] = await Promise.allSettled([api.getStock(ticker), api.getRecommendation(ticker)]);
          return { ticker, stock: sR.value, pred: pR.value };
        })
      );

      const newRows = results.map(r => {
        if (r.status !== 'fulfilled' || !r.value.pred) return null;
        const { ticker, stock, pred } = r.value;

        const rawSig = pred?.signal ?? pred?.recommendation ?? pred?.prediction ?? pred?.action ?? null;
        if (!rawSig) return null;

        const [sigCls, sigLabel] = signalBadge(rawSig);
        const rawConf  = pred?.confidence ?? pred?.confidence_score ?? null;
        const confPct  = rawConf != null ? Math.round(Number(rawConf) * (rawConf <= 1 ? 100 : 1)) : null;
        const price    = stock?.price ?? stock?.current_price ?? null;
        const chg      = stock?.change_pct ?? stock?.change_percent ?? null;
        const name     = escHtml(stock?.name ?? stock?.company_name ?? '');
        const { text: chgTxt, cls: chgCls } = fmtChange(chg);
        const t        = escHtml(ticker);
        const initials = ticker.slice(0, 2).toUpperCase();
        const bgColor  = avatarColor(ticker);
        const barColor = confColor(sigCls);

        const conf    = _confInfo(confPct ?? 0);
        const risk    = _riskInfo(pred?.risk_level);
        const bullets = _bullets(sigCls, confPct ?? 0);

        const mainRow = `<tr class="rec-row" data-ticker="${t}" onclick="toggleRec('${t}')">
          <td>
            <div class="stock-cell">
              <div class="stock-avatar" style="background:${bgColor};">${initials}</div>
              <div class="stock-cell-info">
                <div class="rec-ticker">
                  <a href="/stock?ticker=${t}" onclick="event.stopPropagation()" style="color:inherit;text-decoration:none;">${t}</a>
                </div>
                <div class="rec-name">${name}</div>
              </div>
            </div>
          </td>
          <td><span class="rec-price-val">${price != null ? '$' + fmt(price) : '—'}</span></td>
          <td><span class="badge ${chgCls}" style="font-family:var(--font-mono);font-size:0.8rem;">${chgTxt}</span></td>
          <td>
            ${confPct != null
              ? `<div class="conf-wrap">
                   <div class="conf-bar"><div class="conf-fill" style="width:${confPct}%;background:${barColor};"></div></div>
                   <span class="conf-pct">${confPct}%</span>
                 </div>`
              : '<span style="color:var(--text-subtle);">—</span>'}
          </td>
          <td><span class="sig ${sigCls}">${sigLabel}</span></td>
          <td class="rec-chevron">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </td>
        </tr>`;

        const detailRow = `<tr class="rec-detail-row" id="rcd-${t}" style="display:none;">
          <td colspan="6" style="padding:0;">
            <div class="rec-detail-wrap">
              <div class="rec-detail-grid">
                <div>
                  <div class="rec-detail-label">AI Confidence</div>
                  <div class="rec-conf-big" style="color:${barColor};">${confPct ?? '—'}%</div>
                  <div class="rec-conf-bar-track">
                    <div class="rec-conf-bar-fill" style="width:${confPct ?? 0}%;background:${barColor};"></div>
                  </div>
                  <div class="rec-conf-text" style="color:${barColor};">${conf.label}</div>
                </div>
                <div>
                  <div class="rec-detail-label">Recommendation Reasoning</div>
                  <ul class="rec-reasons">
                    ${bullets.map(b => `<li>${escHtml(b)}</li>`).join('')}
                  </ul>
                </div>
                <div>
                  <div class="rec-detail-label">Risk Indicator</div>
                  <div class="rec-risk-gradient">
                    <div class="rec-risk-pin" style="left:${risk.pct}%;"></div>
                  </div>
                  <span class="rec-risk-badge ${risk.cls}">${risk.txt}</span>
                  <div class="rec-risk-desc">${risk.desc}</div>
                </div>
                <div>
                  <div class="rec-detail-label">Key Metrics</div>
                  <div class="rec-metric-2x2" id="rcm-${t}">
                    ${['P/E Ratio','EPS','Market Cap','Beta'].map(n =>
                      `<div class="rec-metric-card">
                         <div class="rec-metric-name">${n}</div>
                         <div class="rec-metric-val"><span class="skeleton" style="display:inline-block;width:42px;height:13px;vertical-align:middle;border-radius:3px;"></span></div>
                       </div>`
                    ).join('')}
                  </div>
                </div>
              </div>
              <div class="rec-detail-footer">
                <a href="/stock?ticker=${t}" class="btn-view-full">
                  View Full Analysis
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M2 6h8M7 3l3 3-3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </a>
              </div>
            </div>
          </td>
        </tr>`;

        const html = mainRow + detailRow;
        return { html, confPct, sigCls };
      }).filter(Boolean);

      if (append) {
        recAllRows.push(...newRows);
      } else {
        recAllRows = newRows;
      }

      recOffset += PAGE_SIZE;
      renderRecRows();
      setBtn('LOAD MORE DATA', false);
      recLoading = false;
    }

    loadRecs(false);

    const loadMoreBtn = document.getElementById('loadMoreBtn');
    if (loadMoreBtn) loadMoreBtn.addEventListener('click', () => loadRecs(true));

    /* Filter buttons */
    const filterHighBtn = document.getElementById('filterHigh');
    const filterAllBtn  = document.getElementById('filterAll');
    if (filterHighBtn) {
      filterHighBtn.addEventListener('click', function () {
        recFilter = 'high';
        this.classList.add('active');
        filterAllBtn.classList.remove('active');
        renderRecRows();
      });
    }
    if (filterAllBtn) {
      filterAllBtn.addEventListener('click', function () {
        recFilter = 'all';
        this.classList.add('active');
        filterHighBtn.classList.remove('active');
        renderRecRows();
      });
    }

    /* ================================================================
       NAV SEARCH — trending + recent dropdown
    ================================================================ */
    const navInput = document.getElementById('navSearchInput');
    const navDrop  = document.getElementById('navSearchDrop');

    const TRENDING_DEFAULTS = [
      { ticker: 'NVDA', name: 'NVIDIA Corporation' },
      { ticker: 'AAPL', name: 'Apple Inc.' },
      { ticker: 'TSLA', name: 'Tesla, Inc.' },
      { ticker: 'MSFT', name: 'Microsoft Corporation' },
      { ticker: 'AMZN', name: 'Amazon.com, Inc.' },
      { ticker: 'META', name: 'Meta Platforms' },
    ];

    function getRecent() { try { return JSON.parse(localStorage.getItem('sw_recent_searches') || '[]'); } catch { return []; } }
    function saveRecent(t) {
      const p = getRecent().filter(x => x !== t);
      localStorage.setItem('sw_recent_searches', JSON.stringify([t, ...p].slice(0, 5)));
    }
    function navGo(ticker) { saveRecent(ticker); window.location.href = `/stock?ticker=${encodeURIComponent(ticker)}`; }
    window.navGo = navGo;

    function showDefaultDrop() {
      const recent = getRecent();
      let html = `<div class="drop-section-label">Trending Searches</div>
        ${TRENDING_DEFAULTS.map(s => `<div class="drop-row" onclick="navGo('${s.ticker}')">
          <span class="drop-ticker">${s.ticker}</span><span class="drop-name">${escHtml(s.name)}</span>
        </div>`).join('')}`;
      if (recent.length) {
        html += `<div class="drop-divider"></div><div class="drop-section-label">Recent Searches</div>
          ${recent.map(t => `<div class="drop-row" onclick="navGo('${escHtml(t)}')">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style="color:var(--text-subtle);flex-shrink:0;" aria-hidden="true"><circle cx="6" cy="6" r="5" stroke="currentColor" stroke-width="1.1"/><path d="M6 3.5v3l2 1.5" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/></svg>
            <span class="drop-ticker">${escHtml(t)}</span>
          </div>`).join('')}`;
      }
      navDrop.innerHTML = html;
      navDrop.classList.add('open');
    }

    if (navInput && navDrop) {
      navInput.addEventListener('focus', () => { if (!navInput.value.trim()) showDefaultDrop(); });
      navInput.addEventListener('input', debounce(async () => {
        const q = navInput.value.trim();
        if (!q) { showDefaultDrop(); return; }
        navDrop.innerHTML = '<div class="drop-row"><span class="spinner" style="width:14px;height:14px;"></span></div>';
        navDrop.classList.add('open');
        try {
          const res   = await api.searchStocks(q);
          const items = Array.isArray(res) ? res : (res.results || []);
          if (!items.length) { navDrop.innerHTML = '<div class="drop-row" style="color:var(--text-muted);">No results found</div>'; return; }
          navDrop.innerHTML = items.slice(0, 8).map(s => {
            const t = escHtml(s.ticker || s.symbol || '');
            const n = escHtml(s.name || s.company_name || '');
            return `<div class="drop-row" onclick="navGo('${t}')"><span class="drop-ticker">${t}</span><span class="drop-name">${n}</span></div>`;
          }).join('');
        } catch { navDrop.innerHTML = '<div class="drop-row" style="color:var(--text-muted);">Search unavailable</div>'; }
      }, 250));

      navInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') { const q = navInput.value.trim().toUpperCase(); if (q) navGo(q); }
        if (e.key === 'Escape') navDrop.classList.remove('open');
      });
      document.addEventListener('click', e => {
        const navSearch = document.getElementById('navSearch');
        if (navSearch && !navSearch.contains(e.target)) navDrop.classList.remove('open');
      });
    }

    /* ================================================================
       SHARED INITS
    ================================================================ */
    initHoverSidebar();
    initAvatarDropdown();
    populateAvatar();
  }, [])

  return (
    <>
      {/* Sidebar */}
      <div className="sidebar-overlay" id="sidebarOverlay" onClick={() => closeSidebar()}></div>
      <aside className="sidebar" id="sidebar" aria-label="Main sidebar">
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
            <a href="/dashboard" className="sidebar-link active">
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

      {/* Navbar: Logo | Centered Search | Bell + Avatar */}
      <nav className="navbar" aria-label="Main navigation">
        <div className="navbar-inner dash-nav">
          <a href="/" className="logo-btn" aria-label="Go to homepage">
            <svg width="26" height="26" viewBox="0 0 28 28" fill="none" aria-hidden="true">
              <rect width="28" height="28" rx="6" fill="#00ff41" fillOpacity="0.12"/>
              <polyline points="5,18 10,12 14,15 19,8 23,11" stroke="#00ff41" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="23" cy="11" r="2" fill="#00ff41"/>
            </svg>
            StockWise <em>AI</em>
          </a>

          <div className="nav-search-wrap" id="navSearch">
            <div className="nav-search-inner">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.25"/>
                <path d="M9.5 9.5l3 3" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
              </svg>
              <input type="text" id="navSearchInput" placeholder="Search stocks by name or ticker" autoComplete="off" aria-label="Search stocks"/>
            </div>
            <div className="nav-search-drop" id="navSearchDrop" role="listbox"></div>
          </div>

          <div className="nav-right">
            <button className="nav-bell" aria-label="Notifications">
              <svg width="17" height="17" viewBox="0 0 17 17" fill="none" aria-hidden="true">
                <path d="M8.5 2a5 5 0 00-5 5v3l-.9 1.4a.75.75 0 00.63 1.1h10.54a.75.75 0 00.63-1.1L13.5 10V7a5 5 0 00-5-5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
                <path d="M7 13.5a1.5 1.5 0 003 0" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
              <span className="nav-bell-badge"></span>
            </button>
            <div className="nav-avatar-wrap" id="avatarWrap">
              <button className="nav-avatar-btn" id="avatarBtn" aria-expanded="false" aria-haspopup="true">
                <span className="nav-avatar" id="navAvatar">U</span>
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

      <div className="dash-page">
        {/* Hero */}
        <div className="dash-hero">
          <div className="dash-hero-inner">
            <h1 className="hero-title">AI-Powered <span className="accent">Stock<br/>Recommendations</span></h1>
            <p className="hero-sub">Personalized Buy/Sell/Hold signals generated by advanced AI models. Precision-engineered data for the professional investor.</p>
          </div>
        </div>

        {/* Main content */}
        <div className="dash-content">

          {/* Trending Tickers */}
          <section>
            <div className="section-row">
              <h2>Trending Tickers</h2>
              <a href="/" className="view-all-link">View All</a>
            </div>
            <div className="ticker-grid" id="tickerGrid"></div>
          </section>

          {/* Top Gainers + Losers */}
          <div className="gl-row">
            <div className="gl-panel">
              <div className="section-row">
                <h2><span className="gl-icon" style={{color:'#00ff41'}}>↗</span> Top Gainers</h2>
              </div>
              <table className="gl-table" aria-label="Top gainers">
                <thead>
                  <tr>
                    <th>Ticker</th>
                    <th>Price</th>
                    <th className="right">Change</th>
                  </tr>
                </thead>
                <tbody id="gainersBody">
                  <tr><td colSpan="3" style={{textAlign:'center',padding:'1.5rem',color:'var(--text-muted)'}}><span className="spinner"></span></td></tr>
                </tbody>
              </table>
            </div>
            <div className="gl-panel">
              <div className="section-row">
                <h2><span className="gl-icon" style={{color:'#ff4444'}}>↘</span> Top Losers</h2>
              </div>
              <table className="gl-table" aria-label="Top losers">
                <thead>
                  <tr>
                    <th>Ticker</th>
                    <th>Price</th>
                    <th className="right">Change</th>
                  </tr>
                </thead>
                <tbody id="losersBody">
                  <tr><td colSpan="3" style={{textAlign:'center',padding:'1.5rem',color:'var(--text-muted)'}}><span className="spinner"></span></td></tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* AI Recommendations */}
          <section>
            <div className="rec-header-row">
              <div>
                <h2>AI Recommendations</h2>
                <p className="rec-subtitle">Updated every 5 minutes based on live market analysis</p>
              </div>
              <div className="filter-btns">
                <button className="filter-btn active" id="filterHigh">High Confidence</button>
                <button className="filter-btn" id="filterAll">All Signals</button>
              </div>
            </div>
            <div className="card rec-card">
              <div className="rec-table-wrap">
                <table className="rec-table" aria-label="AI recommendations">
                  <thead>
                    <tr>
                      <th>Stock</th>
                      <th>Price</th>
                      <th>Change</th>
                      <th>Confidence</th>
                      <th>Rating</th>
                      <th style={{width:'36px'}}></th>
                    </tr>
                  </thead>
                  <tbody id="recBody">
                    <tr><td colSpan="6" style={{textAlign:'center',padding:'2.5rem',color:'var(--text-muted)'}}><span className="spinner"></span></td></tr>
                  </tbody>
                </table>
              </div>
              <div className="load-more-row">
                <button className="btn-load-more" id="loadMoreBtn">
                  LOAD MORE DATA
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true"><path d="M6.5 1v11M6.5 12l-3.5-3.5M6.5 12l3.5-3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>
              </div>
            </div>
          </section>

        </div>

        {/* Footer */}
        <footer className="site-footer">
          <div className="footer-main">
            <div>
              <div className="footer-brand">StockWise AI</div>
              <div className="footer-tagline">All features are completely free with no subscription.</div>
            </div>
            <nav className="footer-links" aria-label="Footer">
              <a href="#">Privacy Policy</a>
              <a href="#">Terms of Service</a>
              <a href="#">SEC Disclosures</a>
            </nav>
          </div>
          <div className="footer-bottom">
            <span className="footer-copy">© 2024 StockWise AI. Calculated Confidence.</span>
            <div className="footer-icons">
              <button className="footer-icon-btn" aria-label="Email">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="3" width="12" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.2"/><path d="M1 4l6 4 6-4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
              </button>
              <button className="footer-icon-btn" aria-label="Charts">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="8" width="3" height="4" rx="0.5" stroke="currentColor" strokeWidth="1.2"/><rect x="5.5" y="5" width="3" height="7" rx="0.5" stroke="currentColor" strokeWidth="1.2"/><rect x="10" y="2" width="3" height="10" rx="0.5" stroke="currentColor" strokeWidth="1.2"/></svg>
              </button>
              <button className="footer-icon-btn" aria-label="Website">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.2"/><path d="M7 1c-2 2-2 8 0 12M7 1c2 2 2 8 0 12M1 7h12" stroke="currentColor" strokeWidth="1.2"/></svg>
              </button>
            </div>
          </div>
        </footer>
      </div>

      <div id="toast-container"></div>
    </>
  )
}

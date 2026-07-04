import { useEffect, useState } from 'react'
import * as LightweightCharts from 'lightweight-charts'
import '../styles/shared.css'
import '../styles/stock.css'
import api, { closeSidebar, escHtml, fmt, fmtChange, fmtSignal, initHoverSidebar, initAvatarDropdown, populateAvatar } from '../js/api'

export default function Stock() {
  const role = localStorage.getItem('sw_token')
    ? (localStorage.getItem('sw_role') || 'guest').toLowerCase()
    : 'guest';
  const isTrader = role === 'trader';
  const [showAllNews, setShowAllNews] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    const ROLES = {
      guest:    { defaultPeriod:'1M', allowedPeriods:['1M','3M'], showNews:false, showOrderBook:false, showPrediction:false, showHistory:false, showToggles:false, showFundamentals:false },
      investor: { defaultPeriod:'1M', allowedPeriods:['1D','1W','1M','3M','1Y'], showNews:true, showOrderBook:true, showPrediction:true, showHistory:true, showToggles:false, showFundamentals:true },
      trader:   { defaultPeriod:'1D', allowedPeriods:['1D','1W','1M','3M','1Y'], showNews:true, showOrderBook:true, showPrediction:true, showHistory:true, showToggles:true, showFundamentals:false },
    };
    const cfg = ROLES[role] || ROLES.guest;

    const params = new URLSearchParams(window.location.search);
    const ticker = (params.get('ticker') || '').toUpperCase();
    if (!ticker) { window.location.href = '/dashboard'; return; }

    document.getElementById('breadTicker').textContent = ticker;
    document.title = `${ticker} — StockWise AI`;

    /* Indicator state (trader) */
    const _indState = {
      sma:{ on:false,period:20 }, ema:{ on:false,period:20 }, bb:{ on:false,period:20 },
      vwap:{ on:false,period:null }, ichimoku:{ on:false,period:null }, vol:{ on:false,period:null },
      rsi:{ on:false,period:14 }, macd:{ on:false,period:null }, stoch:{ on:false,period:14 },
      willr:{ on:false,period:14 }, atr:{ on:false,period:14 }, obv:{ on:false,period:null },
    };
    const _ovSeries = {}, _subPanes = {};
    const OVERLAY_KEYS = ['sma','ema','bb','vwap','ichimoku','vol'];
    const PANE_KEYS    = ['rsi','macd','stoch','willr','atr','obv'];

    /* Upgrade card */
    const LOCK_SVG = `<svg width="28" height="28" viewBox="0 0 28 28" fill="none" class="upgrade-card-lock"><rect x="6" y="13" width="16" height="12" rx="3" stroke="currentColor" stroke-width="1.4"/><path d="M9 13v-4a5 5 0 0110 0v4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>`;
    function upgradeCard(title, desc, feature) {
      return `<div class="upgrade-card">${LOCK_SVG}<div class="upgrade-card-info"><div class="upgrade-card-title">${title}</div><div class="upgrade-card-desc">${desc}</div></div><a href="/register?plan=${feature}" class="btn btn-accent btn-sm" style="flex-shrink:0;">Upgrade</a></div>`;
    }

    // APPLY ROLE GATING
    function applyRoleGating() {
      const meta = document.getElementById('stockMeta');
      if (role === 'trader') {
        meta.innerHTML = '<span class="role-badge trader">TRADER</span>';
      } else if (role === 'investor') {
        meta.innerHTML = '<span class="role-badge investor">INVESTOR</span>';
      } else {
        meta.innerHTML = '';
      }

      document.querySelectorAll('.period-tab').forEach(btn => {
        const p = btn.dataset.period;
        if (!cfg.allowedPeriods.includes(p)) { btn.disabled = true; btn.title = 'Upgrade to access this period'; }
        btn.classList.toggle('active', p === cfg.defaultPeriod);
      });

      document.getElementById('indBar').style.display   = isTrader ? '' : 'none';
      document.getElementById('basicBar').style.display = isTrader ? 'none' : '';
      document.getElementById('indicatorsCard').style.display = 'none';

      const fundEl = document.getElementById('fundamentalsSection');
      if (cfg.showFundamentals) {
        fundEl.innerHTML = `<div class="card" id="fundamentalsCard"><div class="card-header"><div><div class="card-title">Fundamental Analysis</div><div class="card-sub">Key financial metrics</div></div></div><div class="card-body"><div class="fund-grid" id="fundGrid">${Array(9).fill('<div class="fund-tile"><div class="fund-tile-label skeleton" style="height:10px;width:60%;margin-bottom:6px;"></div><div class="skeleton" style="height:20px;width:80%;"></div></div>').join('')}</div><div class="fund-desc" id="fundDesc"><div class="skeleton" style="height:60px;"></div></div></div></div>`;
        loadFundamentals();
      } else { fundEl.innerHTML = ''; }

      const newsEl = document.getElementById('newsSection');
      if (cfg.showNews) {
        newsEl.innerHTML = `<div class="card" id="newsCard"><div class="card-header"><div class="card-title">News &amp; Sentiment</div></div><div id="newsList"><div style="padding:1.5rem;text-align:center;"><span class="spinner"></span></div></div></div>`;
        loadNews();
      } else { newsEl.innerHTML = upgradeCard('News &amp; Sentiment', 'Real-time news and sentiment analysis for this stock.', 'investor'); }

      const obEl = document.getElementById('orderbookSection');
      if (cfg.showOrderBook) {
        obEl.innerHTML = `<div class="card" id="orderbookCard"><div class="card-header"><div class="card-title">Order Book</div><div class="card-sub" id="obSpread">Spread: —</div></div><div class="card-body"><div class="orderbook-grid"><div><div class="ob-side-label bids">Bids</div><div id="bidsCol"><div class="skeleton" style="height:120px;"></div></div></div><div><div class="ob-side-label asks">Asks</div><div id="asksCol"><div class="skeleton" style="height:120px;"></div></div></div></div></div></div>`;
        loadOrderBook();
      } else { obEl.innerHTML = upgradeCard('Order Book', 'Live bid/ask depth data for professional analysis.', 'investor'); }

      const histEl = document.getElementById('histSection');
      if (cfg.showHistory) {
        histEl.innerHTML = `<div class="card" id="histCard"><div class="card-header"><div class="card-title">AI Prediction History</div></div><div id="histContent"><div class="hist-locked-msg" id="histLocked"><svg width="32" height="32" viewBox="0 0 32 32" fill="none" style="margin:0 auto 0.75rem;display:block;opacity:0.35"><rect x="8" y="14" width="16" height="12" rx="3" stroke="currentColor" stroke-width="1.5"/><path d="M11 14v-3a5 5 0 0110 0v3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>Sign in to view prediction history</div></div></div>`;
        loadPredHistory();
      } else { histEl.innerHTML = upgradeCard('AI Prediction History', 'Track signal accuracy and historical AI recommendations.', 'investor'); }

      if (cfg.showPrediction) { loadPrediction(); }
    }

    // STOCK INFO
    async function loadStockInfo() {
      try {
        const data   = await api.getStock(ticker);
        const price  = data.current_price ?? data.price ?? data.last_price ?? data.close;
        const change = data.change_percent ?? data.change_pct ?? data.change;
        const name   = data.name ?? data.company_name ?? ticker;
        const exch   = data.exchange ?? '';
        document.getElementById('stockIcon').textContent    = ticker.slice(0, 3);
        document.getElementById('stockName').textContent    = ticker;
        document.getElementById('stockCompany').textContent = name;
        const meta = document.getElementById('stockMeta');
        const badge = meta.querySelector('.role-badge');
        const badgeHTML = badge ? badge.outerHTML : '';
        meta.innerHTML = badgeHTML + (exch ? `<span class="meta-pill">${escHtml(exch)}</span>` : '');
        document.getElementById('priceBig').textContent = price != null ? `$${fmt(price)}` : '—';
        const { text: chgTxt, cls: chgCls } = fmtChange(change);
        document.getElementById('priceChangeRow').innerHTML = `<span class="badge ${chgCls}">${chgTxt}</span>`;
      } catch { document.getElementById('stockCompany').textContent = ticker; }
    }

    // LIVE PRICE
    async function refreshPrice() {
      const el = document.getElementById('liveQuoteBody');
      el.innerHTML = '<div class="skeleton" style="height:80px;"></div>';
      try {
        const data  = await api.getPrice(ticker);
        const price = data.price ?? data.last_price ?? data.close;
        const vol   = data.volume ? Number(data.volume).toLocaleString() : '—';
        const bid   = data.bid ?? '—';
        const ask   = data.ask ?? '—';
        el.innerHTML = `<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;">
          <div><div style="font-size:.75rem;color:var(--text-subtle);font-family:var(--font-mono);text-transform:uppercase;letter-spacing:.06em;margin-bottom:3px;">Price</div><div style="font-family:var(--font-mono);font-size:1.25rem;font-weight:700;">${price ? '$'+fmt(price) : '—'}</div></div>
          <div><div style="font-size:.75rem;color:var(--text-subtle);font-family:var(--font-mono);text-transform:uppercase;letter-spacing:.06em;margin-bottom:3px;">Volume</div><div style="font-family:var(--font-mono);font-size:1rem;font-weight:600;">${vol}</div></div>
          <div><div style="font-size:.75rem;color:var(--text-subtle);font-family:var(--font-mono);text-transform:uppercase;letter-spacing:.06em;margin-bottom:3px;">Bid</div><div style="font-family:var(--font-mono);font-size:.9375rem;color:var(--accent);">${typeof bid==='number'?'$'+fmt(bid):bid}</div></div>
          <div><div style="font-size:.75rem;color:var(--text-subtle);font-family:var(--font-mono);text-transform:uppercase;letter-spacing:.06em;margin-bottom:3px;">Ask</div><div style="font-family:var(--font-mono);font-size:.9375rem;color:var(--red);">${typeof ask==='number'?'$'+fmt(ask):ask}</div></div>
        </div>`;
      } catch { el.innerHTML = '<p style="font-size:.875rem;color:var(--text-muted);">Live quote unavailable.</p>'; }
    }
    window.refreshPrice = refreshPrice;

    // CHART
    let _lwChart = null, _series = {}, _chartRo = null, _scrollDragCleanup = null, _chartData = null;
    let currentPeriod = cfg.defaultPeriod;

    function smaArr(arr, n) { return arr.map((_, i) => i < n-1 ? null : arr.slice(i-n+1,i+1).reduce((a,b)=>a+b,0)/n); }
    function emaArr(arr, n) {
      const k=2/(n+1), out=Array(arr.length).fill(null);
      if (arr.length<n) return out;
      let v=arr.slice(0,n).reduce((a,b)=>a+b,0)/n; out[n-1]=v;
      for (let i=n;i<arr.length;i++){v=arr[i]*k+v*(1-k);out[i]=v;} return out;
    }
    function calcSMA(cs,p){const r=[];for(let i=p-1;i<cs.length;i++){let s=0;for(let j=i-p+1;j<=i;j++)s+=cs[j].close;r.push({time:cs[i].time,value:s/p});}return r;}
    function calcEMA(cs,p){if(cs.length<p)return[];const k=2/(p+1);let v=0;for(let i=0;i<p;i++)v+=cs[i].close;v/=p;const r=[{time:cs[p-1].time,value:v}];for(let i=p;i<cs.length;i++){v=cs[i].close*k+v*(1-k);r.push({time:cs[i].time,value:v});}return r;}
    function calcBB(cs,p){const upper=[],lower=[],mid=[];for(let i=p-1;i<cs.length;i++){let s=0;for(let j=i-p+1;j<=i;j++)s+=cs[j].close;const m=s/p;let va=0;for(let j=i-p+1;j<=i;j++)va+=(cs[j].close-m)**2;const sd=Math.sqrt(va/p);const t=cs[i].time;upper.push({time:t,value:m+2*sd});lower.push({time:t,value:m-2*sd});mid.push({time:t,value:m});}return{upper,lower,mid};}
    function calcVWAP(cs){const r=[];let cpv=0,cv=0;for(const c of cs){const tp=(c.high+c.low+c.close)/3;cpv+=tp*(c.volume||0);cv+=c.volume||0;if(cv>0)r.push({time:c.time,value:cpv/cv});}return r;}
    function calcIchimoku(cs){function midHL(arr){return(Math.max(...arr.map(c=>c.high))+Math.min(...arr.map(c=>c.low)))/2;}const tenkan=[],kijun=[],chikou=[],spanA=[],spanB=[];for(let i=0;i<cs.length;i++){const t=cs[i].time;const s9=cs.slice(Math.max(0,i-8),i+1),s26=cs.slice(Math.max(0,i-25),i+1),s52=cs.slice(Math.max(0,i-51),i+1);if(s9.length>=9)tenkan.push({time:t,value:midHL(s9)});if(s26.length>=26)kijun.push({time:t,value:midHL(s26)});if(i>=26)chikou.push({time:cs[i-26].time,value:cs[i].close});if(s9.length>=9&&s26.length>=26)spanA.push({time:t,value:(midHL(s9)+midHL(s26))/2});if(s52.length>=52)spanB.push({time:t,value:midHL(s52)});}return{tenkan,kijun,chikou,spanA,spanB};}
    function calcRSI(cs,p){const r=[];if(cs.length<=p)return r;let ag=0,al=0;for(let i=1;i<=p;i++){const d=cs[i].close-cs[i-1].close;if(d>0)ag+=d;else al-=d;}ag/=p;al/=p;r.push({time:cs[p].time,value:al===0?100:100-100/(1+ag/al)});for(let i=p+1;i<cs.length;i++){const d=cs[i].close-cs[i-1].close,g=d>0?d:0,l=d<0?-d:0;ag=(ag*(p-1)+g)/p;al=(al*(p-1)+l)/p;r.push({time:cs[i].time,value:al===0?100:100-100/(1+ag/al)});}return r;}
    function calcMACD(cs){const closes=cs.map(c=>c.close),times=cs.map(c=>c.time);const ef=emaArr(closes,12),es=emaArr(closes,26);const ml=[],mt=[];for(let i=25;i<closes.length;i++){if(ef[i]!=null&&es[i]!=null){ml.push(ef[i]-es[i]);mt.push(times[i]);}}const sa=emaArr(ml,9);const line=ml.map((v,i)=>({time:mt[i],value:v}));const signal=[],hist=[];ml.forEach((v,i)=>{if(sa[i]!=null){signal.push({time:mt[i],value:sa[i]});hist.push({time:mt[i],value:v-sa[i],color:v-sa[i]>=0?'rgba(0,255,65,0.55)':'rgba(255,68,68,0.55)'});}});return{line,signal,hist};}
    function calcStoch(cs,p){const K=[];for(let i=p-1;i<cs.length;i++){const sl=cs.slice(i-p+1,i+1);const hi=Math.max(...sl.map(c=>c.high)),lo=Math.min(...sl.map(c=>c.low));K.push({time:cs[i].time,value:hi===lo?50:((cs[i].close-lo)/(hi-lo))*100});}const D=[];for(let i=2;i<K.length;i++)D.push({time:K[i].time,value:(K[i].value+K[i-1].value+K[i-2].value)/3});return{K,D};}
    function calcWilliamsR(cs,p){const r=[];for(let i=p-1;i<cs.length;i++){const sl=cs.slice(i-p+1,i+1);const hi=Math.max(...sl.map(c=>c.high)),lo=Math.min(...sl.map(c=>c.low));r.push({time:cs[i].time,value:hi===lo?-50:((hi-cs[i].close)/(hi-lo))*(-100)});}return r;}
    function calcATR(cs,p){const tr=[];for(let i=1;i<cs.length;i++){const h=cs[i].high,l=cs[i].low,pc=cs[i-1].close;tr.push(Math.max(h-l,Math.abs(h-pc),Math.abs(l-pc)));}const r=[];if(tr.length<p)return r;let atr=tr.slice(0,p).reduce((a,b)=>a+b)/p;r.push({time:cs[p].time,value:atr});for(let i=p;i<tr.length;i++){atr=(atr*(p-1)+tr[i])/p;r.push({time:cs[i+1].time,value:atr});}return r;}
    function calcOBV(cs){let obv=0;return cs.map((c,i)=>{if(i>0){if(c.close>cs[i-1].close)obv+=c.volume||0;else if(c.close<cs[i-1].close)obv-=c.volume||0;}return{time:c.time,value:obv};});}
    function fmtVol(v){if(v>=1e9)return(v/1e9).toFixed(2)+'B';if(v>=1e6)return(v/1e6).toFixed(2)+'M';if(v>=1e3)return(v/1e3).toFixed(1)+'K';return Number(v).toLocaleString();}

    function drawChart(items) {
      const container = document.getElementById('priceChart');
      if (_scrollDragCleanup) { _scrollDragCleanup(); _scrollDragCleanup = null; }
      if (_lwChart) { _lwChart.remove(); _lwChart = null; _series = {}; }
      if (_chartRo) { _chartRo.disconnect(); _chartRo = null; }
      if (!items || !items.length) { document.getElementById('chartLoading').style.display = 'none'; return; }

      const isIntraday = typeof (items[0].time ?? items[0].date) === 'number';
      _lwChart = LightweightCharts.createChart(container, {
        width: container.clientWidth, height: 360,
        layout: { background:{type:'solid',color:'transparent'}, textColor:'#6b7280', fontFamily:"'JetBrains Mono','Courier New',monospace", fontSize:11 },
        grid: { vertLines:{color:'rgba(255,255,255,0.04)'}, horzLines:{color:'rgba(255,255,255,0.04)'} },
        crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
        rightPriceScale: { borderColor:'rgba(255,255,255,0.08)', textColor:'#6b7280', scaleMargins:{top:0.08,bottom:isTrader?0.25:0.04} },
        timeScale: {
          borderColor:'rgba(255,255,255,0.08)', textColor:'#6b7280',
          timeVisible:isIntraday, secondsVisible:false, rightOffset:5,
          barSpacing:isIntraday?6:8, minBarSpacing:2,
          tickMarkFormatter: isIntraday ? (ts)=>{const d=new Date(ts*1000);const mo=String(d.getUTCMonth()+1).padStart(2,'0');const day=String(d.getUTCDate()).padStart(2,'0');const hr=String(d.getUTCHours()).padStart(2,'0');const mn=String(d.getUTCMinutes()).padStart(2,'0');return`${mo}/${day} ${hr}:${mn}`;} : undefined,
        },
        handleScroll:{mouseWheel:true,pressedMouseMove:true,horzTouchDrag:true},
        handleScale:{mouseWheel:true,pinch:true,axisPressedMouseMove:{time:true,price:true}},
      });

      const candleSeries = _lwChart.addCandlestickSeries({upColor:'#00ff41',downColor:'#ff4444',borderUpColor:'#00ff41',borderDownColor:'#ff4444',wickUpColor:'#00c835',wickDownColor:'#cc2222'});
      candleSeries.setData(items.map(d=>({time:d.time??d.date,open:d.open??d.close,high:d.high??d.close,low:d.low??d.close,close:d.close??0})));
      _series.candle = candleSeries;

      _chartData = items.map(d=>({time:d.time??d.date,open:d.open,high:d.high,low:d.low,close:d.close,volume:d.volume??0}));

      if (isTrader) {
        for (const k of OVERLAY_KEYS) { removeOverlay(k); if(_indState[k].on) applyOverlay(k); }
        const wasOpen = Object.keys(_subPanes);
        for (const k of wasOpen) {
          closeSubPane(k);
          _indState[k].on = true;
          document.querySelector(`.ind-btn[data-key="${k}"]`)?.classList.add('active');
          openSubPane(k);
        }
      }
      if (!isTrader) _reapplyBasic();

      _lwChart.timeScale().fitContent();
      _scrollDragCleanup = setupScrollBar(_lwChart, items.length);

      _chartRo = new ResizeObserver(() => { if(_lwChart) _lwChart.applyOptions({width:container.clientWidth}); });
      _chartRo.observe(container);
      document.getElementById('chartLoading').style.display = 'none';
    }

    function setupScrollBar(chart, totalBars) {
      const bar=document.getElementById('chartScrollBar'), thumb=document.getElementById('chartScrollThumb');
      if (!bar||!thumb) return null;
      function updateThumb(range){if(!range)return;const visible=range.to-range.from;const w=Math.min(100,Math.max(8,(visible/totalBars)*100));const l=Math.min(100-w,Math.max(0,(range.from/totalBars)*100));thumb.style.width=w+'%';thumb.style.left=l+'%';bar.style.display='block';}
      chart.timeScale().subscribeVisibleLogicalRangeChange(updateThumb);
      let drag=null;
      const onDown=(e)=>{e.preventDefault();drag={startX:e.clientX,initLeft:parseFloat(thumb.style.left||'0')/100,barW:bar.clientWidth};thumb.classList.add('dragging');};
      const onMove=(e)=>{if(!drag)return;const dPct=(e.clientX-drag.startX)/drag.barW;const newFrom=Math.max(0,(drag.initLeft+dPct)*totalBars);const cur=chart.timeScale().getVisibleLogicalRange();if(!cur)return;chart.timeScale().setVisibleLogicalRange({from:newFrom,to:newFrom+(cur.to-cur.from)});};
      const onUp=()=>{if(drag){drag=null;thumb.classList.remove('dragging');}};
      thumb.addEventListener('mousedown',onDown);
      document.addEventListener('mousemove',onMove);
      document.addEventListener('mouseup',onUp);
      return ()=>{thumb.removeEventListener('mousedown',onDown);document.removeEventListener('mousemove',onMove);document.removeEventListener('mouseup',onUp);try{chart.timeScale().unsubscribeVisibleLogicalRangeChange(updateThumb);}catch{}bar.style.display='none';};
    }

    /* OHLCV aggregation */
    function _buildGroup(d){return{time:d.date,open:d.open,high:d.high,low:d.low,close:d.close,volume:d.volume??0};}
    function _mergeGroup(g,d){if(d.high>g.high)g.high=d.high;if(d.low<g.low)g.low=d.low;g.close=d.close;g.volume+=d.volume??0;}
    function aggregateWeekly(rows){const map=new Map();for(const d of rows){const dt=new Date(d.date+'T12:00:00Z');const dow=dt.getUTCDay();const mon=new Date(dt);mon.setUTCDate(dt.getUTCDate()+(dow===0?-6:1-dow));const key=mon.toISOString().slice(0,10);map.has(key)?_mergeGroup(map.get(key),d):map.set(key,{..._buildGroup(d),time:key});}return Array.from(map.values());}
    function aggregateMonthly(rows){const map=new Map();for(const d of rows){const key=d.date.slice(0,7);map.has(key)?_mergeGroup(map.get(key),d):map.set(key,{..._buildGroup(d),time:key+'-01'});}return Array.from(map.values());}
    function aggregateQuarterly(rows){const map=new Map();for(const d of rows){const[yr,mo]=d.date.split('-').map(Number);const q=Math.floor((mo-1)/3);const key=`${yr}-Q${q+1}`;const t=`${yr}-${String(q*3+1).padStart(2,'0')}-01`;map.has(key)?_mergeGroup(map.get(key),d):map.set(key,{..._buildGroup(d),time:t});}return Array.from(map.values());}
    function aggregateYearly(rows){const map=new Map();for(const d of rows){const key=d.date.slice(0,4);map.has(key)?_mergeGroup(map.get(key),d):map.set(key,{..._buildGroup(d),time:key+'-01-01'});}return Array.from(map.values());}

    const PERIOD_CONFIG = {
      '1D':{fetchPeriod:'1Y',agg:null,label:'Daily'},
      '1W':{fetchPeriod:'1Y',agg:aggregateWeekly,label:'Weekly'},
      '1M':{fetchPeriod:'1Y',agg:aggregateMonthly,label:'Monthly'},
      '3M':{fetchPeriod:'1Y',agg:aggregateQuarterly,label:'Quarterly'},
      '1Y':{fetchPeriod:'1Y',agg:aggregateYearly,label:'Yearly'},
    };

    async function loadChart(period) {
      document.getElementById('chartLoading').style.display = 'flex';
      document.getElementById('chartSub').textContent = 'Loading data…';
      try {
        const {fetchPeriod,agg,label} = PERIOD_CONFIG[period]||{fetchPeriod:period,agg:null,label:period};
        const raw   = await api.getHistory(ticker,fetchPeriod);
        const daily = Array.isArray(raw)?raw:(raw.history||raw.prices||[]);
        const items = agg?agg(daily):daily;
        document.getElementById('chartSub').textContent = `${items.length} candles · ${label}`;
        drawChart(items);
      } catch {
        document.getElementById('chartSub').textContent = 'Price history unavailable.';
        document.getElementById('chartLoading').style.display = 'none';
      }
    }

    /* Fullscreen */
    const _fsEnter = `<path d="M1 5V1h4M9 1h4v4M13 9v4H9M5 13H1V9" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>`;
    const _fsExit  = `<path d="M5 1v4H1M13 5H9V1M9 13v-4h4M1 9h4v4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>`;

    window.toggleFullscreen = function() {
      const card = document.getElementById('chartCard');
      if (!card) return;
      if (!document.fullscreenElement && !document.webkitFullscreenElement) {
        (card.requestFullscreen || card.webkitRequestFullscreen).call(card);
      } else { (document.exitFullscreen || document.webkitExitFullscreen).call(document); }
    };

    function onFullscreenChange() {
      const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement);
      const icon = document.getElementById('fsIcon');
      if (icon) icon.innerHTML = isFs ? _fsExit : _fsEnter;
      if (_lwChart) {
        const container = document.getElementById('priceChart');
        setTimeout(()=>{
          if(!_lwChart)return;
          const h=isFs?(container.clientHeight||window.innerHeight-80):360;
          _lwChart.applyOptions({width:container.clientWidth,height:h});
          const cur=_lwChart.timeScale().getVisibleLogicalRange();
          if(!cur)_lwChart.timeScale().scrollToRealTime();
        },50);
      }
    }
    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('webkitfullscreenchange', onFullscreenChange);

    /* Period tab clicks */
    document.querySelectorAll('.period-tab').forEach(btn => {
      btn.addEventListener('click', function() {
        if (this.disabled) return;
        document.querySelectorAll('.period-tab').forEach(b=>b.classList.remove('active'));
        this.classList.add('active');
        currentPeriod = this.dataset.period;
        loadChart(currentPeriod);
      });
    });

    // INDICATOR TOGGLE BUTTONS (trader)
    document.querySelectorAll('.ind-period').forEach(input => {
      input.addEventListener('pointerdown', e=>e.stopPropagation());
      input.addEventListener('click', e=>e.stopPropagation());
      input.addEventListener('keydown', e=>{if(e.key==='Enter')e.target.blur();e.stopPropagation();});
      input.addEventListener('change', function(){
        const key=this.dataset.key;
        const p=Math.max(2,Math.min(500,parseInt(this.value)||_indState[key].period));
        this.value=p; _indState[key].period=p;
        if(!_indState[key].on)return;
        if(OVERLAY_KEYS.includes(key)){removeOverlay(key);applyOverlay(key);}
        else{closeSubPane(key);_indState[key].on=true;document.querySelector(`.ind-btn[data-key="${key}"]`)?.classList.add('active');openSubPane(key);}
      });
    });

    document.querySelectorAll('.ind-btn').forEach(btn => {
      btn.addEventListener('click', function(e){
        if(e.target.classList.contains('ind-period'))return;
        const key=this.dataset.key;
        _indState[key].on=!_indState[key].on;
        this.classList.toggle('active',_indState[key].on);
        if(OVERLAY_KEYS.includes(key)){if(_indState[key].on)applyOverlay(key);else removeOverlay(key);}
        else{if(_indState[key].on)openSubPane(key);else closeSubPane(key);}
      });
    });

    // BASIC TOGGLES (guest + investor)
    const _basicState = { sma:false, ema:false, rsi:false, vol:false };
    function _reapplyBasic(){if(!_chartData?.length)return;if(_basicState.sma)applyOverlay('sma');if(_basicState.ema)applyOverlay('ema');if(_basicState.rsi)openSubPane('rsi');if(_basicState.vol)applyOverlay('vol');}

    document.querySelectorAll('#basicBar .ind-btn').forEach(btn=>{
      btn.addEventListener('click',()=>{
        const k=btn.dataset.bkey;
        _basicState[k]=!_basicState[k];
        btn.classList.toggle('active',_basicState[k]);
        if(k==='rsi'){_basicState[k]?openSubPane('rsi'):closeSubPane('rsi');}
        else{_basicState[k]?applyOverlay(k):removeOverlay(k);}
      });
    });

    // OVERLAY MANAGEMENT (trader)
    function _rm(k){if(_ovSeries[k]&&_lwChart){try{_lwChart.removeSeries(_ovSeries[k]);}catch{}delete _ovSeries[k];}}
    function removeOverlay(key){
      switch(key){
        case 'sma':_rm('sma');break;case 'ema':_rm('ema');break;
        case 'bb':_rm('bbU');_rm('bbL');_rm('bbM');break;
        case 'vwap':_rm('vwap');break;
        case 'ichimoku':_rm('iT');_rm('iK');_rm('iC');_rm('iA');_rm('iB');break;
        case 'vol':_rm('vol');break;
      }
    }
    function applyOverlay(key){
      if(!_lwChart||!_chartData?.length)return;
      removeOverlay(key);
      const cs=_chartData,p=_indState[key].period;
      const LS=LightweightCharts.LineStyle;
      function addLine(color,width,style,ps){return _lwChart.addLineSeries({color,lineWidth:width,lineStyle:style??LS.Solid,priceLineVisible:false,lastValueVisible:false,...(ps?{priceScaleId:ps}:{})});}
      switch(key){
        case 'sma':{const s=addLine('#3b82f6',1,LS.Dashed);s.setData(calcSMA(cs,p));_ovSeries.sma=s;break;}
        case 'ema':{const s=addLine('#a855f7',1,LS.Dotted);s.setData(calcEMA(cs,p));_ovSeries.ema=s;break;}
        case 'bb':{const{upper,lower,mid}=calcBB(cs,p);const sU=addLine('rgba(255,185,0,0.65)',1),sL=addLine('rgba(255,185,0,0.65)',1),sM=addLine('rgba(255,185,0,0.3)',1,LS.Dashed);sU.setData(upper);sL.setData(lower);sM.setData(mid);_ovSeries.bbU=sU;_ovSeries.bbL=sL;_ovSeries.bbM=sM;break;}
        case 'vwap':{const s=addLine('#f59e0b',1);s.setData(calcVWAP(cs));_ovSeries.vwap=s;break;}
        case 'ichimoku':{const{tenkan,kijun,chikou,spanA,spanB}=calcIchimoku(cs);const sT=addLine('#ef4444',1),sK=addLine('#3b82f6',1),sC=addLine('rgba(150,150,150,0.5)',1,LS.Dotted);const sA=addLine('rgba(0,255,65,0.35)',1),sB=addLine('rgba(255,68,68,0.35)',1);sT.setData(tenkan);sK.setData(kijun);sC.setData(chikou);sA.setData(spanA);sB.setData(spanB);_ovSeries.iT=sT;_ovSeries.iK=sK;_ovSeries.iC=sC;_ovSeries.iA=sA;_ovSeries.iB=sB;break;}
        case 'vol':{const s=_lwChart.addHistogramSeries({priceFormat:{type:'volume'},priceScaleId:'vol',lastValueVisible:false});s.priceScale().applyOptions({scaleMargins:{top:0.8,bottom:0}});s.setData(cs.map((c,i)=>({time:c.time,value:c.volume,color:i>0&&c.close>=cs[i-1].close?'rgba(0,255,65,0.25)':'rgba(255,68,68,0.25)'})));_ovSeries.vol=s;break;}
      }
    }

    // SUB-PANE MANAGEMENT
    const PANE_NAMES = {rsi:'RSI',macd:'MACD',stoch:'Stoch',willr:'W%R',atr:'ATR',obv:'OBV'};
    function openSubPane(key){
      if(_subPanes[key]||!_chartData?.length)return;
      const cs=_chartData,state=_indState[key];
      const pLabel=state.period?` ${state.period}`:'';
      const wrap=document.createElement('div');
      wrap.className='sub-pane';wrap.id=`pane-${key}`;
      wrap.innerHTML=`<div class="sub-pane-hdr"><span>${PANE_NAMES[key]}${pLabel}</span><button class="sub-pane-close" onclick="closeSubPane('${key}')" title="Close pane"><svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true"><path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></button></div><div class="sub-pane-chart" id="pane-c-${key}"></div>`;
      document.getElementById('subPanesWrap').appendChild(wrap);
      const el=document.getElementById(`pane-c-${key}`);
      const chart=LightweightCharts.createChart(el,{width:el.clientWidth,height:100,layout:{background:{type:'solid',color:'transparent'},textColor:'#6b7280',fontFamily:"'JetBrains Mono',monospace",fontSize:10},grid:{vertLines:{color:'rgba(255,255,255,0.03)'},horzLines:{color:'rgba(255,255,255,0.03)'}},rightPriceScale:{borderColor:'rgba(255,255,255,0.08)',textColor:'#6b7280',scaleMargins:{top:0.08,bottom:0.08}},timeScale:{borderColor:'rgba(255,255,255,0.08)',textColor:'#6b7280',visible:false},handleScroll:{mouseWheel:true,pressedMouseMove:true,horzTouchDrag:true},handleScale:{mouseWheel:true,pinch:true},crosshair:{mode:LightweightCharts.CrosshairMode.Normal}});
      _renderSubPane(key,chart,cs);
      let _s=false;
      const onMain=(r)=>{if(_s||!r)return;_s=true;try{chart.timeScale().setVisibleLogicalRange(r);}catch{}_s=false;};
      const onSub=(r)=>{if(_s||!r||!_lwChart)return;_s=true;try{_lwChart.timeScale().setVisibleLogicalRange(r);}catch{}_s=false;};
      _lwChart?.timeScale().subscribeVisibleLogicalRangeChange(onMain);
      chart.timeScale().subscribeVisibleLogicalRangeChange(onSub);
      const cur=_lwChart?.timeScale().getVisibleLogicalRange();
      if(cur)try{chart.timeScale().setVisibleLogicalRange(cur);}catch{}
      const ro=new ResizeObserver(()=>{try{chart.applyOptions({width:el.clientWidth});}catch{}});
      ro.observe(el);
      _subPanes[key]={chart,wrap,ro,onMain,onSub};
    }
    function _renderSubPane(key,chart,cs){
      const p=_indState[key].period||14;
      const LS=LightweightCharts.LineStyle;
      function line(color,w){return chart.addLineSeries({color,lineWidth:w??1.5,priceLineVisible:false,lastValueVisible:true});}
      switch(key){
        case 'rsi':{const data=calcRSI(cs,p);const s=line('#f59e0b');s.setData(data);if(data.length>=2){const t1=data[0].time,t2=data[data.length-1].time;chart.addLineSeries({color:'rgba(255,68,68,0.4)',lineWidth:1,lineStyle:LS.Dashed,priceLineVisible:false,lastValueVisible:false}).setData([{time:t1,value:70},{time:t2,value:70}]);chart.addLineSeries({color:'rgba(0,255,65,0.4)',lineWidth:1,lineStyle:LS.Dashed,priceLineVisible:false,lastValueVisible:false}).setData([{time:t1,value:30},{time:t2,value:30}]);}break;}
        case 'macd':{const{line:ml,signal:sl,hist:h}=calcMACD(cs);const hSeries=chart.addHistogramSeries({priceScaleId:'',priceLineVisible:false,lastValueVisible:false});hSeries.setData(h);line('#3b82f6').setData(ml);line('#ef4444',1).setData(sl);break;}
        case 'stoch':{const{K,D}=calcStoch(cs,p);line('#3b82f6').setData(K);line('#f59e0b',1).setData(D);break;}
        case 'willr':{line('#a855f7').setData(calcWilliamsR(cs,p));break;}
        case 'atr':{line('#f59e0b').setData(calcATR(cs,p));break;}
        case 'obv':{line('#00c8c8').setData(calcOBV(cs));break;}
      }
    }
    window.closeSubPane = function(key){
      const pane=_subPanes[key];if(!pane)return;
      try{_lwChart?.timeScale().unsubscribeVisibleLogicalRangeChange(pane.onMain);}catch{}
      try{pane.chart.timeScale().unsubscribeVisibleLogicalRangeChange(pane.onSub);}catch{}
      pane.ro.disconnect();try{pane.chart.remove();}catch{}
      pane.wrap.remove();delete _subPanes[key];
      _indState[key].on=false;
      document.querySelector(`.ind-btn[data-key="${key}"]`)?.classList.remove('active');
    };

    // NEWS
    let _allNewsItems = [];
    let _newsShowAll = false;
    function fmtPubDate(raw){if(!raw)return'';try{const d=typeof raw==='number'?new Date(raw*1000):new Date(raw);return d.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});}catch{return'';}}
    function renderNewsList(show){
      const list=document.getElementById('newsList');if(!list||!_allNewsItems.length)return;
      const sorted=[..._allNewsItems].sort((a,b)=>{const da=a.published_at?(typeof a.published_at==='number'?a.published_at*1000:new Date(a.published_at).getTime()):0;const db=b.published_at?(typeof b.published_at==='number'?b.published_at*1000:new Date(b.published_at).getTime()):0;return db-da;});
      const toShow=show?sorted:sorted.slice(0,3);
      const articlesHTML=toShow.map(n=>`<a class="news-item" href="${escHtml(n.url||'#')}" target="_blank" rel="noopener noreferrer">${n.thumbnail?`<img class="news-thumb" src="${escHtml(n.thumbnail)}" alt="" loading="lazy" onerror="this.style.display='none'">`:''}<div class="news-info"><div class="news-title">${escHtml(n.title)}</div><div class="news-meta">${escHtml(n.source||'')}${n.published_at?' · '+fmtPubDate(n.published_at):''}</div></div><svg class="news-ext" width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M2 10L10 2M10 2H5M10 2v5" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"/></svg></a>`).join('');
      const btnHTML=sorted.length>3?`<div style="padding:0.75rem 1rem;text-align:center;"><button class="btn btn-ghost btn-sm" onclick="window._toggleShowAllNews()">${show?'Show Less':'See All'}</button></div>`:'';
      list.innerHTML=articlesHTML+btnHTML;
    }
    async function loadNews(){
      const list=document.getElementById('newsList');if(!list)return;
      try{
        const items=await api.getNews(ticker,6);
        if(!items||!items.length){list.innerHTML='<div style="padding:1.5rem;text-align:center;font-size:.875rem;color:var(--text-muted);">No news available.</div>';return;}
        _allNewsItems=items;
        renderNewsList(false);
      }catch{list.innerHTML='<div style="padding:1.5rem;text-align:center;font-size:.875rem;color:var(--text-muted);">News unavailable.</div>';}
    }
    window._toggleShowAllNews=function(){
      _newsShowAll=!_newsShowAll;
      setShowAllNews(_newsShowAll);
      renderNewsList(_newsShowAll);
    };

    // ORDER BOOK
    async function loadOrderBook(){
      try{
        const data=await api.getOrderBook(ticker);
        const bids=data.bids??(data.bid!=null?[{price:data.bid,size:data.bid_volume??0}]:[]);
        const asks=data.asks??(data.ask!=null?[{price:data.ask,size:data.ask_volume??0}]:[]);
        const maxBidSz=Math.max(...bids.map(b=>b.size??0),1);
        const maxAskSz=Math.max(...asks.map(a=>a.size??0),1);
        function side(items,type){if(!items.length)return'<p style="font-size:.8125rem;color:var(--text-muted);">No data</p>';const mx=type==='bid'?maxBidSz:maxAskSz;return items.slice(0,8).map(item=>{const price=item.price??item.p??0;const size=item.size??item.quantity??item.s??0;const pct=(size/mx*100).toFixed(0);return`<div class="ob-row ob-${type}"><div class="ob-bar ob-${type}-bar" style="width:${pct}%"></div><span class="ob-price">$${fmt(price)}</span><span class="ob-size">${Number(size).toLocaleString()}</span></div>`;}).join('');}
        document.getElementById('bidsCol').innerHTML=side(bids,'bid');
        document.getElementById('asksCol').innerHTML=side(asks,'ask');
        if(bids.length&&asks.length){const spread=Math.abs((asks[0].price??0)-(bids[0].price??0));document.getElementById('obSpread').textContent=`Spread: $${spread.toFixed(3)}`;}
      }catch{const na='<p style="font-size:.8125rem;color:var(--text-muted);">Unavailable</p>';const bc=document.getElementById('bidsCol');const ac=document.getElementById('asksCol');if(bc)bc.innerHTML=na;if(ac)ac.innerHTML=na;}
    }

    // AI PREDICTION
    async function loadPrediction(){
      if(!api.isLoggedIn())return;
      const body=document.getElementById('predBody');
      body.innerHTML='<div style="display:flex;align-items:center;justify-content:center;padding:1.5rem;"><span class="spinner" style="width:28px;height:28px;"></span></div>';
      try{
        const data=await api.getPrediction(ticker);
        const signal=data.signal??'HOLD';const confidence=data.confidence??0;
        const riskLevel=data.risk_level??data.risk??'—';const reason=data.reason??data.reasoning??'';
        const{text:sigTxt,cls:sigCls}=fmtSignal(signal);
        body.innerHTML=`<div class="pred-signal-row"><span class="pred-signal-label">Signal</span><span class="signal ${sigCls}" style="font-size:1rem;">${sigTxt}</span></div><div class="confidence-bar-wrap"><div class="confidence-label-row"><span style="color:var(--text-muted);font-size:.8125rem;">Confidence</span><span style="font-family:var(--font-mono);font-size:.8125rem;color:var(--accent);">${Math.round(confidence)}%</span></div><div class="confidence-bar"><div class="confidence-fill" id="confFill" style="width:0%"></div></div></div><div class="pred-risk-row"><span class="pred-signal-label">Risk Level</span><span class="badge ${riskLevel==='high'?'badge-down':riskLevel==='low'?'badge-up':'badge-neutral'}">${escHtml(String(riskLevel))}</span></div>${reason?`<p class="pred-meta">${escHtml(reason)}</p>`:''}<button class="btn btn-ghost btn-sm" style="width:100%;" onclick="loadPrediction()">↺ Refresh</button>`;
        setTimeout(()=>{const f=document.getElementById('confFill');if(f)f.style.width=`${Math.round(confidence)}%`;},100);
      }catch(err){body.innerHTML=`<p style="font-size:.875rem;color:var(--text-muted);text-align:center;padding:1rem;">${escHtml(err.message)}</p><button class="btn btn-ghost btn-sm" style="width:100%;margin-top:.75rem;" onclick="loadPrediction()">Retry</button>`;}
    }
    window.loadPrediction = loadPrediction;

    // PREDICTION HISTORY
    async function loadPredHistory(){
      if(!api.isLoggedIn())return;
      const content=document.getElementById('histContent');if(!content)return;
      content.innerHTML='<div style="padding:1.5rem;text-align:center;"><span class="spinner"></span></div>';
      try{
        const data=await api.getPredictionHistory(ticker,10);
        const items=Array.isArray(data)?data:(data.history||[]);
        if(!items.length){content.innerHTML=`<div class="hist-locked-msg">No prediction history yet for ${escHtml(ticker)}.</div>`;return;}
        content.innerHTML=`<table class="hist-table"><thead><tr><th>Date</th><th>Signal</th><th>Confidence</th><th>Risk</th></tr></thead><tbody>${items.map(item=>{const{text:st,cls:sc}=fmtSignal(item.signal);const conf=item.confidence!=null?`${Math.round(item.confidence)}%`:'—';const risk=item.risk_level??item.risk??'—';const date=item.created_at?new Date(item.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'2-digit'}):'—';return`<tr><td style="font-family:var(--font-mono);font-size:.8125rem;color:var(--text-muted);">${date}</td><td><span class="signal ${sc}" style="font-size:.75rem;">${st}</span></td><td style="font-family:var(--font-mono);font-size:.8125rem;">${conf}</td><td><span class="badge badge-neutral" style="font-size:.75rem;">${escHtml(String(risk))}</span></td></tr>`;}).join('')}</tbody></table>`;
      }catch{const c2=document.getElementById('histContent');if(c2)c2.innerHTML='<div class="hist-locked-msg">Could not load prediction history.</div>';}
    }

    // FUNDAMENTAL ANALYSIS
    async function loadFundamentals(){
      const grid=document.getElementById('fundGrid');const desc=document.getElementById('fundDesc');if(!grid)return;
      function fmtLarge(n){if(n==null)return'—';const v=Number(n);if(isNaN(v))return'—';if(v>=1e12)return`$${(v/1e12).toFixed(2)}T`;if(v>=1e9)return`$${(v/1e9).toFixed(2)}B`;if(v>=1e6)return`$${(v/1e6).toFixed(2)}M`;return`$${fmt(v)}`;}
      function fmtPct(n){if(n==null)return'—';const v=Number(n);return isNaN(v)?'—':`${(v*100).toFixed(2)}%`;}
      function fmtNum(n,dp=2){if(n==null)return'—';const v=Number(n);return isNaN(v)?'—':v.toFixed(dp);}
      function tile(label,value,cls=''){return`<div class="fund-tile"><div class="fund-tile-label">${label}</div><div class="fund-tile-value ${cls}">${value}</div></div>`;}
      try{
        const d=await api.getFundamentals(ticker);
        const pmCls=d.profit_margin==null?'':Number(d.profit_margin)>=0?'pos':'neg';
        const roeCls=d.roe==null?'':Number(d.roe)>=0?'pos':'neg';
        grid.innerHTML=[tile('Market Cap',fmtLarge(d.market_cap)),tile('P/E Ratio',fmtNum(d.pe_ratio)),tile('Forward P/E',fmtNum(d.forward_pe)),tile('EPS (TTM)',d.eps!=null?`$${fmtNum(d.eps)}`:'—',Number(d.eps)>=0?'pos':'neg'),tile('Revenue (TTM)',fmtLarge(d.revenue)),tile('Profit Margin',fmtPct(d.profit_margin),pmCls),tile('Div. Yield',d.dividend_yield!=null?fmtPct(d.dividend_yield):'—'),tile('Beta',fmtNum(d.beta)),tile('52W High',d.week52_high!=null?`$${fmt(Number(d.week52_high))}`:'—'),tile('52W Low',d.week52_low!=null?`$${fmt(Number(d.week52_low))}`:'—'),tile('ROE',fmtPct(d.roe),roeCls),tile('Debt / Equity',fmtNum(d.debt_to_equity))].join('');
        if(d.description){desc.textContent=d.description;}else{desc.style.display='none';}
      }catch{grid.innerHTML='<p style="color:var(--text-muted);font-size:.875rem;grid-column:1/-1;">Fundamental data unavailable.</p>';if(desc)desc.style.display='none';}
    }

    // BOOT
    applyRoleGating();
    loadStockInfo();
    loadChart(cfg.defaultPeriod);
    refreshPrice();
    initHoverSidebar();
    initAvatarDropdown();
    populateAvatar();

    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', onFullscreenChange);
      if (_scrollDragCleanup) _scrollDragCleanup();
      if (_chartRo) _chartRo.disconnect();
      Object.keys(_subPanes).forEach(k => { try { _subPanes[k].chart.remove(); } catch {} });
      if (_lwChart) { try { _lwChart.remove(); } catch {} _lwChart = null; }
    };
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      {/* Sidebar */}
      <div className="sidebar-overlay" id="sidebarOverlay" onClick={() => closeSidebar()}></div>
      <aside className="sidebar" id="sidebar">
        <div className="sidebar-header">
          <a href="/" className="sidebar-logo">
            <svg width="24" height="24" viewBox="0 0 28 28" fill="none"><rect width="28" height="28" rx="6" fill="#00ff41" fillOpacity="0.12"/><polyline points="5,18 10,12 14,15 19,8 23,11" stroke="#00ff41" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><circle cx="23" cy="11" r="2" fill="#00ff41"/></svg>
            StockWise <em>AI</em>
          </a>
          <button className="sidebar-close" onClick={() => closeSidebar()}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </button>
        </div>
        <div className="sidebar-body">
          <nav className="sidebar-nav-top">
            <a href="/dashboard" className="sidebar-link">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.25"/><rect x="9" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.25"/><rect x="2" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.25"/><rect x="9" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.25"/></svg>
              Dashboard
            </a>
            <a href="/alerts" className="sidebar-link">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 1.5a5.5 5.5 0 00-5.5 5.5v3l-1 1.5h13l-1-1.5V7A5.5 5.5 0 008 1.5z" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round"/><path d="M6.5 12.5a1.5 1.5 0 003 0" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/></svg>
              Alerts
            </a>
            <a href="/settings" className="sidebar-link">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.25"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M2.93 2.93l1.41 1.41M11.66 11.66l1.41 1.41M2.93 13.07l1.41-1.41M11.66 4.34l1.41-1.41" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/></svg>
              Settings
            </a>
          </nav>
          <nav className="sidebar-nav-bottom">
            <div className="sidebar-divider"></div>
            <a href="/help" className="sidebar-link">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.25"/><path d="M8 11v.5M8 5a2 2 0 010 4" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/></svg>
              Help
            </a>
            <button className="sidebar-link danger" onClick={() => api.logout()} style={{background:'none',border:'none',width:'100%',textAlign:'left',cursor:'pointer',fontFamily:'inherit'}}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 2h2a2 2 0 012 2v8a2 2 0 01-2 2h-2" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/><path d="M7 11l-3-3 3-3M4 8h8" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Log Out
            </button>
          </nav>
        </div>
      </aside>

      {/* Navbar */}
      <nav className="navbar">
        <div className="navbar-inner">
          <a href="/" className="logo-btn">
            <svg width="26" height="26" viewBox="0 0 28 28" fill="none"><rect width="28" height="28" rx="6" fill="#00ff41" fillOpacity="0.12"/><polyline points="5,18 10,12 14,15 19,8 23,11" stroke="#00ff41" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><circle cx="23" cy="11" r="2" fill="#00ff41"/></svg>
            StockWise <em>AI</em>
          </a>
          <div className="navbar-actions">
            <div className="guest-only" style={{display:'flex',gap:'0.5rem',alignItems:'center'}}>
              <a href="/login" className="btn btn-ghost btn-sm">Sign In</a>
              <a href="/register" className="btn btn-accent btn-sm">Get Started</a>
            </div>
            <div className="nav-avatar-wrap" id="avatarWrap" style={{display:'none'}}>
              <button className="nav-avatar-btn" id="avatarBtn" aria-expanded="false" aria-haspopup="true">
                <span className="nav-avatar" id="navAvatar">?</span>
                <span id="navAvatarName">Account</span>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
              <div className="nav-dropdown" id="navDropdown" role="menu">
                <div className="nav-dropdown-user"><span id="ddName">—</span><span id="ddEmail" className="muted">—</span></div>
                <div className="nav-dropdown-divider"></div>
                <a href="/account" className="nav-dropdown-item">
                  <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><circle cx="7.5" cy="5" r="3" stroke="currentColor" strokeWidth="1.2"/><path d="M2 13c0-3.038 2.462-5.5 5.5-5.5S13 9.962 13 13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
                  My Account
                </a>
                <div className="nav-dropdown-divider"></div>
                <button className="nav-dropdown-item danger" onClick={() => api.logout()}>
                  <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M9.5 2h2a1.5 1.5 0 011.5 1.5v8A1.5 1.5 0 0111.5 13h-2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/><path d="M6.5 10.5L4 8l2.5-2.5M4 8h7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  Log Out
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <div className="stock-page">
        <div className="stock-container">

          {/* Back bar */}
          <div className="back-bar">
            <button className="back-btn" onClick={() => history.back()}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Back
            </button>
            <div className="breadcrumb">
              <a href="/dashboard" style={{color:'inherit'}}>Dashboard</a>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/></svg>
              <span id="breadTicker">…</span>
            </div>
          </div>

          {/* Stock header */}
          <div className="stock-header">
            <div className="stock-header-left">
              <div className="stock-icon" id="stockIcon">—</div>
              <div>
                <div className="stock-header-name" id="stockName">Loading…</div>
                <div className="stock-header-company" id="stockCompany"></div>
                <div className="stock-header-meta" id="stockMeta"></div>
              </div>
            </div>
            <div className="stock-header-price">
              <div className="price-big" id="priceBig">—</div>
              <div className="price-change-row" id="priceChangeRow">
                <div className="skeleton" style={{width:'80px',height:'22px'}}></div>
              </div>
            </div>
          </div>

          {/* Content grid */}
          <div className="content-grid">

            {/* Left column */}
            <div className="content-left">

              {/* Investor tab navigation — only rendered for investor role */}
              {role === 'investor' && (
                <div className="investor-tabs">
                  <button className={`investor-tab-btn${activeTab === 'overview' ? ' active' : ''}`} onClick={() => setActiveTab('overview')}>Overview</button>
                  <button className={`investor-tab-btn${activeTab === 'fundamentals' ? ' active' : ''}`} onClick={() => setActiveTab('fundamentals')}>Fundamentals</button>
                  <button className={`investor-tab-btn${activeTab === 'news' ? ' active' : ''}`} onClick={() => setActiveTab('news')}>News</button>
                  <button className={`investor-tab-btn${activeTab === 'orderbook' ? ' active' : ''}`} onClick={() => setActiveTab('orderbook')}>Order Book</button>
                  <button className={`investor-tab-btn${activeTab === 'history' ? ' active' : ''}`} onClick={() => setActiveTab('history')}>Prediction History</button>
                </div>
              )}

              {/* Chart */}
              <div className="chart-card" id="chartCard" style={role === 'investor' ? {display: activeTab === 'overview' ? '' : 'none'} : undefined}>
                <div className="chart-header">
                  <div>
                    <div style={{fontSize:'0.9375rem',fontWeight:600}} id="chartTitle">Price History</div>
                    <div style={{fontSize:'0.8125rem',color:'var(--text-muted)'}} id="chartSub">Loading data…</div>
                  </div>
                  <div className="chart-header-right">
                    <div className="period-tabs" id="periodTabs" role="group" aria-label="Chart period">
                      <button className="period-tab" data-period="1D" title="Daily candles — last 1 week">1D</button>
                      <button className="period-tab" data-period="1W" title="Weekly candles — last 1 year">1W</button>
                      <button className="period-tab" data-period="1M" title="Monthly candles — last 1 year">1M</button>
                      <button className="period-tab" data-period="3M" title="Quarterly candles — last 1 year">3M</button>
                      <button className="period-tab" data-period="1Y" title="Yearly candles — last 1 year">1Y</button>
                    </div>
                    <button className="chart-fullscreen-btn" id="fullscreenBtn" title="Fullscreen" onClick={() => window.toggleFullscreen()}>
                      <svg id="fsIcon" width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M1 5V1h4M9 1h4v4M13 9v4H9M5 13H1V9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                  </div>
                </div>
                {/* Indicator toggle bar — Trader only */}
                <div className="ind-bar" id="indBar" style={{display: isTrader ? '' : 'none'}}>
                  <span className="ind-bar-label">Overlays</span>
                  <div className="ind-bar-sep"></div>
                  <button className="ind-btn" data-key="sma">SMA<input className="ind-period" type="number" data-key="sma" defaultValue="20" min="2" max="500" /></button>
                  <button className="ind-btn" data-key="ema">EMA<input className="ind-period" type="number" data-key="ema" defaultValue="20" min="2" max="500" /></button>
                  <button className="ind-btn" data-key="bb">BB<input className="ind-period" type="number" data-key="bb" defaultValue="20" min="2" max="500" /></button>
                  <button className="ind-btn" data-key="vwap">VWAP</button>
                  <button className="ind-btn" data-key="ichimoku">Ichimoku</button>
                  <div className="ind-bar-sep"></div>
                  <span className="ind-bar-label">Panes</span>
                  <div className="ind-bar-sep"></div>
                  <button className="ind-btn" data-key="rsi">RSI<input className="ind-period" type="number" data-key="rsi" defaultValue="14" min="2" max="100" /></button>
                  <button className="ind-btn" data-key="macd">MACD</button>
                  <button className="ind-btn" data-key="stoch">Stoch<input className="ind-period" type="number" data-key="stoch" defaultValue="14" min="2" max="100" /></button>
                  <button className="ind-btn" data-key="willr">W%R<input className="ind-period" type="number" data-key="willr" defaultValue="14" min="2" max="100" /></button>
                  <button className="ind-btn" data-key="atr">ATR<input className="ind-period" type="number" data-key="atr" defaultValue="14" min="2" max="100" /></button>
                  <button className="ind-btn" data-key="obv">OBV</button>
                  <button className="ind-btn" data-key="vol">Volume</button>
                </div>
                {/* Indicator toggle bar — Guest / Investor */}
                <div className="ind-bar" id="basicBar" style={{display: isTrader ? 'none' : ''}}>
                  <button className="ind-btn" data-bkey="sma">SMA 20</button>
                  <button className="ind-btn" data-bkey="ema">EMA 20</button>
                  <button className="ind-btn" data-bkey="rsi">RSI</button>
                  <button className="ind-btn" data-bkey="vol">Volume</button>
                </div>
                <div className="chart-body">
                  <div className="chart-loading" id="chartLoading">
                    <span className="spinner" style={{width:'28px',height:'28px'}}></span>
                  </div>
                  <div id="priceChart" aria-label="Price history chart" style={{position:'relative'}}></div>
                  <div id="subPanesWrap"></div>
                  <div id="chartScrollBar" className="chart-scrollbar"><div id="chartScrollThumb" className="chart-scrollbar-thumb"></div></div>
                </div>
              </div>

              {/* Technical indicators (hidden — replaced by toggle bar) */}
              <div className="card" id="indicatorsCard" style={{display:'none'}}>
                <div className="card-header">
                  <div>
                    <div className="card-title">Technical Indicators</div>
                    <div className="card-sub" id="indicatorsPeriod">Loading…</div>
                  </div>
                </div>
                <div className="card-body">
                  <div className="indicators-grid" id="indicatorsGrid">
                    <div className="indicator-item"><div className="indicator-name">RSI 14</div><div className="skeleton" style={{height:'24px',marginTop:'4px'}}></div></div>
                    <div className="indicator-item"><div className="indicator-name">SMA 20</div><div className="skeleton" style={{height:'24px',marginTop:'4px'}}></div></div>
                    <div className="indicator-item"><div className="indicator-name">EMA 20</div><div className="skeleton" style={{height:'24px',marginTop:'4px'}}></div></div>
                    <div className="indicator-item"><div className="indicator-name">Volume</div><div className="skeleton" style={{height:'24px',marginTop:'4px'}}></div></div>
                  </div>
                </div>
              </div>

              <div id="fundamentalsSection" style={role === 'investor' ? {display: activeTab === 'fundamentals' ? '' : 'none'} : undefined}></div>
              <div id="newsSection" style={role === 'investor' ? {display: activeTab === 'news' ? '' : 'none'} : undefined}></div>
              <div id="orderbookSection" style={role === 'investor' ? {display: activeTab === 'orderbook' ? '' : 'none'} : undefined}></div>
              <div id="histSection" style={role === 'investor' ? {display: activeTab === 'history' ? '' : 'none'} : undefined}></div>

            </div>{/* /content-left */}

            {/* Right column */}
            <div className="content-right">

              {/* AI Prediction */}
              <div className="prediction-card">
                <div className="prediction-header">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="var(--accent)" strokeWidth="1.25"/><path d="M5 8l2 2 4-4" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  <div className="prediction-header-title">AI Prediction</div>
                  <div className="prediction-powered">XGBoost</div>
                </div>
                <div className="prediction-body" id="predBody">
                  <div className="pred-locked">
                    <svg width="36" height="36" viewBox="0 0 36 36" fill="none"><rect x="8" y="16" width="20" height="16" rx="4" stroke="currentColor" strokeWidth="1.5"/><path d="M12 16v-5a6 6 0 0112 0v5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                    <p>Sign in to access AI price predictions and BUY/SELL/HOLD signals.</p>
                    <a href="/login" className="btn btn-accent btn-sm" style={{marginTop:'0.25rem'}}>Sign In to Unlock</a>
                  </div>
                </div>
              </div>

              {/* Live Quote */}
              <div className="card">
                <div className="card-header">
                  <div className="card-title">Live Quote</div>
                  <button className="btn btn-icon btn-sm" onClick={() => window.refreshPrice()} title="Refresh">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M12 7A5 5 0 112 7" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/><path d="M12 3v4H8" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </button>
                </div>
                <div className="card-body" id="liveQuoteBody">
                  <div className="skeleton" style={{height:'80px'}}></div>
                </div>
              </div>

            </div>{/* /content-right */}

          </div>{/* /content-grid */}

        </div>
      </div>

      <div id="toast-container"></div>
    </>
  )
}

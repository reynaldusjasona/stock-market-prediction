const MOCK_DELAY = 350   

const USERS = [
  { id:'u1',  name:'Alex Rivera',   email:'a.rivera@quantmail.ai',  status:'active',    is_suspended:false, subscription_status:'active',  subscription_expires_at:'2026-12-31T00:00:00Z', created_at:'2026-03-12T10:00:00Z', last_login:'2026-06-29T08:00:00Z' },
  { id:'u2',  name:'Sarah Jenkins', email:'s.jenkins@quantmail.ai', status:'suspended', is_suspended:true,  subscription_status:'active',  subscription_expires_at:'2026-11-15T00:00:00Z', created_at:'2026-03-02T08:30:00Z', last_login:'2026-05-10T14:00:00Z', suspension_reason:'Repeated policy violations' },
  { id:'u3',  name:'Elena Zhao',    email:'e.zhao@quantmail.ai',    status:'active',    is_suspended:false, subscription_status:'active',  subscription_expires_at:'2026-09-01T00:00:00Z', created_at:'2026-03-15T14:20:00Z', last_login:'2026-06-30T11:00:00Z' },
  { id:'u4',  name:'Marcus Brown',  email:'m.brown@quantmail.ai',   status:'active',    is_suspended:false, subscription_status:'expired', subscription_expires_at:'2026-05-30T00:00:00Z', created_at:'2026-02-20T09:15:00Z', last_login:'2026-05-29T09:00:00Z' },
  { id:'u5',  name:'Priya Nair',    email:'p.nair@quantmail.ai',    status:'active',    is_suspended:false, subscription_status:'active',  subscription_expires_at:'2026-08-20T00:00:00Z', created_at:'2026-02-28T11:45:00Z', last_login:'2026-06-27T16:00:00Z' },
  { id:'u6',  name:'James Okonkwo', email:'j.okonkwo@quantmail.ai', status:'active',    is_suspended:false, subscription_status:'expired', subscription_expires_at:'2026-05-01T00:00:00Z', created_at:'2026-01-15T07:30:00Z', last_login:'2026-04-30T08:00:00Z' },
  { id:'u7',  name:'Li Wei',        email:'l.wei@quantmail.ai',     status:'suspended', is_suspended:true,  subscription_status:'active',  subscription_expires_at:'2026-10-22T00:00:00Z', created_at:'2026-01-22T16:00:00Z', last_login:'2026-03-01T10:00:00Z', suspension_reason:'Spam activity detected' },
  { id:'u8',  name:'Fatima Hassan', email:'f.hassan@quantmail.ai',  status:'active',    is_suspended:false, subscription_status:'active',  subscription_expires_at:'2027-01-10T00:00:00Z', created_at:'2025-12-10T13:20:00Z', last_login:'2026-06-30T07:30:00Z' },
  { id:'u9',  name:'Tom Nguyen',    email:'t.nguyen@quantmail.ai',  status:'active',    is_suspended:false, subscription_status:'expired', subscription_expires_at:'2026-06-01T00:00:00Z', created_at:'2025-12-18T10:10:00Z', last_login:'2026-05-31T12:00:00Z' },
  { id:'u10', name:'Anya Patel',    email:'a.patel@quantmail.ai',   status:'active',    is_suspended:false, subscription_status:'active',  subscription_expires_at:'2026-07-15T00:00:00Z', created_at:'2025-11-05T09:00:00Z', last_login:'2026-06-28T18:00:00Z' },
]

const APIS = [
  { id:'api1', name:'yfinance',       base_url:'https://query1.finance.yahoo.com/v8', purpose:'Historical OHLCV data for ML training', rate_limit:100, is_active:true  },
  { id:'api2', name:'Alpha Vantage',  base_url:'https://www.alphavantage.co/query',   purpose:'Real-time stock quotes and indicators',  rate_limit:5,   is_active:true  },
  { id:'api3', name:'NewsAPI',        base_url:'https://newsapi.org/v2',               purpose:'Financial news sentiment analysis',       rate_limit:100, is_active:false },
  { id:'api4', name:'Polygon.io',     base_url:'https://api.polygon.io/v2',            purpose:'Market data backup source',               rate_limit:200, is_active:true  },
]

const FEEDBACK = [
  { id:'fb1', user_name:'Alex Rivera',   user_email:'a.rivera@quantmail.ai',  message:'The AI predictions are incredibly accurate. Helped me make better investment decisions this quarter.', rating:5, status:'pending',  created_at:'2026-06-10T08:00:00Z' },
  { id:'fb2', user_name:'Sarah Jenkins', user_email:'s.jenkins@quantmail.ai', message:'Great platform overall. The chart tools could use some improvement but the predictions are solid.', rating:4, status:'approved', created_at:'2026-06-08T14:30:00Z' },
  { id:'fb3', user_name:'Elena Zhao',    user_email:'e.zhao@quantmail.ai',    message:'Sometimes the app is slow to load on mobile. Desktop experience is excellent though.', rating:3, status:'pending',  created_at:'2026-06-12T09:15:00Z' },
  { id:'fb4', user_name:'Marcus Brown',  user_email:'m.brown@quantmail.ai',   message:'BUY CRYPTO NOW!!! This is spam content that should be rejected.', rating:1, status:'rejected', created_at:'2026-06-05T11:00:00Z' },
  { id:'fb5', user_name:'Priya Nair',    user_email:'p.nair@quantmail.ai',    message:'Fantastic tool for novice investors. The risk indicators are very helpful and easy to understand.', rating:5, status:'pending',  created_at:'2026-06-13T16:45:00Z' },
  { id:'fb6', user_name:'James Okonkwo', user_email:'j.okonkwo@quantmail.ai', message:'Portfolio tracking feature works great. Would love to see more emerging market coverage.', rating:4, status:'approved', created_at:'2026-06-01T10:20:00Z' },
]

const ALERTS = [
  { id:'al1', severity:'critical', message:'Model accuracy dropped below 65% threshold', source:'ML Pipeline',   details:'XGBoost model accuracy: 63.2%. Last 48h evaluation. Recommend immediate retraining.',  status:'open',     is_resolved:false, created_at:'2026-06-14T06:00:00Z' },
  { id:'al2', severity:'warning',  message:'yfinance API rate limit at 87% capacity',    source:'API Monitor',  details:'Rate: 87/100 req/min. Consider upgrading plan or adding backup source.',              status:'open',     is_resolved:false, created_at:'2026-06-14T07:30:00Z' },
  { id:'al3', severity:'info',     message:'Scheduled database backup completed',         source:'DB Service',   details:'Backup size: 2.3 GB. Duration: 4m 12s. Stored in backup-2026-06-14.tar.gz.',         status:'resolved', is_resolved:true,  created_at:'2026-06-14T02:00:00Z' },
  { id:'al4', severity:'warning',  message:'3 failed login attempts detected',            source:'Auth Service', details:'IP: 203.45.67.89. Attempts at 05:12, 05:13, 05:14 UTC. Account: admin@stockwise.ai.', status:'open',     is_resolved:false, created_at:'2026-06-14T05:15:00Z' },
  { id:'al5', severity:'info',     message:'New user registrations +24% this week',       source:'Analytics',    details:'Weekly signups: 312 vs 251 last week. Top acquisition: organic search.',               status:'resolved', is_resolved:true,  created_at:'2026-06-13T23:00:00Z' },
  { id:'al6', severity:'critical', message:'NewsAPI returning 503 errors',                source:'API Monitor',  details:'NewsAPI /everything endpoint returning 503 since 09:45 UTC. Sentiment analysis paused.', status:'open',   is_resolved:false, created_at:'2026-06-14T09:45:00Z' },
]

let LANDING = {
  hero:     { headline:'Make smarter investment decisions', subline:'AI-powered predictions, real-time market data, and personalised insights to help you invest with confidence.', cta_label:'Get Started Free' },
  features: [
    { title:'AI Price Predictions', body:'XGBoost model with 78% directional accuracy on T+1 horizon.' },
    { title:'Real-Time Data',        body:'Live market data and technical indicators updated every minute.' },
    { title:'Risk Profiling',        body:'Personalised to your risk tolerance and sector preferences.' },
    { title:'Interactive Charts',    body:'Candlestick charts with order book depth and indicator overlays.' },
  ],
  footer: { tagline:'All features are completely free with no subscription.' },
  meta:   { title:'StockWise AI — AI Stock Predictions', description:'AI-powered stock predictions and real-time market data.' },
}

let MODEL_PERF = {
  accuracy:0.781, precision:0.764, recall:0.799, f1_score:0.781, mae:0.0312, rmse:0.0487,
  last_trained_at:'2026-06-10T02:00:00Z', training_samples:18420, model_version:'v2.4.1',
  history:[
    { evaluated_at:'2026-06-14T00:00:00Z', accuracy:0.781, precision:0.764, recall:0.799, f1_score:0.781, mae:0.0312 },
    { evaluated_at:'2026-06-13T00:00:00Z', accuracy:0.775, precision:0.758, recall:0.792, f1_score:0.775, mae:0.0318 },
    { evaluated_at:'2026-06-12T00:00:00Z', accuracy:0.769, precision:0.751, recall:0.787, f1_score:0.769, mae:0.0325 },
    { evaluated_at:'2026-06-11T00:00:00Z', accuracy:0.783, precision:0.770, recall:0.796, f1_score:0.783, mae:0.0309 },
    { evaluated_at:'2026-06-10T00:00:00Z', accuracy:0.791, precision:0.778, recall:0.804, f1_score:0.791, mae:0.0298 },
    { evaluated_at:'2026-06-09T00:00:00Z', accuracy:0.762, precision:0.744, recall:0.780, f1_score:0.762, mae:0.0334 },
    { evaluated_at:'2026-06-08T00:00:00Z', accuracy:0.748, precision:0.731, recall:0.765, f1_score:0.748, mae:0.0351 },
    { evaluated_at:'2026-06-07T00:00:00Z', accuracy:0.756, precision:0.740, recall:0.772, f1_score:0.756, mae:0.0342 },
  ],
}

// ─── Mutable copies (so edits/deletes persist during session) ─────
let mockUsers    = [...USERS]
let mockApis     = [...APIS]
let mockFeedback = [...FEEDBACK]
let mockAlerts   = [...ALERTS]
let retrainJob   = null   
let mockPins     = {}     


const delay  = () => new Promise(r => setTimeout(r, MOCK_DELAY))
const ok     = (data)  => new Response(JSON.stringify(data),       { status:200, headers:{'Content-Type':'application/json'} })
const err    = (msg, status=400) => new Response(JSON.stringify({ detail: msg }), { status, headers:{'Content-Type':'application/json'} })


function matchRoute(method, url) {
  const u = new URL(url, 'http://localhost')
  const p = u.pathname.replace(/^\/api/, '')
  const q = u.searchParams

 
  if (method==='POST' && p==='/auth/login') return async (body) => {
    const { email, password } = body

   
    if (email === 'sennett.faria@gmail.com' && password === 'Sennett123') {
      return ok({ token:'mock_jwt_admin_token_sennett', user:{ id:'admin2', name:'Sennett Faria', email, role:'admin' } })
    }

  
    if (email?.endsWith('@stockwise.ai') && password === 'admin123') {
      return ok({ token:'mock_jwt_admin_token_xyz', user:{ id:'admin1', name:'Admin Alpha', email, role:'admin' } })
    }

    return err('Invalid email or password', 401)
  }
  if (method==='POST' && p==='/auth/logout') return async () => ok({ message:'Logged out' })

 
  if (method==='POST' && p==='/auth/send-2fa') return async (body) => {
    const pin = String(Math.floor(100000 + Math.random() * 900000))
   
    mockPins[body.email] = { pin, expires: Date.now() + 10 * 60 * 1000 }
    console.log(`%c[MOCK 2FA] PIN for ${body.email}: ${pin}`, 'color:#00ff41;font-size:1.2rem;font-weight:bold;')
    return ok({ message: 'PIN sent to email' })
  }

  if (method==='POST' && p==='/auth/verify-2fa') return async (body) => {
    const record = mockPins[body.email]
    if (!record)               return err('No PIN found. Please request a new one.', 400)
    if (Date.now() > record.expires) return err('PIN has expired. Please request a new one.', 400)
    if (body.code !== record.pin)    return err('Invalid PIN. Please try again.', 400)
    delete mockPins[body.email]
    return ok({ message: 'Verified' })
  }

  if (method==='POST' && p==='/auth/reset-password') return async (body) => {
    return ok({ message:`Reset link sent to ${body.email}` })
  }

  
  if (method==='GET' && p==='/admin/stats') return async () => ok({
    total_users:     mockUsers.length,
    active_users:    mockUsers.filter(u=>!u.is_suspended).length,
    suspended_users: mockUsers.filter(u=>u.is_suspended).length,
    model_accuracy:  MODEL_PERF.accuracy * 100,
    pending_feedback:mockFeedback.filter(f=>f.status==='pending').length,
    open_alerts:     mockAlerts.filter(a=>!a.is_resolved).length,
  })

  
  if (method==='GET' && p==='/admin/users') return async () => {
    const search = (q.get('q')||'').toLowerCase()
    const result = search
      ? mockUsers.filter(u => u.name.toLowerCase().includes(search) || u.email.toLowerCase().includes(search))
      : mockUsers
    return ok(result)
  }
  const umatch = p.match(/^\/admin\/users\/([^/]+)$/)
  if (method==='GET' && umatch) return async () => {
    const u = mockUsers.find(x=>x.id===umatch[1])
    return u ? ok(u) : err('User not found',404)
  }
  if (method==='PATCH' && umatch) return async (body) => {
    const idx = mockUsers.findIndex(x=>x.id===umatch[1])
    if(idx===-1) return err('User not found',404)
    mockUsers[idx] = { ...mockUsers[idx], ...body }
    return ok(mockUsers[idx])
  }
  if (method==='DELETE' && umatch) return async () => {
    const idx = mockUsers.findIndex(x=>x.id===umatch[1])
    if(idx===-1) return err('User not found',404)
    mockUsers.splice(idx,1)
    return ok({ message:'Deleted' })
  }
  const susmatch = p.match(/^\/admin\/users\/([^/]+)\/suspend$/)
  if (method==='PATCH' && susmatch) return async (body) => {
    const u=mockUsers.find(x=>x.id===susmatch[1])
    if(!u) return err('Not found',404)
    u.is_suspended=true; u.status='suspended'; u.suspension_reason=body?.reason||''
    return ok(u)
  }
  const unsusmatch = p.match(/^\/admin\/users\/([^/]+)\/unsuspend$/)
  if (method==='PATCH' && unsusmatch) return async () => {
    const u=mockUsers.find(x=>x.id===unsusmatch[1])
    if(!u) return err('Not found',404)
    u.is_suspended=false; u.status='active'
    return ok(u)
  }

 
  if (method==='GET' && p==='/admin/landing')  return async () => ok(LANDING)
  if (method==='PUT' && p==='/admin/landing')  return async (body) => { LANDING={...LANDING,...body}; return ok(LANDING) }


  if (method==='GET' && p==='/admin/model/performance') return async () => ok(MODEL_PERF)
  if (method==='GET' && p==='/admin/model/quality')     return async () => ok(MODEL_PERF.history)
  if (method==='GET' && p==='/admin/model/config')      return async () => ok({
    good_threshold:     75,   // accuracy % considered good
    moderate_threshold: 60,   // accuracy % considered moderate (below = poor)
    chart_limit:        24,   // max data points shown in trend chart
    table_limit:        30,   // max rows shown in history table
  })
  if (method==='POST' && p==='/admin/model/retrain')    return async (body) => {
    retrainJob = { job_id:`job_${Date.now()}`, status:'running', started_at:new Date().toISOString() }

    setTimeout(()=>{ if(retrainJob) retrainJob.status='completed' }, 12000)
    return ok(retrainJob)
  }
  if (method==='GET' && p==='/admin/model/retrain/status') return async () => {
    return ok(retrainJob || { status:'idle' })
  }

  if (method==='GET' && p==='/admin/apis')  return async () => ok(mockApis)
  if (method==='POST' && p==='/admin/apis') return async (body) => {
    const newApi = { ...body, id:`api${Date.now()}`, is_active: body.is_active!==false }
    mockApis.push(newApi); return ok(newApi)
  }
  const apimatch = p.match(/^\/admin\/apis\/([^/]+)$/)
  if (method==='GET' && apimatch) return async () => {
    const a=mockApis.find(x=>x.id===apimatch[1]); return a?ok(a):err('Not found',404)
  }
  if (method==='PATCH' && apimatch) return async (body) => {
    const idx=mockApis.findIndex(x=>x.id===apimatch[1]); if(idx===-1) return err('Not found',404)
    mockApis[idx]={...mockApis[idx],...body}; return ok(mockApis[idx])
  }
  if (method==='DELETE' && apimatch) return async () => {
    const idx=mockApis.findIndex(x=>x.id===apimatch[1]); if(idx===-1) return err('Not found',404)
    mockApis.splice(idx,1); return ok({message:'Deleted'})
  }

  if (method==='GET' && p==='/admin/feedback') return async () => {
    const search=(q.get('q')||'').toLowerCase()
    const result=search ? mockFeedback.filter(f=>f.user_name.toLowerCase().includes(search)||f.message.toLowerCase().includes(search)) : mockFeedback
    return ok(result)
  }
  const fbmatch = p.match(/^\/admin\/feedback\/([^/]+)$/)
  if (method==='GET' && fbmatch) return async () => {
    const f=mockFeedback.find(x=>x.id===fbmatch[1]); return f?ok(f):err('Not found',404)
  }
  const fbapp = p.match(/^\/admin\/feedback\/([^/]+)\/approve$/)
  if (method==='PATCH' && fbapp) return async () => {
    const f=mockFeedback.find(x=>x.id===fbapp[1]); if(!f) return err('Not found',404)
    f.status='approved'; return ok(f)
  }
  const fbrej = p.match(/^\/admin\/feedback\/([^/]+)\/reject$/)
  if (method==='PATCH' && fbrej) return async (body) => {
    const f=mockFeedback.find(x=>x.id===fbrej[1]); if(!f) return err('Not found',404)
    f.status='rejected'; f.rejection_reason=body?.reason||''; return ok(f)
  }

  if (method==='GET' && p==='/admin/alerts') return async () => {
    const search=(q.get('q')||'').toLowerCase()
    const result=search?mockAlerts.filter(a=>a.message.toLowerCase().includes(search)):mockAlerts
    return ok(result)
  }
  if (method==='GET' && p==='/admin/alerts/summary') return async () => ok({
    critical: mockAlerts.filter(a=>!a.is_resolved&&a.severity==='critical').length,
    warning:  mockAlerts.filter(a=>!a.is_resolved&&a.severity==='warning').length,
    info:     mockAlerts.filter(a=>!a.is_resolved&&a.severity==='info').length,
    resolved: mockAlerts.filter(a=>a.is_resolved).length,
  })
  const aldis = p.match(/^\/admin\/alerts\/([^/]+)\/dismiss$/)
  if (method==='PATCH' && aldis) return async () => {
    const a=mockAlerts.find(x=>x.id===aldis[1]); if(!a) return err('Not found',404)
    a.is_resolved=true; a.status='resolved'; return ok(a)
  }

  return null  
}

const _realFetch = window.fetch.bind(window)

window.fetch = async (input, init = {}) => {
  const url    = typeof input === 'string' ? input : input.url
  const method = (init.method || 'GET').toUpperCase()

  if (!url.includes('/api/')) return _realFetch(input, init)

  const handler = matchRoute(method, url)
  if (!handler) return _realFetch(input, init)

  await delay()

  let body = {}
  if (init.body) {
    try { body = JSON.parse(init.body) } catch { body = {} }
  }

  console.log(`[MOCK] ${method} ${url}`, body)
  return handler(body)
}

console.log('%c[StockWise Admin Mock] Active — login with sennett.faria@gmail.com / Sennett123, or any @stockwise.ai email + password "admin123". After login, check console for the 2FA PIN.', 'color:#00ff41;font-weight:bold')

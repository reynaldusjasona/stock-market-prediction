// StockWise AI — API helper (base: http://localhost:8000/api)
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

const api = {
  // Auth helpers
  getToken()   { return localStorage.getItem('sw_token'); },
  getUserId()  { return localStorage.getItem('sw_uid'); },
  getUser()    { try { return JSON.parse(localStorage.getItem('sw_user') || 'null'); } catch { return null; } },
  isLoggedIn() { return !!this.getToken(); },

  saveAuth(token, user) {
    localStorage.setItem('sw_token', token);
    localStorage.setItem('sw_uid',   user.id);
    localStorage.setItem('sw_user',  JSON.stringify(user));
    if (user.role) localStorage.setItem('sw_role', user.role);
  },

  clearAuth() {
    localStorage.removeItem('sw_token');
    localStorage.removeItem('sw_uid');
    localStorage.removeItem('sw_user');
    localStorage.removeItem('sw_role');
  },

  // Core fetch wrapper
  async fetch(path, options = {}) {
    const token = this.getToken();
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    };

    let res;
    try {
      res = await fetch(`${API_BASE}${path}`, { ...options, headers });
    } catch (e) {
      throw new Error('Cannot connect to server. Make sure the backend is running.');
    }

    if (res.status === 401) {
      this.clearAuth();
      window.location.href = '/login';
      return;
    }

    if (!res.ok) {
      let msg = `Error ${res.status}`;
      try {
        const body = await res.json();
        msg = body.detail || body.message || msg;
      } catch {}
      throw new Error(msg);
    }

    return res.json();
  },

  // Auth endpoints
  async login(email, password) {
    const data = await this.fetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    this.saveAuth(data.token, data.user);
    return data;
  },

  async register(name, email, password, sectors = [], level = 'moderate', role = 'investor') {
    return this.fetch('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password, sectors, level, role }),
    });
  },

  async logout() {
    const token = this.getToken();
    try {
      if (token) await this.fetch('/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ session_token: token }),
      });
    } catch {}
    this.clearAuth();
    window.location.href = '/login';
  },

  async getUser_(userId) {
    return this.fetch(`/auth/user/${userId}`);
  },

  async getPreferences(userId) {
    return this.fetch(`/auth/user/${userId}/preferences`);
  },

  async updatePreferences(userId, preferences) {
    return this.fetch(`/auth/user/${userId}/preferences`, {
      method: 'PUT',
      body: JSON.stringify({ preferences }),
    });
  },

  async getRiskTolerance(userId) {
    return this.fetch(`/auth/user/${userId}/risk-tolerance`);
  },

  async updateRiskTolerance(userId, level) {
    return this.fetch(`/auth/user/${userId}/risk-tolerance`, {
      method: 'PUT',
      body: JSON.stringify({ level }),
    });
  },

  async resendVerification(email) {
    return this.fetch('/auth/resend-verification', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  // Stock endpoints
  async getTrending() {
    return this.fetch('/stocks/trending');
  },

  async searchStocks(q) {
    return this.fetch(`/stocks/search?q=${encodeURIComponent(q)}`);
  },

  async getAllStocks() {
    return this.fetch('/stocks');
  },

  async getStock(ticker) {
    return this.fetch(`/stocks/${ticker.toUpperCase()}`);
  },

  async getHistory(ticker, period = '1M') {
    return this.fetch(`/stocks/${ticker.toUpperCase()}/history?period=${period}`);
  },

  async getPrice(ticker) {
    return this.fetch(`/stocks/${ticker.toUpperCase()}/price`);
  },

  async getIndicators(ticker, period = '1M') {
    return this.fetch(`/stocks/${ticker.toUpperCase()}/indicators?period=${period}`);
  },

  async getOrderBook(ticker) {
    return this.fetch(`/stocks/${ticker.toUpperCase()}/orderbook`);
  },

  // Prediction endpoints (auth required)
  async getPrediction(ticker) {
    return this.fetch(`/predictions/${ticker.toUpperCase()}`);
  },

  async getRecommendation(ticker) {
    return this.fetch(`/predictions/${ticker.toUpperCase()}/recommendation`);
  },

  async getPredictionHistory(ticker, limit = 10) {
    return this.fetch(`/predictions/${ticker.toUpperCase()}/history?limit=${limit}`);
  },

  async getNews(ticker, limit = 8) {
    return this.fetch(`/news/${ticker.toUpperCase()}?limit=${limit}`);
  },

  async getFundamentals(ticker) {
    return this.fetch(`/stocks/${ticker.toUpperCase()}/fundamentals`);
  },

  // Watchlist endpoints (auth required)
  async getWatchlist() {
    return this.fetch('/watchlist');
  },

  async addToWatchlist(ticker) {
    return this.fetch(`/watchlist/${ticker.toUpperCase()}`, { method: 'POST' });
  },

  async removeFromWatchlist(ticker) {
    return this.fetch(`/watchlist/${ticker.toUpperCase()}`, { method: 'DELETE' });
  },

  // Portfolio endpoints (auth required)
  async getPortfolio() {
    return this.fetch('/portfolio');
  },

  async getPortfolioStock(ticker) {
    return this.fetch(`/portfolio/${ticker.toUpperCase()}`);
  },

  async addToPortfolio({ ticker, shares, average_buy_price }) {
    return this.fetch('/portfolio', {
      method: 'POST',
      body: JSON.stringify({ ticker, shares, average_buy_price }),
    });
  },

  async removeFromPortfolio(ticker) {
    return this.fetch(`/portfolio/${ticker.toUpperCase()}`, { method: 'DELETE' });
  },

  // Alerts endpoints (auth required)
  async getAlerts(ticker) {
    return this.fetch(`/alerts/${ticker.toUpperCase()}`);
  },

  async createAlert(ticker, { target_price, condition }) {
    return this.fetch(`/alerts/${ticker.toUpperCase()}`, {
      method: 'POST',
      body: JSON.stringify({ target_price, condition }),
    });
  },

  async updateAlert(alertId, updates) {
    return this.fetch(`/alerts/${alertId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  },

  async deleteAlert(alertId) {
    return this.fetch(`/alerts/${alertId}`, { method: 'DELETE' });
  },

  // Notification endpoints (auth required)
  async getNotifications() {
    return this.fetch('/notifications');
  },

  async markNotificationRead(id) {
    return this.fetch(`/notifications/${id}/read`, { method: 'PATCH' });
  },

  // Feedback endpoints (investor for submit/list, admin for approve/reject)
  async submitFeedback({ subject, message }) {
    return this.fetch('/feedback', {
      method: 'POST',
      body: JSON.stringify({ subject, message }),
    });
  },

  async getFeedback() {
    return this.fetch('/feedback');
  },

  async approveFeedback(id) {
    return this.fetch(`/feedback/${id}/approve`, { method: 'PATCH' });
  },

  async rejectFeedback(id) {
    return this.fetch(`/feedback/${id}/reject`, { method: 'PATCH' });
  },

  // Subscription endpoints (mixed auth)
  async getSubscriptionPlans() {
    return this.fetch('/subscription/plans');
  },

  async getSubscription() {
    return this.fetch('/subscription');
  },

  async subscribe({ plan }) {
    return this.fetch('/subscription', {
      method: 'POST',
      body: JSON.stringify({ plan }),
    });
  },

  async cancelSubscription() {
    return this.fetch('/subscription/cancel', { method: 'POST' });
  },
};

// Guard: redirect if not logged in
function requireAuth() {
  if (!api.isLoggedIn()) {
    window.location.href = '/login';
    return false;
  }
  return true;
}

// Guard: redirect if already logged in
function redirectIfLoggedIn(dest = '/dashboard') {
  if (api.isLoggedIn()) {
    window.location.href = dest;
  }
}

// Sidebar toggle helpers
function openSidebar() {
  document.getElementById('sidebar')?.classList.add('open');
  document.getElementById('sidebarOverlay')?.classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeSidebar() {
  document.getElementById('sidebar')?.classList.remove('open');
  document.getElementById('sidebarOverlay')?.classList.remove('open');
  document.body.style.overflow = '';
}
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;
  sidebar.classList.contains('open') ? closeSidebar() : openSidebar();
}

// Toast notifications
function showToast(message, type = 'success', duration = 3500) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const icon = type === 'success'
    ? '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="#00ff41" stroke-width="1.5"/><path d="M5 8l2 2 4-4" stroke="#00ff41" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'
    : '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="#ff4444" stroke-width="1.5"/><path d="M8 5v4M8 10.5v1" stroke="#ff4444" stroke-width="1.5" stroke-linecap="round"/></svg>';
  toast.innerHTML = `${icon}<span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), duration);
}

// Format helpers
function fmt(n) {
  if (n == null) return '—';
  return Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtChange(n) {
  if (n == null) return { text: '—', cls: 'badge-neutral' };
  const v = Number(n);
  const sign = v >= 0 ? '+' : '';
  return {
    text: `${sign}${v.toFixed(2)}%`,
    cls:  v >= 0 ? 'badge-up' : 'badge-down',
  };
}

function fmtSignal(signal) {
  const s = (signal || '').toUpperCase();
  if (s === 'BUY')  return { text: '▲ BUY',  cls: 'signal-buy' };
  if (s === 'SELL') return { text: '▼ SELL', cls: 'signal-sell' };
  return { text: '● HOLD', cls: 'signal-hold' };
}

function escHtml(str) {
  const el = document.createElement('div');
  el.appendChild(document.createTextNode(String(str ?? '')));
  return el.innerHTML;
}

// Debounce
function debounce(fn, delay = 300) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), delay);
  };
}

// Hover sidebar (left-edge trigger, replaces click)
function initHoverSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  if (!sidebar) return;

  const zone = document.createElement('div');
  zone.id = 'sidebarHoverZone';
  zone.style.cssText = 'position:fixed;top:0;left:0;bottom:0;width:20px;z-index:89;';
  document.body.appendChild(zone);

  let closeTimer = null;
  const cancelClose  = () => clearTimeout(closeTimer);
  const scheduleClose = () => { closeTimer = setTimeout(closeSidebar, 280); };

  zone.addEventListener('mouseenter',    () => { cancelClose(); openSidebar(); });
  sidebar.addEventListener('mouseenter', cancelClose);
  sidebar.addEventListener('mouseleave', scheduleClose);

  overlay?.addEventListener('click', closeSidebar);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeSidebar(); closeDropdown(); } });
}

// Avatar dropdown
function initAvatarDropdown() {
  const btn  = document.getElementById('avatarBtn');
  const drop = document.getElementById('navDropdown');
  if (!btn || !drop) return;

  btn.addEventListener('click', e => {
    e.stopPropagation();
    const open = drop.classList.toggle('open');
    btn.setAttribute('aria-expanded', String(open));
  });

  document.addEventListener('click', closeDropdown);
}

function closeDropdown() {
  const drop = document.getElementById('navDropdown');
  const btn  = document.getElementById('avatarBtn');
  drop?.classList.remove('open');
  btn?.setAttribute('aria-expanded', 'false');
}

// Populate avatar from stored user
function populateAvatar() {
  const user       = api.getUser();
  const avatarWrap = document.getElementById('avatarWrap');
  const navAvatar  = document.getElementById('navAvatar');
  const navName    = document.getElementById('navAvatarName');
  const ddName     = document.getElementById('ddName');
  const ddEmail    = document.getElementById('ddEmail');

  if (user && api.isLoggedIn()) {
    if (avatarWrap) avatarWrap.style.display = '';
    const initials = (user.name || 'U').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
    if (navAvatar) navAvatar.textContent = initials;
    if (navName)   navName.textContent   = user.name?.split(' ')[0] || 'Account';
    if (ddName)    ddName.textContent    = user.name  || '—';
    if (ddEmail)   ddEmail.textContent   = user.email || '—';
    document.querySelectorAll('.guest-only').forEach(el => el.style.display = 'none');
  } else {
    if (avatarWrap) avatarWrap.style.display = 'none';
  }
}

// Logo navigation: dashboard if logged in, index if not
document.addEventListener('DOMContentLoaded', () => {
  const dest = api.isLoggedIn() ? '/dashboard' : '/';
  document.querySelectorAll('a.logo-btn, a.sidebar-logo').forEach(a => { a.href = dest; });
});

export { api as default, requireAuth, redirectIfLoggedIn, closeSidebar, showToast, fmt, fmtChange, fmtSignal, escHtml, debounce, initHoverSidebar, initAvatarDropdown, populateAvatar };

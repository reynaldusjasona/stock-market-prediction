import { api } from '../api/api'

// TODO: unify token storage with AuthContext (localStorage vs sessionStorage)
function getAdminUser() {
  try { return JSON.parse(sessionStorage.getItem('sw_user') || 'null') } catch { return null }
}

async function adminLogout() {
  try {
    await api.post('/auth/logout', { session_token: sessionStorage.getItem('sw_token') })
  } catch {}
  sessionStorage.removeItem('sw_token')
  sessionStorage.removeItem('sw_role')
  sessionStorage.removeItem('sw_user')
  sessionStorage.removeItem('sw_uid')
  sessionStorage.removeItem('sw_token_pending')
  sessionStorage.removeItem('sw_user_pending')
}

function showToast(message, type = 'success', duration = 3500) {
  let container = document.getElementById('toast-container')
  if (!container) {
    container = document.createElement('div')
    container.id = 'toast-container'
    document.body.appendChild(container)
  }
  const toast = document.createElement('div')
  toast.className = `toast ${type}`
  const icon = type === 'success'
    ? '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="#00ff41" stroke-width="1.5"/><path d="M5 8l2 2 4-4" stroke="#00ff41" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'
    : '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="#ff4444" stroke-width="1.5"/><path d="M8 5v4M8 10.5v1" stroke="#ff4444" stroke-width="1.5" stroke-linecap="round"/></svg>'
  toast.innerHTML = `${icon}<span>${message}</span>`
  container.appendChild(toast)
  setTimeout(() => toast.remove(), duration)
}

function debounce(fn, delay = 300) {
  let t
  return (...args) => {
    clearTimeout(t)
    t = setTimeout(() => fn(...args), delay)
  }
}

function closeDropdown() {
  const drop = document.getElementById('navDropdown')
  const btn = document.getElementById('avatarBtn')
  drop?.classList.remove('open')
  btn?.setAttribute('aria-expanded', 'false')
}

function initAvatarDropdown() {
  const btn = document.getElementById('avatarBtn')
  const drop = document.getElementById('navDropdown')
  if (!btn || !drop) return

  btn.addEventListener('click', e => {
    e.stopPropagation()
    const open = drop.classList.toggle('open')
    btn.setAttribute('aria-expanded', String(open))
  })

  document.addEventListener('click', closeDropdown)
}

function populateAvatar() {
  const user = getAdminUser()
  const avatarWrap = document.getElementById('avatarWrap')
  const navAvatar = document.getElementById('navAvatar')
  const navName = document.getElementById('navAvatarName')
  const ddName = document.getElementById('ddName')
  const ddEmail = document.getElementById('ddEmail')

  if (user) {
    if (avatarWrap) avatarWrap.style.display = ''
    const initials = (user.name || 'A').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    if (navAvatar) navAvatar.textContent = initials
    if (navName) navName.textContent = user.name?.split(' ')[0] || 'Admin'
    if (ddName) ddName.textContent = user.name || '—'
    if (ddEmail) ddEmail.textContent = user.email || '—'
  } else {
    if (avatarWrap) avatarWrap.style.display = 'none'
  }
}

export { showToast, debounce, initAvatarDropdown, populateAvatar, getAdminUser, adminLogout }

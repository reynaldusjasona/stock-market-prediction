import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './styles/shared.css'

// ─── MOCK MODE ────────────────────────────────────────
// Intercepts all /api/admin/* calls with fake data.
// Login: any @stockwise.ai email + password "admin123"
// Remove this import when backend is ready.
import './pages/admin/adminMock'
// ─────────────────────────────────────────────────────

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

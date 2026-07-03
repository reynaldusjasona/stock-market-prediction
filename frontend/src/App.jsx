import { BrowserRouter, Routes, Route } from 'react-router-dom'

// ─── Existing investor-facing pages ───────────────────
import Home      from './pages/Home'
import Login     from './pages/Login'
import Register  from './pages/Register'
import Dashboard from './pages/Dashboard'
import Stock     from './pages/Stock'

// ─── Admin pages ──────────────────────────────────────
import LoginPage     from './pages/admin/LoginPage'
import DashboardPage from './pages/admin/DashboardPage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Investor routes */}
        <Route path="/"          element={<Home />} />
        <Route path="/login"     element={<Login />} />
        <Route path="/register"  element={<Register />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/stock"     element={<Stock />} />

        {/* Admin routes */}
        <Route path="/admin/login" element={<LoginPage />} />
        <Route path="/admin"       element={<DashboardPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App

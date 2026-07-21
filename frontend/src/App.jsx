import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Watchlist from './pages/Watchlist'
import Login from './pages/Login'
import Register from './pages/Register'
import Verify from './pages/Verify'
import Dashboard from './pages/Dashboard'
import Portfolio from './pages/Portfolio'
import StockDetail from './pages/StockDetail'
import AllStocks from './pages/AllStocks'
import Recommendations from './pages/Recommendations'
import Alerts from './pages/Alerts'
import Notifications from './pages/Notifications'
import Feedback from './pages/Feedback'
import Landing from './pages/Landing'
import AdminLoginPage from './pages/admin/LoginPage'
import AdminDashboardPage from './pages/admin/DashboardPage'
import TraderDashboardPage from './pages/trader/TraderDashboardPage'

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/"  element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          <Route path="/verify" element={<Verify />} />

          <Route path="/watchlist" element={<ProtectedRoute><Watchlist /></ProtectedRoute>} />

          <Route path="/portfolio" element={<ProtectedRoute><Portfolio /></ProtectedRoute>} />

          <Route path="/feedback" element={<ProtectedRoute><Feedback /></ProtectedRoute>} />

          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />

          <Route path="/stock/:ticker" element={<ProtectedRoute><StockDetail /></ProtectedRoute>} />

          <Route path="/allstocks" element={<ProtectedRoute><AllStocks /></ProtectedRoute>} />

          <Route path="/recommendations" element={<ProtectedRoute><Recommendations /></ProtectedRoute>} />

          <Route path="/alerts" element={<ProtectedRoute><Alerts /></ProtectedRoute>} />

          <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />

          <Route path="/admin/login" element={<AdminLoginPage />} />
          <Route path="/admin" element={<AdminDashboardPage />} />

          {/* Investor + Trader — both can view */}
          <Route path="/dashboard" element={<ProtectedRoute roles={['investor','trader']}><Dashboard /></ProtectedRoute>} />
          <Route path="/stock/:ticker" element={<ProtectedRoute roles={['investor','trader']}><StockDetail /></ProtectedRoute>} />
          <Route path="/allstocks" element={<ProtectedRoute roles={['investor','trader']}><AllStocks /></ProtectedRoute>} />
          <Route path="/notifications" element={<ProtectedRoute roles={['investor','trader']}><Notifications /></ProtectedRoute>} />
          <Route path="/feedback" element={<ProtectedRoute roles={['investor','trader']}><Feedback /></ProtectedRoute>} />

          {/* Investor only */}
          <Route path="/watchlist" element={<ProtectedRoute roles={['investor']}><Watchlist /></ProtectedRoute>} />
          <Route path="/portfolio" element={<ProtectedRoute roles={['investor']}><Portfolio /></ProtectedRoute>} />
          <Route path="/recommendations" element={<ProtectedRoute roles={['investor']}><Recommendations /></ProtectedRoute>} />
          <Route path="/alerts" element={<ProtectedRoute roles={['investor']}><Alerts /></ProtectedRoute>} />

          {/* Trader only */}
          <Route path="/trader/dashboard" element={<TraderDashboardPage />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App

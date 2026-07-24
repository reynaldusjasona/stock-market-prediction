import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

function ProtectedRoute({ children, roles = [] }) {
    const { token, user } = useAuth()

    if (!token) return <Navigate to="/login" replace />

    if (roles.length > 0 && user && !roles.includes(user.role)) {
        if (user.role === 'trader') return <Navigate to="/trader/dashboard" replace />
        return <Navigate to="/login" replace />
    }

    return children
}

export default ProtectedRoute

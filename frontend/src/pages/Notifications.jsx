import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { api } from '../api/api'
import '../styles/Notifications.css'
import ViewNotifications from '../components/notifications/ViewNotifications'

function timeAgo(dateString) {
    const now = new Date()
    const date = new Date(dateString)
    const diff = Math.floor((now - date) / 1000)
    if (diff < 60) return diff + ' seconds ago'
    if (diff < 3600) return Math.floor(diff / 60) + ' minutes ago'
    if (diff < 86400) return Math.floor(diff / 3600) + ' hours ago'
    return Math.floor(diff / 86400) + ' days ago'
}

function Notifications() {
    const [notifications, setNotifications] = useState([])
    const [loading, setLoading] = useState(true)
    const navigate = useNavigate()
    const { user, logout } = useAuth()
    const isTrader = user?.role === 'trader'

    function handleLogout() {
        logout()
        navigate('/login')
    }

    // get all notifications for the user
    async function loadNotifications() {
        try {
            const data = await api.get('/notifications')
            setNotifications(data)
        } catch (err) {
            console.log('notifications failed:', err.message)
        }
        setLoading(false)
    }

    // mark one as read then refresh the list
    async function markRead(notificationId) {
        try {
            await api.patch(`/notifications/${notificationId}/read`)
            loadNotifications()
        } catch (err) {
            console.log('mark read failed:', err.message)
        }
    }

    useEffect(() => {
        loadNotifications()
    }, [])

    if (loading) return <p>Loading...</p>

    return (
        <div className="notifications-page">
                                                <aside className="sidebar">
                <div className="sidebar-logo">StockWise <span>AI</span></div>

                {/* Both roles */}
                <span className="sidebar-link" onClick={() => navigate('/dashboard')}>Dashboard</span>
                <span className="sidebar-link" onClick={() => navigate('/allstocks')}>All Stocks</span>
                <span className="sidebar-link active" onClick={() => navigate('/notifications')}>Notifications</span>
                <span className="sidebar-link" onClick={() => navigate('/feedback')}>Feedback</span>

                {/* Investor only */}
                {!isTrader && (
                    <>
                        <span className="sidebar-link" onClick={() => navigate('/recommendations')}>Recommendations</span>
                        <span className="sidebar-link" onClick={() => navigate('/watchlist')}>Watchlist</span>
                        <span className="sidebar-link" onClick={() => navigate('/portfolio')}>Portfolio</span>
                        <span className="sidebar-link" onClick={() => navigate('/alerts')}>Alerts</span>
                        <span className="sidebar-logout" onClick={handleLogout}>Logout</span>
                    </>
                )}

                {/* Trader — Back to Trader Portal + Logout pinned to bottom */}
                {isTrader && (
                    <div style={{ marginTop:'auto', borderTop:'1px solid rgba(255,255,255,0.06)', paddingTop:'0.5rem' }}>
                        <span className="sidebar-link" onClick={() => navigate('/trader/dashboard')}>
                            ← Back to Trader Portal
                        </span>
                        <span className="sidebar-logout" onClick={handleLogout}>Logout</span>
                    </div>
                )}
            </aside>

            <div className="notifications-content">
                <div className="notifications-header">
                    <h1>Notifications</h1>
                    <p>Stay up to date with your alerts and account activity</p>
                </div>

                {notifications.length === 0 ? (
                    <div className="empty-state">No notifications yet. Create price alerts to get notified.</div>
                ) : (
                    <ViewNotifications notifications={notifications} onMarkRead={markRead} timeAgo={timeAgo} />
                )}
            </div>
        </div>
    )
}

export default Notifications

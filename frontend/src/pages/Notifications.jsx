import { useState, useEffect } from 'react'
import { api } from '../api/api'
import AppLayout from '../components/layout/AppLayout'
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
        <AppLayout>
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
        </AppLayout>
    )
}

export default Notifications

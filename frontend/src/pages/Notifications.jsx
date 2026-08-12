import { useState, useEffect } from 'react'
import { api } from '../api/api'
import { useAuth } from '../context/AuthContext'
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
    const [inquiries, setInquiries] = useState([])
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState('notifications')
    const { isSubscribed, user } = useAuth()

    // get all notifications for the user
    async function loadNotifications() {
        try {
            const data = await api.get('/notifications')
            setNotifications(data)
        } catch (err) {
            console.log('notifications failed:', err.message)
        }
    }

    // get investor's own stock inquiries
    async function loadInquiries() {
        try {
            const data = await api.get('/investor/stock-inquiries')
            setInquiries(data.inquiries || [])
        } catch {
            // not an investor or endpoint not available — ignore
        }
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
        if (!isSubscribed) {
            setLoading(false)
            return
        }
        Promise.all([loadNotifications(), loadInquiries()]).finally(() => setLoading(false))
    }, [isSubscribed])

    if (loading) return <p>Loading...</p>

    const isInvestor = user?.role === 'investor'

    return (
        <AppLayout>
            <div className="notifications-content">
                <div className="notifications-header">
                    <h1>Notifications</h1>
                    <p>Stay up to date with your alerts and account activity</p>
                </div>

                {isInvestor && (
                    <div className="notif-tabs">
                        <button
                            className={activeTab === 'notifications' ? 'notif-tab active' : 'notif-tab'}
                            onClick={() => setActiveTab('notifications')}
                        >
                            Notifications ({notifications.length})
                        </button>
                        <button
                            className={activeTab === 'questions' ? 'notif-tab active' : 'notif-tab'}
                            onClick={() => setActiveTab('questions')}
                        >
                            My Questions ({inquiries.length})
                        </button>
                    </div>
                )}

                {activeTab === 'notifications' && (
                    <>
                        {notifications.length === 0 ? (
                            <div className="empty-state">No notifications yet. Create price alerts to get notified.</div>
                        ) : (
                            <ViewNotifications notifications={notifications} onMarkRead={markRead} timeAgo={timeAgo} />
                        )}
                    </>
                )}

                {activeTab === 'questions' && isInvestor && (
                    <div className="inquiries-list">
                        {inquiries.length === 0 ? (
                            <div className="empty-state">No questions sent yet. Use "Ask Trader" on any stock page.</div>
                        ) : (
                            inquiries.map((q) => (
                                <div className="inquiry-card" key={q.id}>
                                    <div className="inquiry-header">
                                        <span className="inquiry-ticker">{q.ticker}</span>
                                        <span className={q.status === 'answered' ? 'inquiry-status answered' : 'inquiry-status open'}>
                                            {q.status === 'answered' ? 'Answered' : 'Awaiting response'}
                                        </span>
                                    </div>
                                    <div className="inquiry-question">
                                        <span className="inquiry-label">You asked:</span> {q.message || '(no message)'}
                                    </div>
                                    {q.response && (
                                        <div className="inquiry-response">
                                            <span className="inquiry-label">Trader response:</span> {q.response}
                                        </div>
                                    )}
                                    <div className="inquiry-time">
                                        {timeAgo(q.created_at)}
                                        {q.responded_at && <> · Responded {timeAgo(q.responded_at)}</>}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>
        </AppLayout>
    )
}

export default Notifications

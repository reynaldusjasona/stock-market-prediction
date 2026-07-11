function ViewNotifications({ notifications, onMarkRead, timeAgo }) {
    return (
        <div className="notification-list">
            {notifications.map((n) => (
                <div className={n.is_read ? 'notification-card read' : 'notification-card unread'} key={n.id}>
                    <div>
                        <div className="notification-title">{n.title}</div>
                        <div className="notification-message">{n.message}</div>
                        <div className="notification-time">{timeAgo(n.created_at)}</div>
                    </div>
                    {!n.is_read && (
                        <button className="btn-mark-read" onClick={() => onMarkRead(n.id)}>
                            Mark as read
                        </button>
                    )}
                </div>
            ))}
        </div>
    )
}

export default ViewNotifications

function ViewAlert({ alerts, onDelete }) {
    return (
        <div className="alert-list">
            {alerts.map((alert) => (
                <div className="alert-card" key={alert.id}>
                    <div className="alert-info">
                        {alert.ticker} <span>&mdash; alert when price is {alert.condition} ${alert.target_price}</span>
                    </div>
                    <button className="btn-remove" onClick={() => onDelete(alert.id)}>
                        Delete
                    </button>
                </div>
            ))}
        </div>
    )
}

export default ViewAlert

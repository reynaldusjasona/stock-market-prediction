import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { api } from '../api/api'
import '../styles/Subscription.css'

function Subscription() {
    const [plans, setPlans] = useState([])
    const [currentSub, setCurrentSub] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [success, setSuccess] = useState(null)
    const { logout } = useAuth()
    const navigate = useNavigate()

    function handleLogout() {
        logout()
        navigate('/login')
    }

    // plans are public, subscription is the current user's own
    async function loadPlans() {
        try {
            const data = await api.get('/subscription/plans')
            setPlans(data)
        } catch (err) {
            console.log('plans failed:', err.message)
        }
    }

    async function loadSubscription() {
        try {
            const data = await api.get('/subscription')
            setCurrentSub(data)
        } catch (err) {
            console.log('subscription failed:', err.message)
        }
    }

    useEffect(() => {
        loadPlans()
        loadSubscription().finally(() => setLoading(false))
    }, [])

    async function subscribe(planId) {
        setError(null)
        setSuccess(null)
        try {
            await api.post('/subscription', { plan: planId })
            setSuccess('Subscription successful!')
            loadSubscription()
        } catch (err) {
            setError(err.message)
        }
    }

    async function cancelSubscription() {
        setError(null)
        setSuccess(null)
        try {
            await api.post('/subscription/cancel')
            setSuccess('Subscription cancelled.')
            loadSubscription()
        } catch (err) {
            setError(err.message)
        }
    }

    if (loading) return <p>Loading...</p>

    return (
        <div className="subscription-page">
            <aside className="sidebar">
                <div className="sidebar-logo">StockWise <span>AI</span></div>
                <span className="sidebar-link" onClick={() => navigate('/dashboard')}>Dashboard</span>
                <span className="sidebar-link" onClick={() => navigate('/allstocks')}>All Stocks</span>
                <span className="sidebar-link" onClick={() => navigate('/recommendations')}>Recommendations</span>
                <span className="sidebar-link" onClick={() => navigate('/watchlist')}>Watchlist</span>
                <span className="sidebar-link" onClick={() => navigate('/portfolio')}>Portfolio</span>
                <span className="sidebar-link active">Subscription</span>
                <span className="sidebar-link" onClick={() => navigate('/alerts')}>Alerts</span>
                <span className="sidebar-link" onClick={() => navigate('/notifications')}>Notifications</span>
                <span className="sidebar-link" onClick={() => navigate('/feedback')}>Feedback</span>
                <span className="sidebar-logout" onClick={handleLogout}>Logout</span>
            </aside>

            <div className="subscription-content">
                <div className="subscription-header">
                    <h1>Subscription</h1>
                    <p>Manage your StockWise AI plan</p>
                </div>

                {error && <p className="error-msg">{error}</p>}
                {success && <p className="success-msg">{success}</p>}

                {currentSub && (
                    <div className="current-sub-card">
                        <div>
                            <p className="current-sub-label">Current Plan</p>
                            <p className="current-sub-plan">{currentSub.plan.toUpperCase()}</p>
                            <p className="current-sub-meta">
                                Status: <span className="badge-active">{currentSub.status}</span>
                                {currentSub.expires_at && <> &middot; Renews/Expires {new Date(currentSub.expires_at).toLocaleDateString()}</>}
                            </p>
                        </div>
                        <button className="btn-cancel-sub" onClick={cancelSubscription}>Cancel Subscription</button>
                    </div>
                )}

                <div className="plans-grid">
                    {plans.map((p) => (
                        <div className="plan-card-sub" key={p.plan}>
                            <p className="plan-card-name">{p.plan.toUpperCase()}</p>
                            <p className="plan-card-price">${p.price}<span>/{p.period}</span></p>
                            <ul>
                                {p.features.map((f) => (
                                    <li key={f}>✓ {f}</li>
                                ))}
                            </ul>
                            {currentSub && currentSub.plan === p.plan && currentSub.status === 'active' ? (
                                <button className="btn-subscribed" disabled>Current Plan</button>
                            ) : (
                                <button className="btn-subscribe" onClick={() => subscribe(p.plan)}>Subscribe</button>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

export default Subscription

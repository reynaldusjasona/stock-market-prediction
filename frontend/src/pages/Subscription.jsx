import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../api/api'
import AppLayout from '../components/layout/AppLayout'
import '../styles/Subscription.css'

function Subscription() {
    const [plans, setPlans] = useState([])
    const [currentSub, setCurrentSub] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [success, setSuccess] = useState(null)
    const [searchParams, setSearchParams] = useSearchParams()

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

    // handle redirect back from Stripe Checkout
    useEffect(() => {
        const status = searchParams.get('status')
        if (status === 'success') {
            setSuccess('Payment successful! Activating your subscription...')
            // fallback activation in case the webhook hasn't fired yet
            api.post('/subscription').catch(() => {}).finally(() => loadSubscription())
            setSearchParams({}, { replace: true })
        } else if (status === 'cancelled') {
            setError('Payment cancelled.')
            setSearchParams({}, { replace: true })
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    async function startCheckout() {
        setError(null)
        setSuccess(null)
        try {
            const data = await api.post('/subscription/checkout')
            window.location.href = data.checkout_url
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
        <AppLayout>
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
                            <p className="current-sub-plan">
                                {plans.find((p) => p.plan === currentSub.plan)?.name || currentSub.plan.toUpperCase()}
                            </p>
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
                            <p className="plan-card-name">{p.name || p.plan.toUpperCase()}</p>
                            <p className="plan-card-price">${p.price}<span>/{p.period}</span></p>
                            <ul>
                                {p.features.map((f) => (
                                    <li key={f}>✓ {f}</li>
                                ))}
                            </ul>
                            {currentSub && currentSub.plan === p.plan && currentSub.status === 'active' ? (
                                <button className="btn-subscribed" disabled>Current Plan</button>
                            ) : (
                                <button className="btn-subscribe" onClick={startCheckout}>Subscribe</button>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </AppLayout>
    )
}

export default Subscription

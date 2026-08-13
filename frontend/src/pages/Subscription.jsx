import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../api/api'
import { useAuth } from '../context/AuthContext'
import AppLayout from '../components/layout/AppLayout'
import '../styles/Subscription.css'

const SIGNAL_ACCESS_PRICE = 19.99
const SIGNAL_ACCESS_FEATURES = [
    'Connect with licensed traders',
    'Ask a trader for stock analysis',
    'View trader-endorsed Buy/Sell signals',
]

function Subscription() {
    const [plans, setPlans] = useState([])
    const [currentSub, setCurrentSub] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [success, setSuccess] = useState(null)
    const [addonError, setAddonError] = useState(null)
    const [addonSuccess, setAddonSuccess] = useState(null)
    const [addonLoading, setAddonLoading] = useState(false)
    // 'plan' | 'signal' | null - which cancel action is pending confirmation
    const [confirmAction, setConfirmAction] = useState(null)
    const [searchParams, setSearchParams] = useSearchParams()
    const { refreshSubscription } = useAuth()

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
        // keep AuthContext's cached copy in sync too, so LockedFeature
        // gates elsewhere in the app unlock without a full reload
        refreshSubscription()
    }

    useEffect(() => {
        loadPlans()
        loadSubscription().finally(() => setLoading(false))
    }, [])

    // handle redirect back from Stripe Checkout
    useEffect(() => {
        const status = searchParams.get('status')
        const plan = searchParams.get('plan')
        if (status === 'success') {
            setSuccess('Payment successful! Confirming your subscription...')
            if (plan) {
                // fallback activation in case the webhook hasn't fired yet
                api.post('/subscription', { plan })
                    .catch((err) => {
                        // 409 means the webhook already activated it - not a real failure
                        if (err.status === 409) return
                        console.log('subscription activation fallback failed:', err.message)
                        setSuccess(null)
                        setError(
                            "Payment succeeded, but we couldn't confirm your subscription "
                            + "automatically. Please refresh this page in a moment, or "
                            + "contact support if it still doesn't show up."
                        )
                    })
                    .finally(() => loadSubscription())
            } else {
                console.log('checkout success redirect missing plan param; skipping fallback activation')
                loadSubscription()
            }
            setSearchParams({}, { replace: true })
        } else if (status === 'cancelled') {
            setError('Payment cancelled.')
            setSearchParams({}, { replace: true })
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // handle redirect back from Stripe Checkout for the signal access add-on
    useEffect(() => {
        const status = searchParams.get('status')
        const addon = searchParams.get('addon')
        if (status === 'success' && addon === 'signal') {
            setAddonSuccess('Payment successful! Confirming your signal access...')
            // fallback activation in case the webhook hasn't fired yet
            api.post('/subscription/signal-access/activate')
                .catch((err) => {
                    // 409 means webhook already activated it - not a real failure
                    if (err.status === 409) return
                    console.log('signal access activation fallback failed:', err.message)
                    setAddonSuccess(null)
                    setAddonError(
                        "Payment succeeded, but we couldn't confirm your signal access "
                        + "automatically. Please refresh this page in a moment."
                    )
                })
                .finally(() => loadSubscription())
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

    async function startSignalAccessCheckout() {
        setAddonError(null)
        setAddonSuccess(null)
        setAddonLoading(true)
        try {
            const data = await api.post('/subscription/signal-access/checkout')
            if (data.checkout_url) {
                window.location.href = data.checkout_url
                return
            }
            // mock mode (no Stripe configured) activates instantly, no redirect
            setAddonSuccess(data.message || 'Signal access activated.')
            await loadSubscription()
        } catch (err) {
            setAddonError(err.message)
        } finally {
            setAddonLoading(false)
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

    async function cancelSignalAccess() {
        setAddonError(null)
        setAddonSuccess(null)
        try {
            await api.post('/subscription/signal-access/cancel')
            setAddonSuccess('Trader Access cancelled.')
            await loadSubscription()
        } catch (err) {
            setAddonError(err.message)
        }
    }

    async function confirmCancel() {
        const action = confirmAction
        setConfirmAction(null)
        if (action === 'plan') {
            await cancelSubscription()
        } else if (action === 'signal') {
            await cancelSignalAccess()
        }
    }

    if (loading) return <p>Loading...</p>

    const hasSignalAccess = Boolean(currentSub?.has_signal_access)

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
                                {plans.find((p) => p.id === currentSub.plan)?.name || currentSub.plan.toUpperCase()}
                            </p>
                            <p className="current-sub-meta">
                                Status: <span className="badge-active">{currentSub.status}</span>
                                {currentSub.expires_at && <> &middot; Renews/Expires {new Date(currentSub.expires_at).toLocaleDateString()}</>}
                            </p>
                        </div>
                        <button className="btn-cancel-sub" onClick={() => setConfirmAction('plan')}>Cancel Subscription</button>
                    </div>
                )}

                <div className="plans-grid">
                    {plans.map((p) => (
                        <div className="plan-card-sub" key={p.id}>
                            <p className="plan-card-name">{p.name || p.id.toUpperCase()}</p>
                            <p className="plan-card-price">${p.price}<span>/{p.interval}</span></p>
                            <ul>
                                {p.features.map((f) => (
                                    <li key={f}>✓ {f}</li>
                                ))}
                            </ul>
                            {currentSub && currentSub.plan === p.id && currentSub.status === 'active' ? (
                                <button className="btn-subscribed" disabled>Current Plan</button>
                            ) : (
                                <button className="btn-subscribe" onClick={startCheckout}>Subscribe</button>
                            )}
                        </div>
                    ))}
                </div>

                <div className="addon-section">
                    <h2 className="addon-section-title">Add-ons</h2>
                    {addonError && <p className="error-msg">{addonError}</p>}
                    {addonSuccess && <p className="success-msg">{addonSuccess}</p>}

                    {hasSignalAccess && (
                        <div className="current-sub-card">
                            <div>
                                <p className="current-sub-label">Add-on Status</p>
                                <p className="current-sub-plan">Trader Access</p>
                                <p className="current-sub-meta">
                                    Status: <span className="badge-active">active</span>
                                </p>
                            </div>
                            <button className="btn-cancel-sub" onClick={() => setConfirmAction('signal')}>
                                Cancel Trader Access
                            </button>
                        </div>
                    )}

                    <div className="plans-grid">
                        {(() => {
                            const hasBasePlan = currentSub && currentSub.status === 'active'
                            return (
                                <div className={hasBasePlan ? 'plan-card-sub' : 'plan-card-sub plan-card-locked'}>
                                    <p className="plan-card-name">Trader Access</p>
                                    <p className="plan-card-price">${SIGNAL_ACCESS_PRICE}<span>/month</span></p>
                                    <ul>
                                        {SIGNAL_ACCESS_FEATURES.map((f) => (
                                            <li key={f}>✓ {f}</li>
                                        ))}
                                    </ul>
                                    {!hasBasePlan ? (
                                        <>
                                            <button className="btn-subscribed" disabled>Locked</button>
                                            <p className="addon-locked-msg">Subscribe to the Investor Plan first.</p>
                                        </>
                                    ) : !hasSignalAccess ? (
                                        <button className="btn-subscribe" onClick={startSignalAccessCheckout} disabled={addonLoading}>
                                            {addonLoading ? 'Processing...' : 'Subscribe'}
                                        </button>
                                    ) : (
                                        <button className="btn-subscribed" disabled>Active</button>
                                    )}
                                </div>
                            )
                        })()}
                    </div>
                </div>

                {confirmAction && (
                    <div className="confirm-overlay" onClick={() => setConfirmAction(null)}>
                        <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
                            <h3>{confirmAction === 'plan' ? 'Cancel Investor Plan?' : 'Cancel Trader Access?'}</h3>
                            <p>
                                {confirmAction === 'plan' ? (
                                    <>
                                        This cancels your Investor Plan.
                                        {hasSignalAccess && (
                                            <> Cancelling your Investor Plan will also cancel your active Trader Access add-on immediately — both will stop working right away.</>
                                        )}
                                    </>
                                ) : (
                                    'This removes Trader Access — trader connections and signal features will no longer be available. Your Investor Plan stays active.'
                                )}
                            </p>
                            <div className="confirm-actions">
                                <button className="btn-keep" onClick={() => setConfirmAction(null)}>Keep it</button>
                                <button className="btn-cancel-sub" onClick={confirmCancel}>Yes, Cancel</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </AppLayout>
    )
}

export default Subscription

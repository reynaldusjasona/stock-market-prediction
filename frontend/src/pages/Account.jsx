import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { api } from '../api/api'
import AppLayout from '../components/layout/AppLayout'
import '../styles/Account.css'

const MARKET_SECTORS = [
    'Technology',
    'Healthcare',
    'Financial Services',
    'Consumer Cyclical',
    'Consumer Defensive',
    'Energy',
    'Communication Services',
]

const RISK_LEVELS = ['low', 'moderate', 'high']

function Account() {
    const { user } = useAuth()
    const navigate = useNavigate()
    const userID = user?.id

    const [name, setName] = useState('')
    const [email, setEmail] = useState('')
    const [riskTolerance, setRiskTolerance] = useState('moderate')
    const [marketsFollowed, setMarketsFollowed] = useState([])
    const [profileLoading, setProfileLoading] = useState(true)
    const [profileSaving, setProfileSaving] = useState(false)
    const [profileError, setProfileError] = useState(null)
    const [profileSuccess, setProfileSuccess] = useState(null)

    const [subscription, setSubscription] = useState(null)
    const [plans, setPlans] = useState([])
    const [subLoading, setSubLoading] = useState(true)
    const [subError, setSubError] = useState(null)
    const [subSuccess, setSubSuccess] = useState(null)
    const [cancelling, setCancelling] = useState(false)

    useEffect(() => {
        if (!userID) return
        loadProfile()
        loadSubscription()
    }, [userID])

    async function loadProfile() {
        setProfileLoading(true)
        setProfileError(null)
        try {
            const [details, risk, prefs] = await Promise.all([
                api.get(`/auth/user/${userID}`),
                api.get(`/auth/user/${userID}/risk-tolerance`),
                api.get(`/auth/user/${userID}/preferences`),
            ])
            setName(details.name || '')
            setEmail(details.email || '')
            setRiskTolerance(risk.risk_tolerance || 'moderate')
            setMarketsFollowed(prefs.sector_preferences || [])
        } catch (err) {
            setProfileError(err.message)
        } finally {
            setProfileLoading(false)
        }
    }

    async function loadSubscription() {
        setSubLoading(true)
        setSubError(null)
        try {
            const [sub, planList] = await Promise.all([
                api.get('/subscription'),
                api.get('/subscription/plans'),
            ])
            setSubscription(sub)
            setPlans(planList)
        } catch (err) {
            setSubError(err.message)
        } finally {
            setSubLoading(false)
        }
    }

    function toggleMarket(sector) {
        setMarketsFollowed((prev) =>
            prev.includes(sector) ? prev.filter((s) => s !== sector) : [...prev, sector]
        )
    }

    async function saveProfile() {
        setProfileSaving(true)
        setProfileError(null)
        setProfileSuccess(null)
        try {
            await Promise.all([
                api.put(`/auth/user/${userID}`, { name }),
                api.put(`/auth/user/${userID}/risk-tolerance`, { level: riskTolerance }),
                api.put(`/auth/user/${userID}/preferences`, { preferences: marketsFollowed }),
            ])
            setProfileSuccess('Profile updated.')
        } catch (err) {
            setProfileError(err.message)
        } finally {
            setProfileSaving(false)
        }
    }

    async function handleCancelSubscription() {
        setCancelling(true)
        setSubError(null)
        setSubSuccess(null)
        try {
            await api.post('/subscription/cancel')
            setSubSuccess('Subscription cancelled.')
            await loadSubscription()
        } catch (err) {
            setSubError(err.message)
        } finally {
            setCancelling(false)
        }
    }

    const currentPlanInfo = subscription
        ? plans.find((p) => p.plan === subscription.plan)
        : null

    return (
        <AppLayout>
            <div className="account-content">
                <div className="account-header">
                    <h1>Account</h1>
                    <p>Manage your profile and subscription</p>
                </div>

                <div className="account-grid">
                    <div className="account-panel">
                        <h2>Profile</h2>

                        {profileLoading ? (
                            <p>Loading...</p>
                        ) : (
                            <>
                                {profileError && <p className="error-msg">{profileError}</p>}
                                {profileSuccess && <p className="success-msg">{profileSuccess}</p>}

                                <div className="form-group">
                                    <label>Full Name</label>
                                    <input value={name} onChange={(e) => setName(e.target.value)} />
                                </div>

                                <div className="form-group">
                                    <label>Email</label>
                                    <input value={email} disabled title="Email cannot be changed here" />
                                </div>

                                <div className="form-group">
                                    <label>Risk Tolerance</label>
                                    <select value={riskTolerance} onChange={(e) => setRiskTolerance(e.target.value)}>
                                        {RISK_LEVELS.map((level) => (
                                            <option key={level} value={level}>
                                                {level.charAt(0).toUpperCase() + level.slice(1)}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label>Markets Followed</label>
                                    <div className="markets-grid">
                                        {MARKET_SECTORS.map((sector) => (
                                            <label key={sector} className="market-checkbox">
                                                <input
                                                    type="checkbox"
                                                    checked={marketsFollowed.includes(sector)}
                                                    onChange={() => toggleMarket(sector)}
                                                />
                                                {sector}
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                <button className="btn-save-profile" onClick={saveProfile} disabled={profileSaving}>
                                    {profileSaving ? 'Saving...' : 'Save Changes'}
                                </button>
                            </>
                        )}
                    </div>

                    <div className="account-panel">
                        <h2>Subscription</h2>

                        {subLoading ? (
                            <p>Loading...</p>
                        ) : (
                            <>
                                {subError && <p className="error-msg">{subError}</p>}
                                {subSuccess && <p className="success-msg">{subSuccess}</p>}

                                {subscription ? (
                                    <div className="sub-summary">
                                        <div className="sub-summary-row">
                                            <span className="sub-summary-label">Plan</span>
                                            <span className="sub-summary-value">{subscription.plan.toUpperCase()}</span>
                                        </div>
                                        <div className="sub-summary-row">
                                            <span className="sub-summary-label">Status</span>
                                            <span className={subscription.status === 'active' ? 'sub-badge-active' : 'sub-badge-inactive'}>
                                                {subscription.status}
                                            </span>
                                        </div>
                                        <div className="sub-summary-row">
                                            <span className="sub-summary-label">Price</span>
                                            <span className="sub-summary-value">
                                                {currentPlanInfo ? `$${currentPlanInfo.price}/${currentPlanInfo.period}` : '-'}
                                            </span>
                                        </div>
                                        <div className="sub-summary-row">
                                            <span className="sub-summary-label">Next Billing Date</span>
                                            <span className="sub-summary-value">
                                                {subscription.expires_at
                                                    ? new Date(subscription.expires_at).toLocaleDateString()
                                                    : '-'}
                                            </span>
                                        </div>
                                        <div className="sub-summary-row">
                                            <span className="sub-summary-label">Payment Method</span>
                                            <span className="sub-summary-value">Not on file</span>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="empty-state">No active subscription.</p>
                                )}

                                <div className="sub-actions">
                                    <button className="btn-manage-plan" onClick={() => navigate('/subscription')}>
                                        Manage Plan
                                    </button>
                                    {subscription && subscription.status === 'active' && (
                                        <button
                                            className="btn-cancel-sub"
                                            onClick={handleCancelSubscription}
                                            disabled={cancelling}
                                        >
                                            {cancelling ? 'Cancelling...' : 'Cancel Subscription'}
                                        </button>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </AppLayout>
    )
}

export default Account

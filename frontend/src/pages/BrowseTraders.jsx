// GET /traders exists and is wired up below (public trader listing, not
// gated by signal access). Connecting uses the real POST /investor/engagements
// endpoint. Note: engagements are auto-active on creation - there is no
// pending/approval step in the backend today, so "connect" is instant, not
// a request the trader has to accept. Copy below is worded accordingly
// rather than implying a pending state that doesn't exist.
// Product rule: an investor may only be connected to one trader at a time -
// enforced backend-side in engageTrader, mirrored here so the UI never
// offers a second connection without disconnecting first.
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/api'
import { useAuth } from '../context/AuthContext'
import AppLayout from '../components/layout/AppLayout'
import '../styles/BrowseTraders.css'

function BrowseTraders() {
    const [notice, setNotice] = useState(null)
    const [connectError, setConnectError] = useState(null)
    const [traders, setTraders] = useState([])
    const [loading, setLoading] = useState(true)
    const [currentEngagement, setCurrentEngagement] = useState(null)
    const [connectingId, setConnectingId] = useState(null)
    const [disconnecting, setDisconnecting] = useState(false)
    const { isSubscribed, hasSignalAccess } = useAuth()
    const navigate = useNavigate()

    useEffect(() => {
        if (!isSubscribed) {
            setLoading(false)
            return
        }
        api.get('/traders')
            .then((data) => {
                const real = (data.traders || [])
                    // license_number is the meaningful legitimacy signal -
                    // it's collected and verified at registration.
                    // specialization/bio are profile polish with no way for
                    // a trader to fill them in later, so requiring them too
                    // risks showing zero real traders in production.
                    .filter((t) => t.license_number)
                    .map((t) => ({
                        id: t.id,
                        name: t.name,
                        license_number: t.license_number,
                        specialty: t.specialization || 'Generalist',
                        bio: t.bio || 'No bio provided yet.',
                    }))
                setTraders(real)
            })
            .catch((err) => console.log('traders failed:', err.message))
            .finally(() => setLoading(false))
    }, [isSubscribed])

    // pull the investor's current engagement so the page reflects real
    // state on load, not just after a click in this session. The backend
    // now enforces at most one active engagement, ordered most-recent-first,
    // so the first entry (if any) is the current one.
    useEffect(() => {
        if (!hasSignalAccess) return
        api.get('/investor/engagements/me')
            .then((data) => {
                const engagements = data.engagements || []
                setCurrentEngagement(engagements[0] || null)
            })
            .catch((err) => console.log('engagements failed:', err.message))
    }, [hasSignalAccess])

    async function handleRequestConnect(trader) {
        if (!hasSignalAccess) {
            navigate('/subscription')
            return
        }
        if (currentEngagement) return

        setNotice(null)
        setConnectError(null)
        setConnectingId(trader.id)
        try {
            const data = await api.post('/investor/engagements', { trader_id: trader.id })
            setCurrentEngagement({ ...data.engagement, trader: { name: trader.name } })
            setNotice(`Connected with ${trader.name}.`)
        } catch (err) {
            // a 409 here means the backend rejected a duplicate/second
            // engagement (e.g. a race with another tab) - surface it the
            // same as any other error rather than silently self-healing,
            // since the UI no longer assumes multiple engagements are valid
            setConnectError(err.message)
        } finally {
            setConnectingId(null)
        }
    }

    async function handleDisconnect() {
        if (!currentEngagement) return
        setNotice(null)
        setConnectError(null)
        setDisconnecting(true)
        try {
            await api.delete(`/investor/engagements/${currentEngagement.id}`)
            setNotice(`Disconnected from ${currentEngagement.trader?.name || 'your trader'}.`)
            setCurrentEngagement(null)
        } catch (err) {
            setConnectError(err.message)
        } finally {
            setDisconnecting(false)
        }
    }

    return (
        <AppLayout>
            <div className="browse-traders-content">
                <div className="browse-traders-header">
                    <h1>Browse Traders</h1>
                    <p>Find a professional trader and connect with them directly</p>
                </div>

                {notice && <p className="success-msg">{notice}</p>}
                {connectError && <p className="error-msg">{connectError}</p>}
                {!hasSignalAccess && (
                    <p className="signal-access-banner">
                        Subscribe to Signal Access to connect with traders.{' '}
                        <span onClick={() => navigate('/subscription')}>Subscribe now</span>
                    </p>
                )}
                {currentEngagement && (
                    <div className="current-trader-banner">
                        <span>
                            Currently connected to <strong>{currentEngagement.trader?.name || 'your trader'}</strong>.
                        </span>
                        <button className="btn-disconnect" onClick={handleDisconnect} disabled={disconnecting}>
                            {disconnecting ? 'Disconnecting...' : 'Disconnect'}
                        </button>
                    </div>
                )}

                {loading ? (
                    <p>Loading traders...</p>
                ) : traders.length === 0 ? (
                    <p className="empty-state">No traders available yet — check back soon.</p>
                ) : (
                    <div className="traders-grid">
                        {traders.map((trader) => {
                            const isCurrentTrader = currentEngagement?.trader_id === trader.id
                            const hasOtherEngagement = Boolean(currentEngagement) && !isCurrentTrader
                            const isConnecting = connectingId === trader.id
                            return (
                                <div className="trader-card" key={trader.id}>
                                    <div className="trader-avatar">{trader.name.charAt(0)}</div>
                                    <p className="trader-name">{trader.name}</p>
                                    <p className="trader-license">{trader.license_number}</p>
                                    <p className="trader-specialty">{trader.specialty}</p>
                                    <p className="trader-bio">{trader.bio}</p>
                                    {isCurrentTrader ? (
                                        <span className="status-connected">✓ Connected</span>
                                    ) : (
                                        <button
                                            className="btn-connect"
                                            onClick={() => handleRequestConnect(trader)}
                                            disabled={isConnecting || hasOtherEngagement}
                                        >
                                            {!hasSignalAccess
                                                ? 'Subscribe to Connect'
                                                : hasOtherEngagement
                                                ? 'Disconnect your current trader first'
                                                : isConnecting ? 'Connecting...' : 'Connect'}
                                        </button>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </AppLayout>
    )
}

export default BrowseTraders

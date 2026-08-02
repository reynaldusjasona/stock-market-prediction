// GET /traders exists and is wired up below (public trader listing, not
// gated by signal access). Connecting uses the real POST /investor/engagements
// endpoint. Note: engagements are auto-active on creation - there is no
// pending/approval step in the backend today, so "connect" is instant, not
// a request the trader has to accept. Copy below is worded accordingly
// rather than implying a pending state that doesn't exist.
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
    const [engagedTraderIds, setEngagedTraderIds] = useState(new Set())
    const [connectingId, setConnectingId] = useState(null)
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
                    .filter((t) => t.license_number && (t.specialization || t.bio))
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

    // pull the investor's current engagements so cards reflect real state
    // on load, not just after a click in this session
    useEffect(() => {
        if (!hasSignalAccess) return
        api.get('/investor/engagements/me')
            .then((data) => {
                const ids = (data.engagements || []).map((e) => e.trader_id)
                setEngagedTraderIds(new Set(ids))
            })
            .catch((err) => console.log('engagements failed:', err.message))
    }, [hasSignalAccess])

    async function handleRequestConnect(trader) {
        if (!hasSignalAccess) {
            navigate('/subscription')
            return
        }
        if (engagedTraderIds.has(trader.id)) return

        setNotice(null)
        setConnectError(null)
        setConnectingId(trader.id)
        try {
            await api.post('/investor/engagements', { trader_id: trader.id })
            setEngagedTraderIds((prev) => new Set(prev).add(trader.id))
            setNotice(`Connected with ${trader.name}.`)
        } catch (err) {
            if (err.status === 409) {
                // backend already considers this pair engaged - reflect that
                // instead of surfacing it as a failure
                setEngagedTraderIds((prev) => new Set(prev).add(trader.id))
                setNotice(`You're already connected with ${trader.name}.`)
            } else {
                setConnectError(err.message)
            }
        } finally {
            setConnectingId(null)
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

                {loading ? (
                    <p>Loading traders...</p>
                ) : traders.length === 0 ? (
                    <p className="empty-state">No traders available yet — check back soon.</p>
                ) : (
                    <div className="traders-grid">
                        {traders.map((trader) => {
                            const isConnected = engagedTraderIds.has(trader.id)
                            const isConnecting = connectingId === trader.id
                            return (
                                <div className="trader-card" key={trader.id}>
                                    <div className="trader-avatar">{trader.name.charAt(0)}</div>
                                    <p className="trader-name">{trader.name}</p>
                                    <p className="trader-license">{trader.license_number}</p>
                                    <p className="trader-specialty">{trader.specialty}</p>
                                    <p className="trader-bio">{trader.bio}</p>
                                    {isConnected ? (
                                        <span className="status-connected">✓ Connected</span>
                                    ) : (
                                        <button
                                            className="btn-connect"
                                            onClick={() => handleRequestConnect(trader)}
                                            disabled={isConnecting}
                                        >
                                            {!hasSignalAccess
                                                ? 'Subscribe to Connect'
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

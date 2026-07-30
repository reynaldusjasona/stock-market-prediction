// GET /traders exists and is wired up below. Sending a connection
// request still isn't - there is no POST /engagements backend yet, so
// "Request to Connect" stays a "coming soon" placeholder. Don't wire that
// part up to traderApi.js's engageTrader/getOwnEngagement/endEngagement
// until that endpoint exists.
import { useState, useEffect } from 'react'
import { api } from '../api/api'
import AppLayout from '../components/layout/AppLayout'
import '../styles/BrowseTraders.css'

function BrowseTraders() {
    const [notice, setNotice] = useState(null)
    const [traders, setTraders] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
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
    }, [])

    function handleRequestConnect(trader) {
        setNotice(`This feature is launching soon. You'll be able to connect with ${trader.name} directly.`)
    }

    return (
        <AppLayout>
            <div className="browse-traders-content">
                <div className="browse-traders-header">
                    <h1>Browse Traders</h1>
                    <p>Find a professional trader to follow and request a connection</p>
                </div>

                {notice && <p className="success-msg">{notice}</p>}

                {loading ? (
                    <p>Loading traders...</p>
                ) : traders.length === 0 ? (
                    <p className="empty-state">No traders available yet — check back soon.</p>
                ) : (
                    <div className="traders-grid">
                        {traders.map((trader) => (
                            <div className="trader-card" key={trader.id}>
                                <div className="trader-avatar">{trader.name.charAt(0)}</div>
                                <p className="trader-name">{trader.name}</p>
                                <p className="trader-license">{trader.license_number}</p>
                                <p className="trader-specialty">{trader.specialty}</p>
                                <p className="trader-bio">{trader.bio}</p>
                                <button className="btn-connect" onClick={() => handleRequestConnect(trader)}>
                                    Request to Connect
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </AppLayout>
    )
}

export default BrowseTraders

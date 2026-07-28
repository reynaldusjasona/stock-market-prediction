// UI scaffolding only — pending backend implementation.
// There is no backend support yet for listing traders or sending a
// connection request (no GET /traders, no POST /engagements). This page
// renders mock trader profiles and a "Request to Connect" button that
// only shows a "coming soon" message, per that gap. Do not wire this up
// to traderApi.js's listTraders/engageTrader/getOwnEngagement/endEngagement
// until the backend endpoints exist.
import { useState } from 'react'
import AppLayout from '../components/layout/AppLayout'
import '../styles/BrowseTraders.css'

const MOCK_TRADERS = [
    {
        id: 'mock-1',
        name: 'Alex Rivera',
        license_number: 'CFA-48213',
        specialty: 'Growth & Technology Equities',
        bio: '12 years managing tech-focused portfolios. Favors momentum plays backed by earnings surprises.',
    },
    {
        id: 'mock-2',
        name: 'Priya Nandakumar',
        license_number: 'CFA-59027',
        specialty: 'Dividend & Value Investing',
        bio: 'Specializes in undervalued blue-chips with strong cash flow. Conservative, long-horizon approach.',
    },
    {
        id: 'mock-3',
        name: 'Marcus Webb',
        license_number: 'CFA-33190',
        specialty: 'Options & Derivatives',
        bio: 'Focuses on hedged strategies and volatility plays for risk-aware investors.',
    },
    {
        id: 'mock-4',
        name: 'Sofia Alvarez',
        license_number: 'CFA-61455',
        specialty: 'Emerging Markets',
        bio: 'Tracks high-growth opportunities across Asia and Latin America equities.',
    },
]

function BrowseTraders() {
    const [notice, setNotice] = useState(null)

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

                <div className="traders-grid">
                    {MOCK_TRADERS.map((trader) => (
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
            </div>
        </AppLayout>
    )
}

export default BrowseTraders

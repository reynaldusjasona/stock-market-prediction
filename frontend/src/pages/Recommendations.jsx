import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { api } from '../api/api'
import '../styles/Recommendations.css'
import ViewStockRecommendation from '../components/recommendations/ViewStockRecommendation'
import ViewRecommendationHistory from '../components/recommendations/ViewRecommendationHistory'

function Recommendations() {
    const [recommendations, setRecommendations] = useState([])
    const [loading, setLoading] = useState(true)
    const navigate = useNavigate()
    const { user, logout } = useAuth()
    const isTrader = user?.role === 'trader'

    function handleLogout() {
        logout()
        navigate('/login')
    }

    // first get trending stocks, then get a prediction for each one
    async function loadRecommendations() {
        let trending = []
        try {
            trending = await api.get('/stocks/trending')
        } catch (err) {
            console.log('trending failed:', err.message)
        }

        const results = []
        for (const stock of trending) {
            try {
                const pred = await api.get(`/predictions/${stock.ticker}`)
                results.push({
                    ticker: stock.ticker,
                    signal: pred.signal,
                    confidence: pred.confidence,
                    risk_level: pred.risk_level,
                    reasoning: pred.reasoning,
                })
            } catch (err) {
                console.log(`prediction failed for ${stock.ticker}:`, err.message)
            }
        }
        setRecommendations(results)
        setLoading(false)
    }

    useEffect(() => {
        loadRecommendations()
    }, [])

    if (loading) return <p>Loading...</p>

    return (
        <div className="recommendations-page">
                                                <aside className="sidebar">
                <div className="sidebar-logo">StockWise <span>AI</span></div>

                {/* Both roles */}
                <span className="sidebar-link" onClick={() => navigate('/dashboard')}>Dashboard</span>
                <span className="sidebar-link" onClick={() => navigate('/allstocks')}>All Stocks</span>
                <span className="sidebar-link" onClick={() => navigate('/notifications')}>Notifications</span>
                <span className="sidebar-link" onClick={() => navigate('/feedback')}>Feedback</span>

                {/* Investor only */}
                {!isTrader && (
                    <>
                        <span className="sidebar-link active" onClick={() => navigate('/recommendations')}>Recommendations</span>
                        <span className="sidebar-link" onClick={() => navigate('/watchlist')}>Watchlist</span>
                        <span className="sidebar-link" onClick={() => navigate('/portfolio')}>Portfolio</span>
                        <span className="sidebar-link" onClick={() => navigate('/alerts')}>Alerts</span>
                        <span className="sidebar-logout" onClick={handleLogout}>Logout</span>
                    </>
                )}

                {/* Trader — Back to Trader Portal + Logout pinned to bottom */}
                {isTrader && (
                    <div style={{ marginTop:'auto', borderTop:'1px solid rgba(255,255,255,0.06)', paddingTop:'0.5rem' }}>
                        <span className="sidebar-link" onClick={() => navigate('/trader/dashboard')}>
                            ← Back to Trader Portal
                        </span>
                        <span className="sidebar-logout" onClick={handleLogout}>Logout</span>
                    </div>
                )}
            </aside>

            <div className="recommendations-content">
                <div className="recommendations-header">
                    <h1>Recommendations</h1>
                    <p>AI-generated Buy / Hold / Sell signals for trending stocks</p>
                </div>

                <ViewStockRecommendation recommendations={recommendations} />
                <ViewRecommendationHistory />
            </div>
        </div>
    )
}

export default Recommendations

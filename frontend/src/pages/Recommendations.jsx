import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/api'
import AppLayout from '../components/layout/AppLayout'
import '../styles/Recommendations.css'
import ViewStockRecommendation from '../components/recommendations/ViewStockRecommendation'
import ViewRecommendationHistory from '../components/recommendations/ViewRecommendationHistory'

function Recommendations() {
    const [recommendations, setRecommendations] = useState([])
    const [loading, setLoading] = useState(true)
    const navigate = useNavigate()
    const { user, logout } = useAuth()
    const isTrader = user?.role === 'trader'

    async function loadRecommendations() {
        try {
            const data = await api.get('/recommendations/personalized?limit=20')
            setRecommendations(data.recommendations || [])
        } catch (err) {
            console.log('personalized recommendations failed:', err.message)
            try {
                const fallback = await api.get('/recommendations?limit=20')
                setRecommendations(fallback.recommendations || [])
            } catch (fallbackErr) {
                console.log('general recommendations failed:', fallbackErr.message)
            }
        } finally {
            setLoading(false)
        }
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
                    <p>AI-generated Buy / Hold / Sell signals tailored to your profile</p>
                </div>

                <ViewStockRecommendation recommendations={recommendations} navigate={navigate} />
                <ViewRecommendationHistory />
            </div>
        </AppLayout>
    )
}

export default Recommendations

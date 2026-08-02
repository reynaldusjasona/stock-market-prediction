import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/api'
import { formatPrice as fmt } from '../utils/format'
import { useAuth } from '../context/AuthContext'
import AppLayout from '../components/layout/AppLayout'
import CompleteProfileModal from '../components/CompleteProfileModal'
import '../styles/Dashboard.css'
import '../styles/Recommendations.css'
import ViewTrendingTickers from '../components/dashboard/ViewTrendingTickers'
import ViewTopGainersLosers from '../components/dashboard/ViewTopGainersLosers'
import ViewStocksList from '../components/dashboard/ViewStocksList'
import ViewStockRecommendation from '../components/recommendations/ViewStockRecommendation'

const PROFILE_MODAL_DISMISSED_KEY = 'profileModalDismissed'

function Dashboard() {
    const [trendList, setTrendList] = useState([])
    const [gainers, setGainers] = useState([])
    const [losers, setLosers] = useState([])
    const [stockList, setStockList] = useState([])
    const [recommendations, setRecommendations] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [showProfileModal, setShowProfileModal] = useState(false)
    const navigate = useNavigate()
    const { user, isSubscribed } = useAuth()

    // get all data needed for dashboard
    async function getData() {
        if (!isSubscribed) {
            setLoading(false)
            return
        }

        try {
            const trendData = await api.get('/stocks/trending')
            setTrendList(trendData)
        } catch (err) {
            console.log('trending failed:', err.message)
        }

        try {
            const moverData = await api.get('/stocks/movers')
            setGainers(moverData.gainers || [])
            setLosers(moverData.losers || [])
        } catch (err) {
            console.log('movers failed:', err.message)
        }

        try {
            const allStocks = await api.get('/stocks')
            setStockList(allStocks)
        } catch (err) {
            console.log('stocks failed:', err.message)
        }

        try {
            const recData = await api.get('/recommendations/personalized?limit=3')
            setRecommendations(recData.recommendations || [])
        } catch (err) {
            console.log('recommendations failed:', err.message)
        }

        // opportunistically check price alerts here too, since dashboard is
        // usually the first page visited after login - no need to block
        // the rest of the page on this
        api.post('/alerts/check-all').catch((err) => console.log('alert check failed:', err.message))

        setLoading(false)
    }

    useEffect(() => {
        getData()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isSubscribed])

    // show the complete-profile nudge once per login session if the
    // investor hasn't picked any markets yet - risk_tolerance always has
    // a default value from registration, so it can't be used as the
    // "incomplete" signal, sector_preferences being empty is the real one.
    // Deferred until after subscribing - no point nudging someone to set up
    // personalization for a feature they can't access yet.
    useEffect(() => {
        if (!user?.id || !isSubscribed) return
        if (sessionStorage.getItem(PROFILE_MODAL_DISMISSED_KEY)) return

        api.get(`/auth/user/${user.id}/preferences`)
            .then((data) => {
                if (!data.sector_preferences || data.sector_preferences.length === 0) {
                    setShowProfileModal(true)
                }
            })
            .catch((err) => console.log('preferences check failed:', err.message))
    }, [user?.id, isSubscribed])

    function dismissProfileModal() {
        sessionStorage.setItem(PROFILE_MODAL_DISMISSED_KEY, 'true')
        setShowProfileModal(false)
    }

    if (loading) return <p>Loading...</p>
    if (error) return <p>{error}</p>


    return (
        <AppLayout>
            {showProfileModal && (
                <CompleteProfileModal
                    userID={user.id}
                    onDone={dismissProfileModal}
                    onDismiss={dismissProfileModal}
                />
            )}

            <div className="page-header">
                <h1>Welcome back, Investor</h1>
                <p>Market analysis is updated and ready for your next move.</p>
            </div>

            <h2 className="section-heading">Market Overview</h2>

            <div className="market-grid">
                <ViewTrendingTickers trendList={trendList} fmt={fmt} navigate={navigate} />
                <ViewTopGainersLosers gainers={gainers} losers={losers} fmt={fmt} navigate={navigate} />
            </div>

            <ViewStocksList stockList={stockList} navigate={navigate} fmt={fmt} />

            <div className="dashboard-recommendations">
                <div className="dashboard-recommendations-header">
                    <h2 className="section-heading">AI Recommendations</h2>
                    <span className="view-all-link" onClick={() => navigate('/recommendations')}>
                        View All Recommendations &rarr;
                    </span>
                </div>
                {recommendations.length === 0 ? (
                    <p className="empty-state">No recommendations available yet.</p>
                ) : (
                    <ViewStockRecommendation recommendations={recommendations} navigate={navigate} />
                )}
            </div>
        </AppLayout>
    )
}
export default Dashboard

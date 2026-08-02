import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/api'
import { useAuth } from '../context/AuthContext'
import AppLayout from '../components/layout/AppLayout'
import LockedFeature from '../components/LockedFeature'
import '../styles/Recommendations.css'
import ViewStockRecommendation from '../components/recommendations/ViewStockRecommendation'
import ViewRecommendationHistory from '../components/recommendations/ViewRecommendationHistory'

function Recommendations() {
    const [recommendations, setRecommendations] = useState([])
    const [loading, setLoading] = useState(true)
    const navigate = useNavigate()
    const { isSubscribed } = useAuth()

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
        if (isSubscribed) {
            loadRecommendations()
        } else {
            setLoading(false)
        }
    }, [isSubscribed])

    if (loading) return <p>Loading...</p>

    return (
        <AppLayout>
            <div className="recommendations-content">
                <div className="recommendations-header">
                    <h1>Recommendations</h1>
                    <p>AI-generated Buy / Hold / Sell signals tailored to your profile</p>
                </div>

                <LockedFeature
                    title="AI Recommendations"
                    description="Subscribe to unlock personalized Buy / Hold / Sell signals tailored to your risk tolerance and holdings."
                >
                    <ViewStockRecommendation recommendations={recommendations} navigate={navigate} />
                    <ViewRecommendationHistory />
                </LockedFeature>
            </div>
        </AppLayout>
    )
}

export default Recommendations

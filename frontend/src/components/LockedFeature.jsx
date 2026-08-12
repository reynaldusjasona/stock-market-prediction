import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import '../styles/LockedFeature.css'

// Wraps a premium feature: shows the real content once subscribed, an
// in-place "subscribe to unlock" prompt otherwise. Never redirects - the
// point is to explain what's missing, not bounce the user away.
function LockedFeature({ title, description, children }) {
    const { isSubscribed, subscriptionLoaded } = useAuth()
    const navigate = useNavigate()

    if (!subscriptionLoaded) return null
    if (isSubscribed) return children

    return (
        <div className="locked-feature">
            <div className="locked-feature-icon">🔒</div>
            <h3>{title}</h3>
            <p>{description}</p>
            <button className="btn-unlock" onClick={() => navigate('/subscription')}>
                Subscribe to Unlock
            </button>
        </div>
    )
}

export default LockedFeature

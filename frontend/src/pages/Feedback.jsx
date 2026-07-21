import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { api } from '../api/api'
import '../styles/Feedback.css'

function Feedback() {
    const [subject, setSubject] = useState('')
    const [message, setMessage] = useState('')
    const [rating, setRating] = useState(0)
    const [error, setError] = useState(null)
    const [success, setSuccess] = useState(false)
    const navigate = useNavigate()
    const { user, logout } = useAuth()
    const isTrader = user?.role === 'trader'

    function handleLogout() {
        logout()
        navigate('/login')
    }

    // submit feedback to backend
    async function submitFeedback() {
        if (!subject || !message) return
        try {
            await api.post('/feedback', { subject, message })
            setSuccess(true)
            setSubject('')
            setMessage('')
            setRating(0)
        } catch (err) {
            setError(err.message)
        }
    }

    return (
        <div className="feedback-page">
                                                <aside className="sidebar">
                <div className="sidebar-logo">StockWise <span>AI</span></div>

                {/* Both roles */}
                <span className="sidebar-link" onClick={() => navigate('/dashboard')}>Dashboard</span>
                <span className="sidebar-link" onClick={() => navigate('/allstocks')}>All Stocks</span>
                <span className="sidebar-link" onClick={() => navigate('/notifications')}>Notifications</span>
                <span className="sidebar-link active" onClick={() => navigate('/feedback')}>Feedback</span>

                {/* Investor only */}
                {!isTrader && (
                    <>
                        <span className="sidebar-link" onClick={() => navigate('/recommendations')}>Recommendations</span>
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

            <div className="feedback-content">
                <div className="feedback-header">
                    <h1>Feedback</h1>
                    <p>Tell us what you think of StockWise AI</p>
                </div>

                {success && <p className="success-msg">Feedback submitted! Thank you.</p>}

                <div className="feedback-form">
                    {error && <p className="error-msg">{error}</p>}

                    <div className="stars-row">
                        <label>Experience Rating</label>
                        {[1, 2, 3, 4, 5].map((star) => (
                            <span
                                key={star}
                                className={`star ${star <= rating ? 'filled' : ''}`}
                                onClick={() => setRating(star)}
                            >
                                ★
                            </span>
                        ))}
                    </div>

                    <div className="form-group">
                        <label>Subject</label>
                        <input
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                            placeholder="Brief summary"
                        />
                    </div>

                    <div className="form-group">
                        <label>Message</label>
                        <textarea
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            placeholder="Share your thoughts..."
                        />
                    </div>

                    <div className="info-box">
                        Approved feedback may appear as a testimonial on our homepage. We appreciate your contribution to making StockWise AI better.
                    </div>

                    <button className="btn-submit" onClick={submitFeedback}>
                        Submit Feedback ▷
                    </button>
                </div>
            </div>
        </div>
    )
}

export default Feedback
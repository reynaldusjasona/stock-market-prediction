import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { api } from '../api/api'
import '../styles/Login.css'

function Verify() {
    const [searchParams] = useSearchParams()
    const navigate = useNavigate()
    const [status, setStatus] = useState('verifying')
    const [message, setMessage] = useState('')

    useEffect(() => {
        const token = searchParams.get('token')
        if (!token) {
            setStatus('error')
            setMessage('Missing verification token.')
            return
        }
        api.get(`/auth/verify/${token}`)
            .then((data) => {
                setStatus('success')
                setMessage(data.message || 'Email verified successfully. You can now log in.')
            })
            .catch((err) => {
                setStatus('error')
                setMessage(err.message || 'Invalid or expired verification link.')
            })
    }, [searchParams])

    return (
        <div className="login-page">
            <div className="login-left">
                <h2>Predict the Market with <span>AI Precision</span></h2>
                <p>Access institutional-grade technical analysis and predictive modeling powered by our proprietary neural networks.</p>
            </div>
            <div className="login-right">
                <h1>Email Verification</h1>
                {status === 'verifying' && <p className="subtitle">Verifying your email...</p>}
                {status === 'success' && (
                    <>
                        <p className="subtitle">{message}</p>
                        <button className="btn-full" onClick={() => navigate('/login')}>Go to login</button>
                    </>
                )}
                {status === 'error' && (
                    <>
                        <p className="error-msg">{message}</p>
                        <button className="btn-full" onClick={() => navigate('/login')}>Back to login</button>
                    </>
                )}
            </div>
        </div>
    )
}

export default Verify

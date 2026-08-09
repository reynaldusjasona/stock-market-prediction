import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { api } from '../api/api'
import ForgotPasswordModal from '../components/ForgotPasswordModal'
import '../styles/AuthLayout.css'

function Login() {
    const [email,    setEmail]    = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState(null)
    const [resendMessage, setResendMessage] = useState(null)
    const [showForgotPassword, setShowForgotPassword] = useState(false)
    const { login } = useAuth()
    const navigate  = useNavigate()

    async function handleLogin() {
        try {
            setResendMessage(null)
            const data = await api.post('/auth/login', { email, password })
            login(data.user, data.token)

            const role = data.user?.role

            if (role === 'trader') {
                navigate('/trader/dashboard')
            } else {
                navigate('/dashboard')
            }
        } catch (err) {
            setError(err.message)
        }
    }

    async function handleResendVerification() {
        if (!email) {
            setError('Enter your email above first, then resend the verification link.')
            return
        }
        try {
            const data = await api.post('/auth/resend-verification', { email })
            setError(null)
            setResendMessage(data.message)
        } catch (err) {
            setError(err.message)
        }
    }

    return (
        <div className="auth-page">
            <div className="auth-panel">
                <div className="auth-right">
                    <p className="auth-logo">StockWise <span>AI</span></p>
                    <h1>Welcome back</h1>
                    <p className="subtitle">Please enter your credentials to access your dashboard.</p>
                    {error && <p className="error-msg">{error}</p>}
                    {resendMessage && <p className="subtitle">{resendMessage}</p>}
                    <div className="form-group">
                        <label>Email Address</label>
                        <input type="email" placeholder="name@company.com"
                            value={email} onChange={e => setEmail(e.target.value)}/>
                    </div>
                    <div className="form-group">
                        <label>Password</label>
                        <input type="password" placeholder="••••••••"
                            value={password} onChange={e => setPassword(e.target.value)}/>
                    </div>
                    <p className="auth-footer forgot-password-link">
                        <span onClick={() => setShowForgotPassword(true)}>Forgot Password?</span>
                    </p>
                    <button className="btn-full" onClick={handleLogin}>Log in →</button>
                    <p className="auth-footer">Didn't get a verification email? <span onClick={handleResendVerification}>Resend it</span></p>
                    <p className="auth-footer">Don't have an account? <span onClick={() => navigate('/register')}>Register</span></p>
                </div>
            </div>
            {showForgotPassword && (
                <ForgotPasswordModal onClose={() => setShowForgotPassword(false)} />
            )}
        </div>
    )
}

export default Login

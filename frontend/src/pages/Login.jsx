import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { api } from '../api/api'
import ForgotPasswordModal from '../components/ForgotPasswordModal'
import '../styles/AuthLayout.css'
import '../styles/Register.css'

function friendlyError(err) {
    if (err.status === 429) {
        return 'Too many attempts, try again in a few minutes.'
    }
    return err.message
}

function Login() {
    const [step, setStep] = useState('credentials') // 'credentials' | 'otp'
    const [email,    setEmail]    = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState(null)
    const [resendMessage, setResendMessage] = useState(null)
    const [showForgotPassword, setShowForgotPassword] = useState(false)
    const [loading, setLoading] = useState(false)

    const [loginChallenge, setLoginChallenge] = useState('')
    const [code, setCode] = useState('')
    const [otpInfo, setOtpInfo] = useState(null)
    const [otpError, setOtpError] = useState(null)
    const [otpLoading, setOtpLoading] = useState(false)
    const [resendLoading, setResendLoading] = useState(false)

    const { login } = useAuth()
    const navigate  = useNavigate()

    function completeLogin(data) {
        login(data.user, data.token)
        const role = data.user?.role
        if (role === 'trader') {
            navigate('/trader/dashboard')
        } else {
            navigate('/dashboard')
        }
    }

    async function handleLogin() {
        setError(null)
        setResendMessage(null)
        setLoading(true)
        try {
            const data = await api.post('/auth/request-login-otp', { email, password })
            setLoginChallenge(data.login_challenge)
            setOtpInfo(data.message)
            setStep('otp')
        } catch (err) {
            setError(friendlyError(err))
        } finally {
            setLoading(false)
        }
    }

    async function handleVerifyOtp(e) {
        e.preventDefault()
        setOtpError(null)
        if (!code.trim()) {
            setOtpError('Enter the code we emailed you.')
            return
        }
        setOtpLoading(true)
        try {
            const data = await api.post('/auth/verify-login-otp', {
                login_challenge: loginChallenge,
                code: code.trim(),
            })
            completeLogin(data)
        } catch (err) {
            setOtpError(friendlyError(err))
        } finally {
            setOtpLoading(false)
        }
    }

    async function handleResendOtp() {
        setOtpError(null)
        setOtpInfo(null)
        setResendLoading(true)
        try {
            const data = await api.post('/auth/request-login-otp', { email, password })
            setLoginChallenge(data.login_challenge)
            setOtpInfo(data.message)
            setCode('')
        } catch (err) {
            setOtpError(friendlyError(err))
        } finally {
            setResendLoading(false)
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

    if (step === 'otp') {
        return (
            <div className="auth-page">
                <div className="auth-panel">
                    <div className="auth-right">
                        <p className="auth-logo">StockWise <span>AI</span></p>
                        <h1>Enter your code</h1>
                        <p className="subtitle">
                            We sent a 6-digit code to <strong>{email}</strong>. It expires in 5 minutes.
                        </p>
                        {otpInfo && <p className="success-msg">{otpInfo}</p>}
                        {otpError && <p className="error-msg">{otpError}</p>}
                        <form onSubmit={handleVerifyOtp}>
                            <div className="form-group">
                                <label>Login Code</label>
                                <input type="text" inputMode="numeric" maxLength={6} placeholder="123456"
                                    value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} autoFocus/>
                            </div>
                            <button type="submit" className="btn-full" disabled={otpLoading}>
                                {otpLoading ? 'Verifying...' : 'Verify code'}
                            </button>
                        </form>
                        <p className="auth-footer">
                            Didn't get a code?{' '}
                            <span onClick={handleResendOtp}>{resendLoading ? 'Sending...' : 'Resend it'}</span>
                        </p>
                        <p className="auth-footer">
                            <span onClick={() => { setStep('credentials'); setCode(''); setOtpError(null); setOtpInfo(null) }}>
                                Use different credentials
                            </span>
                        </p>
                    </div>
                </div>
            </div>
        )
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
                    <button className="btn-full" onClick={handleLogin} disabled={loading}>
                        {loading ? 'Logging in...' : 'Log in →'}
                    </button>
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

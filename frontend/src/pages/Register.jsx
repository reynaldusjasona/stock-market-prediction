import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api/api'
import '../styles/AuthLayout.css'
import '../styles/Register.css'

function friendlyError(err) {
    if (err.status === 429) {
        return 'Too many attempts, try again in a few minutes.'
    }
    return err.message
}

function Register() {
    const [step, setStep] = useState('form') // 'form' | 'otp' | 'done'
    const [name, setName] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [role, setRole] = useState('investor')
    const [licenseNumber, setLicenseNumber] = useState('')
    const [error, setError] = useState(null)
    const [loading, setLoading] = useState(false)

    const [code, setCode] = useState('')
    const [otpError, setOtpError] = useState(null)
    const [otpInfo, setOtpInfo] = useState(null)
    const [otpLoading, setOtpLoading] = useState(false)
    const [resendLoading, setResendLoading] = useState(false)

    const navigate = useNavigate()
    const [searchParams] = useSearchParams()
    const cameToSubscribe = searchParams.get('intent') === 'subscribe'

    async function handleRegister() {
        setError(null)
        if (role === 'trader' && !licenseNumber.trim()) {
            setError('License number is required for trader registration')
            return
        }
        setLoading(true)
        try {
            const body = { name, email, password, role }
            if (role === 'trader') {
                body.license_number = licenseNumber.trim()
            }
            await api.post('/auth/register', body)
            setStep('otp')
        } catch (err) {
            setError(err.message)
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
            await api.post('/auth/verify-register-otp', { email: email.trim(), code: code.trim() })
            setStep('done')
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
            const data = await api.post('/auth/resend-verification', { email: email.trim() })
            setOtpInfo(data.message)
        } catch (err) {
            setOtpError(friendlyError(err))
        } finally {
            setResendLoading(false)
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
                                <label>Verification Code</label>
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
                    </div>
                </div>
            </div>
        )
    }

    if (step === 'done') {
        return (
            <div className="auth-page">
                <div className="auth-panel">
                    <div className="auth-right">
                        <p className="auth-logo">StockWise <span>AI</span></p>
                        <h1>Email verified</h1>
                        <p className="subtitle">Your account is ready. You can now log in.</p>
                        {role === 'trader' && (
                            <p className="subtitle">
                                Trader accounts also require admin approval. An admin will need to review your
                                license before you can log in.
                            </p>
                        )}
                        {role === 'investor' && cameToSubscribe && (
                            <p className="subtitle">
                                Head to your Account page after logging in to subscribe and unlock AI predictions,
                                recommendations, and price alerts.
                            </p>
                        )}
                        <button className="btn-full" onClick={() => navigate('/login')}>Go to login</button>
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
                    <h1>Create your account</h1>
                    <p className="subtitle">Enter your details to create your account.</p>
                    {error && <p className="error-msg">{error}</p>}
                    <div className="form-group">
                        <label>Full Name</label>
                        <input type="text" placeholder="John Doe" value={name} onChange={(e) => setName(e.target.value)} />
                    </div>
                    <div className="form-group">
                        <label>Email Address</label>
                        <input type="email" placeholder="name@company.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                    </div>
                    <div className="form-group">
                        <label>Password</label>
                        <input type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
                    </div>
                    <div className="form-group">
                        <label>I am registering as</label>
                        <div className="role-toggle">
                            <label className={role === 'investor' ? 'role-option active' : 'role-option'}>
                                <input
                                    type="radio"
                                    name="role"
                                    value="investor"
                                    checked={role === 'investor'}
                                    onChange={() => setRole('investor')}
                                />
                                Investor
                            </label>
                            <label className={role === 'trader' ? 'role-option active' : 'role-option'}>
                                <input
                                    type="radio"
                                    name="role"
                                    value="trader"
                                    checked={role === 'trader'}
                                    onChange={() => setRole('trader')}
                                />
                                Trader
                            </label>
                        </div>
                    </div>
                    {role === 'trader' && (
                        <div className="form-group">
                            <label>License Number</label>
                            <input
                                type="text"
                                placeholder="CFA-12345"
                                value={licenseNumber}
                                onChange={(e) => setLicenseNumber(e.target.value)}
                            />
                        </div>
                    )}
                    <button className="btn-full" onClick={handleRegister} disabled={loading}>
                        {loading ? 'Creating account...' : 'Create Account'}
                    </button>
                    <p className="auth-footer">Already have an account? <span onClick={() => navigate('/login')}>Log in</span></p>
                </div>
            </div>
        </div>
    )
}

export default Register
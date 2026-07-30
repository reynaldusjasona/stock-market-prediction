import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api/api'
import '../styles/AuthLayout.css'
import '../styles/Register.css'

function Register() {
    const [name, setName] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [role, setRole] = useState('investor')
    const [licenseNumber, setLicenseNumber] = useState('')
    const [error, setError] = useState(null)
    const [registered, setRegistered] = useState(false)
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()
    const cameToSubscribe = searchParams.get('intent') === 'subscribe'

    async function handleRegister() {
        setError(null)
        if (role === 'trader' && !licenseNumber.trim()) {
            setError('License number is required for trader registration')
            return
        }
        try {
            const body = { name, email, password, role }
            if (role === 'trader') {
                body.license_number = licenseNumber.trim()
            }
            await api.post('/auth/register', body)
            setRegistered(true)
        } catch (err) {
            setError(err.message)
        }
    }

    if (registered) {
        return (
            <div className="auth-page">
                <div className="auth-panel">
                    <div className="auth-right">
                        <p className="auth-logo">StockWise <span>AI</span></p>
                        <h1>Check your email</h1>
                        <p className="subtitle">
                            We sent a verification link to <strong>{email}</strong>. Click the link to activate your
                            account, then log in.
                        </p>
                        {role === 'trader' && (
                            <p className="subtitle">
                                Trader accounts also require admin approval. Once you've verified your email, you'll
                                need to wait for an admin to review your license before you can log in.
                            </p>
                        )}
                        {role === 'investor' && cameToSubscribe && (
                            <p className="subtitle">
                                Once you've verified your email and logged in, head to your Account page to subscribe
                                and unlock AI predictions, recommendations, and price alerts.
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
                    <p className="subtitle">Enter your details to start your 14-day premium trial.</p>
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
                    <button className="btn-full" onClick={handleRegister}>Create Account</button>
                    <p className="auth-footer">Already have an account? <span onClick={() => navigate('/login')}>Log in</span></p>
                </div>
            </div>
        </div>
    )
}

export default Register
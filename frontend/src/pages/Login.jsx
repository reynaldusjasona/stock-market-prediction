import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { api } from '../api/api'
import '../styles/Login.css'

function Login() {
    const [email,    setEmail]    = useState('')
    const [password, setPassword] = useState('')
    const [error,    setError]    = useState(null)
    const { login } = useAuth()
    const navigate  = useNavigate()

    async function handleLogin() {
        try {
            const data = await api.post('/auth/login', { email, password })
            login(data.user, data.token)

            const role         = data.user?.role
            const traderStatus = data.user?.trader_status

            if (role === 'trader') {
                navigate('/trader/dashboard')
            } else {
                navigate('/dashboard')
            }
        } catch (err) {
            setError(err.message)
        }
    }

    return (
        <div className="login-page">
            <div className="login-left">
                <h2>Predict the Market with <span>AI Precision</span></h2>
                <p>Access institutional-grade technical analysis and predictive modeling powered by our proprietary neural networks.</p>
            </div>
            <div className="login-right">
                <h1>Welcome back</h1>
                <p className="subtitle">Please enter your credentials to access your dashboard.</p>
                {error && <p className="error-msg">{error}</p>}
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
                <button className="btn-full" onClick={handleLogin}>Log in →</button>
                <p className="login-footer">
                    Don't have an account? <span onClick={() => navigate('/register')}>Register</span>
                </p>
            </div>
        </div>
    )
}

export default Login

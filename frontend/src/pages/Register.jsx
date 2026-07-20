import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/api'
import '../styles/Register.css'

function Register() {
    const [name, setName] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState(null)
    const [registered, setRegistered] = useState(false)
    const navigate = useNavigate()

    async function handleRegister() {
        try {
            await api.post('/auth/register', {
                name,
                email,
                password
            })
            setRegistered(true)
        } catch (err) {
            setError(err.message)
        }
    }

    if (registered) {
        return (
            <div className="register-page">
                <div className="register-left">
                    <h2>Predict the Market with <span>AI Precision</span></h2>
                    <p>Institutional-grade intelligence for the everyday investor. Harness the power of neural networks to navigate volatile markets.</p>
                </div>
                <div className="register-right">
                    <h1>Check your email</h1>
                    <p className="subtitle">
                        We sent a verification link to <strong>{email}</strong>. Click the link to activate your
                        account, then log in.
                    </p>
                    <button className="btn-full" onClick={() => navigate('/login')}>Go to login</button>
                </div>
            </div>
        )
    }

    return (
        <div className="register-page">
            <div className="register-left">
                <h2>Predict the Market with <span>AI Precision</span></h2>
                <p>Institutional-grade intelligence for the everyday investor. Harness the power of neural networks to navigate volatile markets.</p>
            </div>
            <div className="register-right">
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
                <button className="btn-full" onClick={handleRegister}>Create Account</button>
                <p className="register-footer">Already have an account? <span onClick={() => navigate('/login')}>Log in</span></p>
            </div>
        </div>
    )
}

export default Register
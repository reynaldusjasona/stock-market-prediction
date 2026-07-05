import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/api'
import '../styles/Register.css'

function Register() {
    const [name, setName] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState(null)
    const navigate = useNavigate()

    async function handleRegister() {
        try {
            await api.post('/auth/register', {
                name,
                email,
                password
            })
            navigate('/login')
        } catch (err) {
            setError(err.message)
        }
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
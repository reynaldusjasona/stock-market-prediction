import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/api'
import '../styles/Register.css'

function Register() {
    const [name,          setName]          = useState('')
    const [email,         setEmail]         = useState('')
    const [password,      setPassword]      = useState('')
    const [role,          setRole]          = useState('investor')
    const [licenseNumber, setLicenseNumber] = useState('')
    const [error,         setError]         = useState(null)
    const navigate = useNavigate()

    async function handleRegister() {
        if (role === 'trader' && !licenseNumber.trim()) {
            setError('License number is required for trader accounts.')
            return
        }
        try {
            const payload = { name, email, password, role }
            if (role === 'trader') payload.license_number = licenseNumber.trim()
            await api.post('/auth/register', payload)
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
                    <input type="text" placeholder="John Doe"
                        value={name} onChange={e => setName(e.target.value)}/>
                </div>
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

                <div className="form-group">
                    <label>Account Type</label>
                    <select value={role} onChange={e => setRole(e.target.value)}
                        style={{ width:'100%', padding:'0.6rem 0.85rem', borderRadius:'8px',
                            background:'#12171a', border:'1px solid rgba(255,255,255,0.1)',
                            color:'#e8eaed', fontSize:'0.875rem', fontFamily:'inherit' }}>
                        <option value="investor">Investor</option>
                        <option value="trader">Trader (Licensed Professional)</option>
                    </select>
                </div>

                {role === 'trader' && (
                    <div className="form-group">
                        <label>License Number</label>
                        <input type="text" placeholder="e.g. CFA-12345"
                            value={licenseNumber}
                            onChange={e => setLicenseNumber(e.target.value)}/>
                        <p style={{ fontSize:'0.75rem', color:'#9aa0a6', marginTop:'0.35rem' }}>
                            Your account will be pending until an administrator verifies your license.
                        </p>
                    </div>
                )}

                <button className="btn-full" onClick={handleRegister}>Create Account</button>
                <p className="register-footer">
                    Already have an account? <span onClick={() => navigate('/login')}>Log in</span>
                </p>
            </div>
        </div>
    )
}

export default Register

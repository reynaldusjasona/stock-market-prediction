import { useState } from 'react'
import { api } from '../api/api'
import '../styles/ForgotPasswordModal.css'

function friendlyError(err) {
    if (err.status === 429) {
        return 'Too many attempts, try again in a few minutes.'
    }
    return err.message
}

function ForgotPasswordModal({ onClose }) {
    const [step, setStep] = useState('email') // 'email' | 'otp' | 'reset' | 'done'
    const [email, setEmail] = useState('')
    const [code, setCode] = useState('')
    const [resetToken, setResetToken] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [info, setInfo] = useState(null)
    const [error, setError] = useState(null)
    const [loading, setLoading] = useState(false)

    async function handleRequestOtp(e) {
        e.preventDefault()
        setError(null)
        if (!email.trim()) {
            setError('Enter your email address.')
            return
        }
        setLoading(true)
        try {
            const data = await api.post('/auth/forgot-password', { email: email.trim() })
            setInfo(data.message)
            setStep('otp')
        } catch (err) {
            setError(friendlyError(err))
        } finally {
            setLoading(false)
        }
    }

    async function handleVerifyOtp(e) {
        e.preventDefault()
        setError(null)
        if (!code.trim()) {
            setError('Enter the code we emailed you.')
            return
        }
        setLoading(true)
        try {
            const data = await api.post('/auth/verify-reset-otp', {
                email: email.trim(),
                code: code.trim(),
            })
            setResetToken(data.reset_token)
            setInfo(null)
            setStep('reset')
        } catch (err) {
            setError(friendlyError(err))
        } finally {
            setLoading(false)
        }
    }

    async function handleResetPassword(e) {
        e.preventDefault()
        setError(null)
        if (newPassword.length < 8) {
            setError('New password must be at least 8 characters.')
            return
        }
        if (newPassword !== confirmPassword) {
            setError('Passwords do not match.')
            return
        }
        setLoading(true)
        try {
            await api.post('/auth/reset-password-with-token', {
                reset_token: resetToken,
                new_password: newPassword,
            })
            setStep('done')
        } catch (err) {
            setError(friendlyError(err))
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className="modal-panel">
                {step === 'email' && (
                    <>
                        <h2>Reset your password</h2>
                        <p className="modal-subtitle">
                            Enter your email address and we'll send you a 6-digit reset code.
                        </p>
                        {error && <p className="error-msg">{error}</p>}
                        <form onSubmit={handleRequestOtp}>
                            <div className="form-group">
                                <label>Email Address</label>
                                <input type="email" placeholder="name@company.com" value={email}
                                    onChange={(e) => setEmail(e.target.value)} autoFocus/>
                            </div>
                            <button type="submit" className="btn-full" disabled={loading}>
                                {loading ? 'Sending...' : 'Send reset code'}
                            </button>
                        </form>
                        <p className="modal-back" onClick={onClose}>Back to login</p>
                    </>
                )}

                {step === 'otp' && (
                    <>
                        <h2>Enter your code</h2>
                        <p className="modal-subtitle">
                            We sent a 6-digit code to {email}. It expires in 5 minutes.
                        </p>
                        {info && <p className="success-msg">{info}</p>}
                        {error && <p className="error-msg">{error}</p>}
                        <form onSubmit={handleVerifyOtp}>
                            <div className="form-group">
                                <label>Reset Code</label>
                                <input type="text" inputMode="numeric" maxLength={6} placeholder="123456"
                                    value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} autoFocus/>
                            </div>
                            <button type="submit" className="btn-full" disabled={loading}>
                                {loading ? 'Verifying...' : 'Verify code'}
                            </button>
                        </form>
                        <p className="modal-back" onClick={() => { setStep('email'); setError(null); setInfo(null) }}>
                            Use a different email
                        </p>
                    </>
                )}

                {step === 'reset' && (
                    <>
                        <h2>Set a new password</h2>
                        <p className="modal-subtitle">Choose a new password for your account.</p>
                        {error && <p className="error-msg">{error}</p>}
                        <form onSubmit={handleResetPassword}>
                            <div className="form-group">
                                <label>New Password</label>
                                <input type="password" placeholder="••••••••" value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)} autoFocus/>
                            </div>
                            <div className="form-group">
                                <label>Confirm New Password</label>
                                <input type="password" placeholder="••••••••" value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}/>
                            </div>
                            <button type="submit" className="btn-full" disabled={loading}>
                                {loading ? 'Resetting...' : 'Reset password'}
                            </button>
                        </form>
                    </>
                )}

                {step === 'done' && (
                    <>
                        <h2>Password reset</h2>
                        <p className="modal-subtitle">
                            Your password has been changed. You can now log in with your new password.
                        </p>
                        <button type="button" className="btn-full" onClick={onClose}>Back to login</button>
                    </>
                )}
            </div>
        </div>
    )
}

export default ForgotPasswordModal

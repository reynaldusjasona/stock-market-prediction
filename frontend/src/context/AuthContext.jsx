import { createContext, useContext, useState, useEffect } from 'react'
import { api } from '../api/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
    const [user,  setUser]  = useState(() => {
        try { return JSON.parse(localStorage.getItem('user') || 'null') }
        catch { return null }
    })
    const [token, setToken] = useState(localStorage.getItem('token'))
    const [subscription, setSubscription] = useState(null)
    const [subscriptionLoaded, setSubscriptionLoaded] = useState(false)

    async function refreshSubscription() {
        try {
            const data = await api.get('/subscription')
            setSubscription(data)
        } catch {
            setSubscription(null)
        } finally {
            setSubscriptionLoaded(true)
        }
    }

    // re-fetch whenever the token changes (initial load with a stored
    // token, a fresh login, or a logout clearing it)
    useEffect(() => {
        if (token) {
            refreshSubscription()
        } else {
            setSubscription(null)
            setSubscriptionLoaded(true)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token])

    function login(userData, userToken) {
        setUser(userData)
        setToken(userToken)
        localStorage.setItem('token', userToken)
        localStorage.setItem('user',  JSON.stringify(userData))
    }

    function logout() {
        setUser(null)
        setToken(null)
        localStorage.removeItem('token')
        localStorage.removeItem('user')
    }

    const isSubscribed = subscription !== null

    return (
        <AuthContext.Provider value={{
            user, token, login, logout,
            subscription, isSubscribed, subscriptionLoaded, refreshSubscription,
        }}>
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth() {
    return useContext(AuthContext)
}

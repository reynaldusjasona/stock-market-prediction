import { createContext, useContext, useState } from 'react'

const AuthContext = createContext(null)

function loadStoredUser() {
    const stored = localStorage.getItem('user')
    if (!stored) return null
    try {
        return JSON.parse(stored)
    } catch {
        return null
    }
}

export function AuthProvider({children}) {
    const [user, setUser] = useState(loadStoredUser)
    const [token, setToken] = useState(localStorage.getItem('token'))

    function login(userData, userToken) {
        setUser(userData)
        setToken(userToken)
        localStorage.setItem('token', userToken)
        localStorage.setItem('user', JSON.stringify(userData))
    }
    function logout(){
        setUser(null)
        setToken(null)
        localStorage.removeItem('token')
        localStorage.removeItem('user')
    }

    return (<AuthContext.Provider value={{ user, token, login, logout}}>
        {children}
    </AuthContext.Provider>
    )
}
    export function useAuth() {
        return useContext(AuthContext)
    }
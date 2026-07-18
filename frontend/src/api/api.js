const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'
// grab token from localStorage if user is logged in
function getToken() {
    return localStorage.getItem('token')
}

async function request(path, options = {}) {
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
    }
// attach token to header so backend knows who are accessing
    const token = getToken()
    if (token) {headers['Authorization'] = `Bearer ${token}`}

    const response = await fetch(`${BASE_URL}${path}`,{
        ...options,
        headers,
    })
    const data = await response.json()
// if error
    if(!response.ok) {
        throw new Error(data.detail || 'Something went wrong')
    }
    return data
}
export const api = {
    get: (path) => request(path),
    post: (path, body) => request(path, {method: 'POST', body: JSON.stringify(body) }),
    put: (path, body) => request(path, {method: 'PUT', body: JSON.stringify(body) }),
    delete: (path) => request(path, {method:'DELETE'}),
    patch: (path, body) => request(path, {method:'PATCH', body: JSON.stringify(body)})
}
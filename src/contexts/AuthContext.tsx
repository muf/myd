import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID

const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/userinfo.email',
].join(' ')

interface User {
  name: string
  email: string
  picture: string
}

interface AuthContextType {
  user: User | null
  accessToken: string | null
  isAuthenticated: boolean
  isLoading: boolean
  login: () => void
  logout: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [tokenClient, setTokenClient] = useState<google.accounts.oauth2.TokenClient | null>(null)

  // Initialize Google Identity Services
  useEffect(() => {
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.onload = () => {
      console.log('GIS loaded')
      const client = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: async (response) => {
          console.log('Token response:', response)
          if (response.access_token) {
            setAccessToken(response.access_token)
            localStorage.setItem('access_token', response.access_token)
            
            // Fetch user info
            try {
              const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
                headers: { Authorization: `Bearer ${response.access_token}` }
              })
              if (userInfoRes.ok) {
                const userInfo = await userInfoRes.json()
                console.log('User info:', userInfo)
                const userData = {
                  name: userInfo.name || 'User',
                  email: userInfo.email || '',
                  picture: userInfo.picture || '',
                }
                setUser(userData)
                localStorage.setItem('user', JSON.stringify(userData))
              }
            } catch (e) {
              console.error('Failed to fetch user info:', e)
            }
          }
          setIsLoading(false)
        },
        error_callback: (error) => {
          console.error('Token error:', error)
          setIsLoading(false)
        }
      })
      setTokenClient(client)
      setIsLoading(false)
    }
    document.body.appendChild(script)

    return () => {
      document.body.removeChild(script)
    }
  }, [])

  // Check for saved session
  useEffect(() => {
    const savedToken = localStorage.getItem('access_token')
    const savedUser = localStorage.getItem('user')
    
    if (savedToken && savedUser) {
      // Verify token is still valid
      fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${savedToken}` }
      })
        .then(res => {
          if (res.ok) {
            setAccessToken(savedToken)
            setUser(JSON.parse(savedUser))
          } else {
            // Token expired, clear storage
            localStorage.removeItem('access_token')
            localStorage.removeItem('user')
          }
        })
        .catch(() => {
          localStorage.removeItem('access_token')
          localStorage.removeItem('user')
        })
    }
  }, [])

  const login = useCallback(() => {
    if (tokenClient) {
      console.log('Requesting token...')
      tokenClient.requestAccessToken({ prompt: 'consent' })
    }
  }, [tokenClient])

  const logout = useCallback(() => {
    if (accessToken) {
      google.accounts.oauth2.revoke(accessToken, () => {
        console.log('Token revoked')
      })
    }
    setUser(null)
    setAccessToken(null)
    localStorage.removeItem('access_token')
    localStorage.removeItem('user')
  }, [accessToken])

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        isAuthenticated: !!user && !!accessToken,
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

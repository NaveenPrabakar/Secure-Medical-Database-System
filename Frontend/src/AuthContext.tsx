import React, { createContext, useContext, useEffect, useState } from 'react'

type LoginApiResponse = {
  access_token?: string
  error?: string
}

type AuthContextType = {
  token: string | null
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  isLoading: boolean
  error: string | null
  clearError: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const apiBase = 'https://58rcz6xwc9.execute-api.us-east-2.amazonaws.com/Prod'

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const savedToken = localStorage.getItem('access_token')
    if (savedToken) {
      setToken(savedToken)
    }
  }, [])

  const clearError = () => {
    setError(null)
  }

  const login = async (email: string, password: string) => {
    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch(`${apiBase}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })

      const data = (await res.json()) as LoginApiResponse

      if (!res.ok || !data.access_token) {
        throw new Error(data.error || 'Login failed')
      }

      setToken(data.access_token)
      localStorage.setItem('access_token', data.access_token)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unexpected login error occurred'
      setError(message)
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  const logout = () => {
    setToken(null)
    setError(null)
    localStorage.removeItem('access_token')
  }

  return (
    <AuthContext.Provider value={{ token, login, logout, isLoading, error, clearError }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

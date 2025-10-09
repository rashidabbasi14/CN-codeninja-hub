'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useRouter } from 'next/navigation'

interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  role: 'ADMIN' | 'USER' | 'MODERATOR'
  department: {
    id: string
    name: string
  } | null
  avatarUrl: string | null
  createdAt: string
}

interface UserContextType {
  user: User | null
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string; user?: User; userId?: string; needsEmailVerification?: boolean; email?: string }>
  logout: () => void
  updateUser: (updatedUser: Partial<User>) => void
  loading: boolean
  apiCall: (url: string, options?: RequestInit) => Promise<Response>
  token: string | null
}

const UserContext = createContext<UserContextType | undefined>(undefined)

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Check for existing session on mount
  useEffect(() => {
    const storedToken = localStorage.getItem('codeninja-token')
    if (storedToken) {
      setToken(storedToken)
      // Fetch user data using the token
      fetchUserData(storedToken)
    } else {
      setLoading(false)
    }
  }, [])

  const fetchUserData = async (authToken: string) => {
    try {
      const response = await fetch('/api/profile', {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        setUser(data)
      } else {
        // Token is invalid, clear it
        localStorage.removeItem('codeninja-token')
        setToken(null)
      }
    } catch (error) {
      console.error('Error fetching user data:', error)
      localStorage.removeItem('codeninja-token')
      setToken(null)
    } finally {
      setLoading(false)
    }
  }

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string; user?: User; userId?: string; needsEmailVerification?: boolean; email?: string }> => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setUser(data.user)
        setToken(data.token)
        localStorage.setItem('codeninja-token', data.token)
        return { success: true, user: data.user }
      } else {
        // Check if this is a user without password who needs to set one up
        if (data.needsPasswordSetup) {
          return { success: false, error: data.error || 'Password setup required', userId: data.userId }
        }
        // Check if user needs email verification
        if (data.needsEmailVerification) {
          return { success: false, error: data.error || 'Email verification required', needsEmailVerification: true, email: data.email }
        }
        return { success: false, error: data.error || 'Login failed' }
      }
    } catch (error) {
      console.error('Login error:', error)
      return { success: false, error: 'Network error. Please try again.' }
    }
  }

  const logout = () => {
    setUser(null)
    setToken(null)
    localStorage.removeItem('codeninja-token')
    // Redirect to login page after logout
    window.location.href = '/'
  }

  const updateUser = (updatedUser: Partial<User>) => {
    if (user) {
      const newUser = { ...user, ...updatedUser }
      setUser(newUser)
      // User data is fetched from server, no need to store in localStorage
    }
  }

  const apiCall = async (url: string, options: RequestInit = {}): Promise<Response> => {
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string> || {}),
    }

    // Only add Content-Type for non-FormData requests
    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json'
    }

    // Add JWT token to authorization header if available
    if (token) {
      headers['authorization'] = `Bearer ${token}`
    }

    return fetch(url, {
      ...options,
      headers,
    })
  }

  return (
    <UserContext.Provider value={{ user, login, logout, updateUser, loading, apiCall, token }}>
      {children}
    </UserContext.Provider>
  )
}

export function useUser() {
  const context = useContext(UserContext)
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider')
  }
  return context
}
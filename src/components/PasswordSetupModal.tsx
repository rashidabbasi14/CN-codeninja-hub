'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Lock, Eye, EyeOff } from 'lucide-react'
import { useUser } from '@/contexts/UserContext'

interface PasswordSetupModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (userData: any) => void
  userId: string
  userEmail: string
}

export default function PasswordSetupModal({ 
  isOpen, 
  onClose, 
  onSuccess, 
  userId, 
  userEmail 
}: PasswordSetupModalProps) {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const { login } = useUser()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    if (password !== confirmPassword) {
      setError("Passwords don't match")
      setIsLoading(false)
      return
    }

    try {
      const response = await fetch('/api/auth/setup-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          password,
          confirmPassword,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Password setup failed')
      }

      // Auto-login the user after password setup using the UserContext
      if (data.success && data.user) {
        try {
          // Use the login function from UserContext to properly set the user state
          const loginResult = await login(userEmail, password)
          if (loginResult.success && loginResult.user) {
            onSuccess(loginResult.user)
            onClose()
          } else {
            // Fallback: if login fails, still call onSuccess with the user data
            onSuccess(data.user)
            onClose()
          }
        } catch (loginError) {
          // Fallback: if login fails, still call onSuccess with the user data
          console.warn('Auto-login after password setup failed:', loginError)
          onSuccess(data.user)
          onClose()
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Password setup failed. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-md bg-slate-800/95 border-slate-700 backdrop-blur-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-green-500 flex items-center justify-center">
            <Lock className="h-8 w-8 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold text-white">
            Set Up Your Password
          </CardTitle>
          <CardDescription className="text-slate-300">
            Welcome back! Please create a password for your account: {userEmail}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 rounded-md bg-red-500/10 border border-red-500/20">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">
                New Password
              </label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your new password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400 focus:border-blue-500 pr-10"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-slate-400">
                Must be at least 6 characters long
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">
                Confirm Password
              </label>
              <div className="relative">
                <Input
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Confirm your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400 focus:border-blue-500 pr-10"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {confirmPassword && password !== confirmPassword && (
                <p className="text-xs text-red-400">Passwords don't match</p>
              )}
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-700"
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700 text-white font-medium"
                disabled={isLoading || !password || !confirmPassword || password !== confirmPassword}
              >
                {isLoading ? 'Setting up...' : 'Set Password'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
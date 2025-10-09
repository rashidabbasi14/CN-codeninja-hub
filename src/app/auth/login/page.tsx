'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useUser } from '@/contexts/UserContext'
import NextImage from 'next/image'
import PasswordSetupModal from '@/components/PasswordSetupModal'
import { Mail, Lock, AtSign, Eye, EyeOff } from 'lucide-react'

function LoginFormWithSearchParams() {
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirect') || searchParams.get('returnTo')
  
  return <LoginForm redirectTo={redirectTo} />
}

function LoginForm({ redirectTo }: { redirectTo: string | null }) {
  const [email, setEmail] = useState('@codeninjaconsulting.com')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPasswordSetup, setShowPasswordSetup] = useState(false)
  const [passwordSetupUserId, setPasswordSetupUserId] = useState('')
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('')
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false)
  const [forgotPasswordMessage, setForgotPasswordMessage] = useState('')
  const [allowedDomain, setAllowedDomain] = useState("codeninjaconsulting.com")
  const [needsPasswordSetup, setNeedsPasswordSetup] = useState(false)
  const [checkingUser, setCheckingUser] = useState(false)
  const [userInfo, setUserInfo] = useState<any>(null)
  const [needsPasswordReset, setNeedsPasswordReset] = useState(false)
  const router = useRouter()
  const { login } = useUser()

  // Fetch domain configuration from API
  useEffect(() => {
    const fetchDomain = async () => {
      try {
        const configResponse = await fetch('/api/config/domain');
        if (configResponse.ok) {
          const configData = await configResponse.json();
          if (configData.success && configData.domain) {
            setAllowedDomain(configData.domain);
            setEmail(`@${configData.domain}`);
          }
        }
      } catch (error) {
        console.error('Error fetching domain config:', error);
        // Keep default domain
      }
    };

    fetchDomain();
  }, []);

  const checkUserStatus = async (email: string) => {
    if (!email) return;
    
    setCheckingUser(true);
    try {
      const response = await fetch('/api/auth/check-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();
      
      // Debug logging
      console.log('🔍 Frontend check user response:', {
        responseOk: response.ok,
        data: data,
        exists: data.exists,
        needsPasswordSetup: data.needsPasswordSetup
      });

      if (response.ok) {
        if (data.exists && data.needsPasswordSetup) {
          // User exists but has no password - show visual feedback and redirect to forgot password flow
          console.log('✅ User needs password setup, showing reset flow for:', email);
          setNeedsPasswordReset(true);
          setForgotPasswordEmail(email);
          setShowForgotPassword(true);
          setError('This account needs a password. Please use the forgot password option below to set your password.');
        } else {
          console.log('ℹ️ User does not need password setup');
          setNeedsPasswordSetup(false);
          setNeedsPasswordReset(false);
          setUserInfo(null);
        }
      } else if (data.error) {
        setError(data.error);
      }
    } catch (error) {
      console.error('Error checking user:', error);
    } finally {
      setCheckingUser(false);
    }
  };

  const handleEmailBlur = () => {
    if (email && email.includes('@')) {
      checkUserStatus(email);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    if (!email.trim() || email === `@${allowedDomain}`) {
      setError('Email is required');
      setIsLoading(false);
      return;
    }

    try {
      // If user needs password setup, skip login and show password setup modal
      if (needsPasswordSetup && userInfo) {
        setPasswordSetupUserId(userInfo.id);
        setShowPasswordSetup(true);
        setIsLoading(false);
        return;
      }

      const result = await login(email, password)
      
      if (result.success && result.user) {
        // Check if there's a redirect URL, otherwise use default based on role
        if (redirectTo) {
          // Validate that the redirect URL is safe (starts with /)
          if (redirectTo.startsWith('/')) {
            router.push(redirectTo)
          } else {
            // If redirect URL is not safe, fall back to default
            if (result.user.role === 'ADMIN') {
              router.push('/admin')
            } else {
              router.push('/events')
            }
          }
        } else {
          // Default redirect based on role
          if (result.user.role === 'ADMIN') {
            router.push('/admin')
          } else {
            router.push('/events')
          }
        }
      } else {
        // Check if user needs to set up password
        if (result.userId) {
          setPasswordSetupUserId(result.userId)
          setShowPasswordSetup(true)
        } else if (result.needsEmailVerification) {
          setError(result.error || 'Please verify your email address before logging in.')
        } else {
          setError(result.error || 'Login failed')
        }
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  const handlePasswordSetupSuccess = (userData: any) => {
    // The PasswordSetupModal handles localStorage, now we redirect based on role
    // Check if there's a redirect URL, otherwise use default based on role
    if (redirectTo) {
      // Validate that the redirect URL is safe (starts with /)
      if (redirectTo.startsWith('/')) {
        router.push(redirectTo)
      } else {
        // If redirect URL is not safe, fall back to default
        if (userData.role === 'ADMIN') {
          router.push('/admin')
        } else {
          router.push('/events')
        }
      }
    } else {
      // Default redirect based on role
      if (userData.role === 'ADMIN') {
        router.push('/admin')
      } else {
        router.push('/events')
      }
    }
  }

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setForgotPasswordLoading(true)
    setError('')
    setForgotPasswordMessage('')

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: forgotPasswordEmail }),
      })

      const data = await response.json()

      if (response.ok) {
        setForgotPasswordMessage(data.message)
        // In development, show the reset URL
        if (data.resetUrl) {
          console.log('Reset URL:', data.resetUrl)
        }
      } else {
        setError(data.error || 'Failed to send reset email')
      }
    } catch (err) {
      setError('Network error. Please try again.')
    } finally {
      setForgotPasswordLoading(false)
    }
  }

  if (showForgotPassword) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-slate-800/50 border-slate-700 backdrop-blur-sm shadow-2xl">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-16 h-16 rounded-lg overflow-hidden shadow-lg">
              <NextImage
                src="/logo.jpg"
                alt="CodeNinja Hub Logo"
                width={64}
                height={64}
                className="w-full h-full object-cover"
              />
            </div>
            <CardTitle className="text-2xl font-bold text-white">
              Forgot Password
            </CardTitle>
            <CardDescription className="text-slate-300">
              Enter your email to receive a password reset link
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div>
                <Input
                  type="email"
                  placeholder="Enter your email"
                  value={forgotPasswordEmail}
                  onChange={(e) => setForgotPasswordEmail(e.target.value)}
                  required
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck="false"
                  className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 transition-all duration-300"
                  disabled={forgotPasswordLoading}
                />
                <p className="text-xs text-slate-400 mt-1">
                  Must be a @{allowedDomain} email
                </p>
              </div>

              {error && (
                <div className="p-3 rounded-md bg-red-500/10 border border-red-500/20">
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

              {forgotPasswordMessage && (
                <div className="p-3 rounded-md bg-green-500/10 border border-green-500/20">
                  <p className="text-green-400 text-sm">{forgotPasswordMessage}</p>
                </div>
              )}

              <Button
                type="submit"
                className="w-full codeninja-gradient hover:shadow-lg transition-all duration-300"
                disabled={forgotPasswordLoading}
              >
                {forgotPasswordLoading ? 'Sending...' : 'Send Reset Link'}
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={() => setShowForgotPassword(false)}
                className="w-full border-slate-600 text-slate-300 hover:bg-slate-700 transition-all duration-300"
                disabled={forgotPasswordLoading}
              >
                Back to Login
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <>
      <PasswordSetupModal
        isOpen={showPasswordSetup}
        onClose={() => setShowPasswordSetup(false)}
        onSuccess={handlePasswordSetupSuccess}
        userId={passwordSetupUserId}
        userEmail={email}
      />
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Header */}
          <div className="text-center mb-8">
            <Link href="/" className="inline-flex items-center space-x-3 mb-6 group">
              <div className="h-16 w-16 rounded-lg overflow-hidden shadow-lg group-hover:shadow-xl transition-all duration-300">
                <NextImage
                  src="/logo.jpg"
                  alt="CodeNinja Hub Logo"
                  width={64}
                  height={64}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="text-left">
                <h1 className="text-2xl font-bold text-white group-hover:text-blue-300 transition-colors duration-300">CodeNinja Hub</h1>
                <p className="text-sm text-slate-400">Sports & Events Platform</p>
              </div>
            </Link>
          </div>

          <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm shadow-2xl">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl font-bold text-white">
                Welcome Back
              </CardTitle>
              <CardDescription className="text-slate-300">
                Sign in to CodeNinja Hub
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Email with Domain Display */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300 flex items-center">
                    <Mail className="h-4 w-4 mr-2" />
                    Email Address
                  </label>
                  <Input
                    type="email"
                    placeholder="username@codeninjaconsulting.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setError('');
                      setNeedsPasswordSetup(false);
                      setNeedsPasswordReset(false);
                      setUserInfo(null);
                    }}
                    onBlur={handleEmailBlur}
                    required
                    autoComplete="email"
                    className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 transition-all duration-300"
                    disabled={isLoading || checkingUser}
                  />
                  {needsPasswordReset && (
                    <div className="p-3 rounded-md bg-orange-500/10 border border-orange-500/20">
                      <p className="text-orange-300 text-sm font-medium flex items-center">
                        <Lock className="h-4 w-4 mr-2" />
                        Account found! This account needs a password setup.
                      </p>
                      <p className="text-orange-200 text-xs mt-1">
                        Please use the "Forgot Password" option below to set your password.
                      </p>
                    </div>
                  )}
                </div>

                {/* Password Setup Notice or Password Field */}
                {needsPasswordSetup && userInfo ? (
                  <div className="space-y-2">
                    <div className="p-4 rounded-lg bg-blue-500/20 border border-blue-500/50">
                      <div className="flex items-center space-x-2 mb-2">
                        <Lock className="h-4 w-4 text-blue-400" />
                        <span className="text-sm font-medium text-blue-300">Password Setup Required</span>
                      </div>
                      <p className="text-sm text-blue-200">
                        Welcome {userInfo.firstName}! You need to set up your password to continue.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300 flex items-center">
                      <Lock className="h-4 w-4 mr-2" />
                      Password
                    </label>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        placeholder="Enter your password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required={!needsPasswordSetup}
                        className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 transition-all duration-300 pr-10"
                        disabled={isLoading}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-white transition-colors"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                )}

                {error && (
                  <div className="p-4 rounded-lg bg-red-500/20 border border-red-500/50 text-red-300 text-sm shadow-lg">
                    {error}
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full codeninja-gradient hover:shadow-lg transition-all duration-300"
                  disabled={isLoading || checkingUser}
                >
                  {isLoading ? 'Signing in...' :
                   checkingUser ? 'Checking...' :
                   needsPasswordSetup ? 'Set Up Password' : 'Sign In'}
                </Button>
              </form>

              <div className="mt-6 text-center space-y-4">
                <p className="text-slate-400 text-sm">
                  Don't have an account?{' '}
                  <Link
                    href="/auth/register"
                    className="text-blue-400 hover:text-blue-300 font-medium transition-colors duration-300"
                  >
                    Register here
                  </Link>
                </p>
                
                <button
                  type="button"
                  onClick={() => setShowForgotPassword(true)}
                  className="text-blue-400 hover:text-blue-300 font-medium text-sm transition-colors duration-300"
                >
                  Forgot your password?
                </button>
              </div>

              <div className="mt-4 text-center">
                <p className="text-xs text-slate-500">
                  Enter your username and password to sign in
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
      </div>
    }>
      <LoginFormWithSearchParams />
    </Suspense>
  )
}
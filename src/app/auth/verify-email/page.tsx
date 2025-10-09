'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import NextImage from 'next/image'
import { CheckCircle, XCircle, Mail, Loader2 } from 'lucide-react'

function VerifyEmailFormWithSearchParams() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  
  return <VerifyEmailForm token={token} />
}

function VerifyEmailForm({ token }: { token: string | null }) {
  const [isLoading, setIsLoading] = useState(false)
  const [isVerified, setIsVerified] = useState(false)
  const [error, setError] = useState('')
  const [userInfo, setUserInfo] = useState<any>(null)
  const router = useRouter()

  useEffect(() => {
    if (token) {
      verifyEmail(token)
    } else {
      setError('Invalid verification link. Please check your email for the correct link.')
    }
  }, [token])

  const verifyEmail = async (verificationToken: string) => {
    setIsLoading(true)
    setError('')

    try {
      const response = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token: verificationToken }),
      })

      const data = await response.json()

      if (response.ok) {
        setIsVerified(true)
        setUserInfo(data.user)
      } else {
        setError(data.error || 'Email verification failed')
      }
    } catch (err) {
      setError('Network error. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleLoginRedirect = () => {
    router.push('/auth/login')
  }

  if (isLoading) {
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
              Verifying Email...
            </CardTitle>
            <CardDescription className="text-slate-300">
              Please wait while we verify your email address
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-400" />
            <p className="text-slate-400 mt-4">This may take a few seconds</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (isVerified && userInfo) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-slate-800/50 border-slate-700 backdrop-blur-sm shadow-2xl">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-gradient-to-br from-green-500 to-blue-500 flex items-center justify-center">
              <CheckCircle className="h-8 w-8 text-white" />
            </div>
            <CardTitle className="text-2xl font-bold text-white">
              Email Verified!
            </CardTitle>
            <CardDescription className="text-slate-300">
              Welcome to CodeNinja Hub, {userInfo.firstName}!
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 rounded-lg bg-green-500/20 border border-green-500/50">
              <p className="text-green-300 text-sm text-center">
                Your email address has been successfully verified. You can now log in and start using CodeNinja Hub.
              </p>
            </div>

            <div className="space-y-3">
              <Button
                onClick={handleLoginRedirect}
                className="w-full bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700 text-white font-medium"
              >
                Continue to Login
              </Button>
              
              <div className="text-center">
                <p className="text-slate-400 text-sm">
                  Ready to explore?{' '}
                  <Link
                    href="/events"
                    className="text-blue-400 hover:text-blue-300 font-medium transition-colors duration-300"
                  >
                    Browse Events
                  </Link>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Error state
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-slate-800/50 border-slate-700 backdrop-blur-sm shadow-2xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center">
            <XCircle className="h-8 w-8 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold text-white">
            Verification Failed
          </CardTitle>
          <CardDescription className="text-slate-300">
            We couldn't verify your email address
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="p-4 rounded-lg bg-red-500/20 border border-red-500/50">
              <p className="text-red-300 text-sm text-center">{error}</p>
            </div>
          )}

          <div className="space-y-3">
            <Button
              variant="outline"
              onClick={() => router.push('/auth/register')}
              className="w-full border-slate-600 text-slate-300 hover:bg-slate-700"
            >
              <Mail className="h-4 w-4 mr-2" />
              Request New Verification Email
            </Button>
            
            <Button
              onClick={() => router.push('/auth/login')}
              className="w-full bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700 text-white font-medium"
            >
              Back to Login
            </Button>
          </div>

          <div className="text-center">
            <p className="text-slate-400 text-xs">
              If you continue to have issues, please contact support
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
      </div>
    }>
      <VerifyEmailFormWithSearchParams />
    </Suspense>
  )
}
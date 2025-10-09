'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@/contexts/UserContext'

export default function HomePage() {
  const router = useRouter()
  const { user, loading } = useUser()

  useEffect(() => {
    if (!loading) {
      if (user) {
        // User is logged in - redirect to events page
        router.push('/events')
      } else {
        // User is not logged in - redirect to login page
        router.push('/auth/login')
      }
    }
  }, [user, loading, router])

  // Show loading while determining redirect
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
      <div className="text-white text-lg">Loading...</div>
    </div>
  )
}

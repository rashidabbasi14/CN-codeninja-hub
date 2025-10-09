import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const verifyEmailSchema = z.object({
  token: z.string().min(1, 'Verification token is required')
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token } = verifyEmailSchema.parse(body)

    // Find user with valid verification token
    const user = await prisma.user.findFirst({
      where: {
        emailVerificationToken: token,
        emailVerificationExpires: {
          gt: new Date()
        },
        isEmailVerified: false
      },
      include: {
        department: true
      }
    }) as any

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid or expired verification token' },
        { status: 400 }
      )
    }

    if (user.isBlocked) {
      return NextResponse.json(
        { error: 'Your account has been blocked. Please contact an administrator.' },
        { status: 403 }
      )
    }

    // Update user to mark email as verified and clear verification token
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        isEmailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpires: null,
        updatedAt: new Date()
      } as any,
      include: {
        department: true
      }
    }) as any

    // Log the email verification
    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: 'EMAIL_VERIFIED',
        entity: 'User',
        entityId: user.id,
        payload: JSON.stringify({
          email: user.email,
          timestamp: new Date().toISOString()
        })
      }
    })

    // Return user data (excluding sensitive info)
    const userData = {
      id: updatedUser.id,
      email: updatedUser.email,
      firstName: updatedUser.firstName,
      lastName: updatedUser.lastName,
      role: updatedUser.role,
      department: updatedUser.department ? {
        id: updatedUser.department.id,
        name: updatedUser.department.name
      } : null,
      avatarUrl: updatedUser.avatarUrl,
      isEmailVerified: true,
      createdAt: updatedUser.createdAt
    }

    return NextResponse.json({
      success: true,
      message: 'Email verified successfully! You can now log in.',
      user: userData
    })

  } catch (error) {
    console.error('Email verification error:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET method for URL-based verification (when user clicks link in email)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.json(
        { error: 'Verification token is required' },
        { status: 400 }
      )
    }

    // Use the same logic as POST
    const postRequest = new NextRequest(request.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    })

    return await POST(postRequest)

  } catch (error) {
    console.error('Email verification error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
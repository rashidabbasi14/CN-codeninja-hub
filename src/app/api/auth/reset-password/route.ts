import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { passwordSetupSchema } from '@/lib/validation'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate input
    const validatedData = passwordSetupSchema.parse(body)
    const { password, token } = { ...validatedData, token: body.token }

    if (!token) {
      return NextResponse.json(
        { error: 'Reset token is required' },
        { status: 400 }
      )
    }

    // Find user with valid reset token using Prisma
    const user = await prisma.user.findFirst({
      where: {
        passwordResetToken: token,
        passwordResetExpires: {
          gt: new Date()
        }
      }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid or expired reset token' },
        { status: 400 }
      )
    }

    if (user.isBlocked) {
      return NextResponse.json(
        { error: 'Your account has been blocked. Please contact an administrator.' },
        { status: 403 }
      )
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(password, 12)

    // Update user password, clear reset token, and activate email verification using Prisma
    const updatedUser = await prisma.user.update({
      where: {
        id: user.id
      },
      data: {
        password: hashedPassword,
        passwordResetToken: null,
        passwordResetExpires: null,
        isEmailVerified: true, // Activate account when password is set through forgot-password
        emailVerificationToken: null, // Clear any existing verification token
        emailVerificationExpires: null, // Clear verification expiry
        updatedAt: new Date()
      },
      include: {
        department: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    // Log the password reset
    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: 'PASSWORD_RESET_COMPLETED',
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
      createdAt: updatedUser.createdAt
    }

    return NextResponse.json({
      success: true,
      message: 'Password reset successful',
      user: userData
    })

  } catch (error) {
    console.error('Password reset error:', error)

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
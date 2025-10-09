import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { emailService } from '@/lib/email'
import { z } from 'zod'
import crypto from 'crypto'
import { generatePasswordResetEmail } from '@/app/email-templates/password-reset-email'

// Email schema without domain restriction for password reset
const emailSchema = z.string().email('Invalid email format')

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate email
    const email = emailSchema.parse(body.email)

    // Normalize email to lowercase for case-insensitive lookup
    const normalizedEmail = email.toLowerCase();

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail }
    }) as any

    if (!user) {
      // Don't reveal if user exists or not for security
      return NextResponse.json({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.'
      })
    }

    if (user.isBlocked) {
      return NextResponse.json(
        { error: 'Your account has been blocked. Please contact an administrator.' },
        { status: 403 }
      )
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex')
    const resetExpires = new Date(Date.now() + 3600000) // 1 hour from now

    // Save reset token to database using Prisma
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: resetToken,
        passwordResetExpires: resetExpires,
        updatedAt: new Date()
      }
    });

    // Send password reset email using HTML template system
    const resetUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/auth/reset-password?token=${resetToken}`
    
    const emailHtml = generatePasswordResetEmail({
      firstName: user.firstName,
      resetUrl: resetUrl
    })

    try {
      await emailService.sendEmail(
        user.email,
        'Reset Your Password - CodeNinja Hub',
        emailHtml,
        {},
        'system'
      )
      console.log('✅ Password reset email sent to:', user.email)
    } catch (emailError) {
      console.error('❌ Failed to send password reset email:', emailError)
      console.log('📧 Email service error details:', emailError instanceof Error ? emailError.message : 'Unknown error')
      // Continue with the response even if email fails - this allows development without email setup
    }
    
    // Always log the reset URL for development/testing
    console.log('🔗 Password reset link (for development):', resetUrl)
    
    // Log the password reset request
    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: 'PASSWORD_RESET_REQUESTED',
        entity: 'User',
        entityId: user.id,
        payload: JSON.stringify({
          email: user.email,
          timestamp: new Date().toISOString()
        })
      }
    })

    return NextResponse.json({
      success: true,
      message: 'If an account with that email exists, a password reset link has been sent.',
      // Include reset URL in development for testing
      ...(process.env.NODE_ENV === 'development' && {
        resetUrl,
        note: 'In development: Check console for reset link if email delivery fails'
      })
    })

  } catch (error) {
    console.error('Forgot password error:', error)

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
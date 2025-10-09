import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { loginSchema } from '@/lib/validation'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import crypto from 'crypto'
import { emailService } from '@/lib/email/email-service'
import { generateEmailVerificationEmail } from '@/app/email-templates/email-verification-email'
import { signToken } from '@/lib/jwt'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate input
    const validatedData = loginSchema.parse(body)
    const { email, password } = validatedData

    // Normalize email to lowercase for case-insensitive lookup
    const normalizedEmail = email.toLowerCase();

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: {
        department: true
      }
    }) as any // Type assertion to handle password field

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid email or password.' },
        { status: 401 }
      )
    }

    if (user.isBlocked) {
      return NextResponse.json(
        { error: 'Your account has been blocked. Please contact an administrator.' },
        { status: 403 }
      )
    }

    // Check if user has no password (existing user)
    if (!user.password) {
      return NextResponse.json(
        {
          success: false,
          error: 'Please set up your password to continue.',
          needsPasswordSetup: true,
          userId: user.id
        },
        { status: 200 }
      )
    }

    // Check if email is verified
    if (!user.isEmailVerified) {
      try {
        // Generate new verification token and expiry
        const emailVerificationToken = crypto.randomBytes(32).toString('hex');
        const emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

        // Update user with new verification token
        await prisma.user.update({
          where: { id: user.id },
          data: {
            emailVerificationToken,
            emailVerificationExpires
          }
        });

        // Send verification email
        const verificationUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/auth/verify-email?token=${emailVerificationToken}`;
        
        const verificationEmailHtml = generateEmailVerificationEmail({
          firstName: user.firstName,
          verificationUrl
        });

        await emailService.sendEmail(
          user.email,
          'Verify Your Email - CodeNinja Hub',
          verificationEmailHtml,
          {},
          'system'
        );

        console.log('✅ New verification email sent to:', user.email);
        console.log('🔗 Verification link (for development):', verificationUrl);
      } catch (emailError) {
        console.error('❌ Failed to send verification email:', emailError);
        // Continue with the response even if email fails
      }

      return NextResponse.json(
        {
          success: false,
          error: 'Please verify your email address before logging in. Check your inbox for the verification email.',
          needsEmailVerification: true,
          email: user.email
        },
        { status: 403 }
      )
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password)
    if (!isPasswordValid) {
      return NextResponse.json(
        { error: 'Invalid email or password.' },
        { status: 401 }
      )
    }

    // Log the login
    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: 'USER_LOGIN',
        entity: 'User',
        entityId: user.id,
        payload: JSON.stringify({
          email: user.email,
          timestamp: new Date().toISOString()
        })
      }
    })

    // Generate JWT token
    const token = signToken({
      userId: user.id,
      email: user.email,
      role: user.role
    })

    // Return minimal user data (excluding sensitive info) and token
    const userData = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      department: user.department ? {
        id: user.department.id,
        name: user.department.name
      } : null,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt
    }

    return NextResponse.json({
      success: true,
      message: 'Login successful',
      user: userData,
      token: token
    })

  } catch (error) {
    console.error('Login error:', error)

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
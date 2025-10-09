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
    const { password, userId } = { ...validatedData, userId: body.userId }

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        department: true
      }
    }) as any

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    if (user.isBlocked) {
      return NextResponse.json(
        { error: 'Your account has been blocked. Please contact an administrator.' },
        { status: 403 }
      )
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 12)

    // Update user with password
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword } as any,
      include: {
        department: true
      }
    }) as any

    // Log the password setup
    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: 'PASSWORD_SETUP',
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
      message: 'Password setup successful',
      user: userData
    })

  } catch (error) {
    console.error('Password setup error:', error)

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
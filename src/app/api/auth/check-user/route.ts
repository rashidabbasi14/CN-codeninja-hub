import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const checkUserSchema = z.object({
  email: z.string().email('Invalid email format'),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = checkUserSchema.parse(body);
    const { email } = validatedData;

    // Normalize email to lowercase for case-insensitive lookup
    const normalizedEmail = email.toLowerCase();

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        password: true,
        isBlocked: true,
        role: true
      }
    }) as any; // Type assertion to handle password field

    if (!user) {
      return NextResponse.json({
        exists: false,
        needsPasswordSetup: false
      });
    }

    if (user.isBlocked) {
      return NextResponse.json({
        exists: true,
        needsPasswordSetup: false,
        error: 'Account is blocked'
      }, { status: 403 });
    }

    // Check if user has no password (needs setup) - handle both null and empty string
    const needsPasswordSetup = !user.password || user.password.trim() === '';
    
    return NextResponse.json({
      exists: true,
      needsPasswordSetup,
      user: needsPasswordSetup ? {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role
      } : null
    });

  } catch (error) {
    console.error('Check user error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminOrModerator } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { auditLogger } from '@/lib/audit';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAdminOrModerator(request);
    const userId = params.id;

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Find the user to verify
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        isEmailVerified: true
      }
    });

    if (!targetUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    if (targetUser.isEmailVerified) {
      return NextResponse.json(
        { error: 'User email is already verified' },
        { status: 400 }
      );
    }

    // Update user to mark email as verified and clear verification tokens
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        isEmailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpires: null
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        isEmailVerified: true
      }
    });

    // Log the audit action
    await auditLogger.log(
      user.id,
      'user.email_verified',
      'user',
      userId,
      {
        targetUserEmail: targetUser.email,
        targetUserName: `${targetUser.firstName} ${targetUser.lastName}`,
        verifiedBy: `${user.firstName} ${user.lastName}`,
        verifiedByEmail: user.email
      }
    );

    return NextResponse.json({
      success: true,
      message: 'User email verified successfully',
      user: updatedUser
    });

  } catch (error) {
    console.error('Error verifying user email:', error);
    
    if (error instanceof Error && error.message === 'Admin or Moderator access required') {
      return NextResponse.json(
        { error: 'Admin or Moderator access required' },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
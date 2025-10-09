import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { requireAuth } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    const { currentPassword, newPassword } = await request.json();

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ 
        error: 'Current password and new password are required' 
      }, { status: 400 });
    }

    if (newPassword.length < 6) {
      return NextResponse.json({ 
        error: 'New password must be at least 6 characters long' 
      }, { status: 400 });
    }

    // Check if user has a password set
    if (!user.password) {
      return NextResponse.json({ 
        error: 'No password is currently set for this account' 
      }, { status: 400 });
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      return NextResponse.json({ 
        error: 'Current password is incorrect' 
      }, { status: 400 });
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 12);

    // Update password in database
    await prisma.user.update({
      where: { id: user.id },
      data: { 
        password: hashedNewPassword,
        updatedAt: new Date()
      }
    });

    return NextResponse.json({ 
      message: 'Password changed successfully' 
    });

  } catch (error) {
    console.error('Error changing password:', error);
    
    if (error instanceof Error && error.message === 'Authentication required') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    return NextResponse.json(
      { error: 'Failed to change password' },
      { status: 500 }
    );
  }
}
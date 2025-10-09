import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { requireAdmin } from '@/lib/auth';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const currentUser = await requireAdmin(request);
    const { role } = await request.json();
    const userId = params.id;

    // Validate role
    const validRoles = ['USER', 'MODERATOR', 'ADMIN'];
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role. Must be USER, MODERATOR, or ADMIN' },
        { status: 400 }
      );
    }

    // Check if user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true }
    });

    if (!targetUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Prevent users from changing their own role
    if (currentUser.id === userId) {
      return NextResponse.json(
        { error: 'Cannot change your own role' },
        { status: 400 }
      );
    }

    // Update user role
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { role },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true
      }
    });

    // Log the action
    await prisma.auditLog.create({
      data: {
        actorId: currentUser.id,
        action: 'UPDATE_USER_ROLE',
        entity: 'USER',
        entityId: userId,
        payload: JSON.stringify({
          previousRole: targetUser.role,
          newRole: role,
          targetUserEmail: targetUser.email
        })
      }
    });

    return NextResponse.json({
      message: `User role updated to ${role}`,
      user: updatedUser
    });

  } catch (error) {
    console.error('Update user role error:', error);
    return NextResponse.json(
      { error: 'Failed to update user role' },
      { status: 500 }
    );
  }
}
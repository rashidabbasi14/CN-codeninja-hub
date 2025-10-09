import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, requireAdminForDelete, requireAdminOrModerator } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { auditLogger } from '@/lib/audit';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const currentUser = await requireAdminForDelete(request);
    const userId = params.id;

    // Prevent self-deletion
    if (currentUser.id === userId) {
      return NextResponse.json(
        { error: 'Cannot delete your own account' },
        { status: 400 }
      );
    }

    // Check if user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true
      }
    });

    if (!targetUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Prevent deletion of other admin users (optional safety measure)
    if (targetUser.role === 'ADMIN') {
      return NextResponse.json(
        { error: 'Cannot delete admin users' },
        { status: 403 }
      );
    }

    // Use a transaction to handle foreign key constraints
    await prisma.$transaction(async (tx) => {
      // First, update audit logs to remove the foreign key reference
      // We'll set actorId to null for audit logs where the user being deleted was the actor
      await tx.auditLog.updateMany({
        where: { actorId: userId },
        data: { actorId: currentUser.id } // Transfer ownership to the admin performing the deletion
      });

      // Delete the user (this should now work without foreign key constraint issues)
      await tx.user.delete({
        where: { id: userId }
      });
    });

    // Log the action (after the transaction completes successfully)
    await auditLogger.log(currentUser.id, 'user.deleted', 'user', userId, {
      deletedUserEmail: targetUser.email,
      deletedUserName: `${targetUser.firstName} ${targetUser.lastName}`,
      deletedUserRole: targetUser.role
    });

    return NextResponse.json({
      message: 'User deleted successfully'
    });

  } catch (error) {
    console.error('Delete user error:', error);
    return NextResponse.json(
      { error: 'Failed to delete user' },
      { status: 500 }
    );
  }
}
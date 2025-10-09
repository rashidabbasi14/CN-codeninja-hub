import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminOrModerator } from '@/lib/auth';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    await requireAdminOrModerator(request);

    // Fetch all users (both blocked and unblocked for comprehensive user management)
    const allUsers = await prisma.user.findMany({
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        isBlocked: true,
        isEmailVerified: true,
        updatedAt: true,
        role: true
      },
      orderBy: [
        { isBlocked: 'desc' }, // Blocked users first
        { updatedAt: 'desc' }
      ]
    });

    // Transform the data to match the expected BlockedUser interface
    const users = await Promise.all(
      allUsers.map(async (user) => {
        // Try to find the audit log entry for when this user was blocked
        const blockAuditLog = await prisma.auditLog.findFirst({
          where: {
            action: 'BLOCK_USER',
            entityId: user.id
          },
          orderBy: {
            createdAt: 'desc'
          }
        });

        const payload = blockAuditLog ? JSON.parse(blockAuditLog.payload || '{}') : {};

        return {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phone: user.phone,
          isBlocked: user.isBlocked,
          isEmailVerified: user.isEmailVerified,
          blockedAt: blockAuditLog?.createdAt.toISOString() || user.updatedAt.toISOString(),
          blockedReason: payload.reason || (user.isBlocked ? 'No reason provided' : undefined),
          role: user.role
        };
      })
    );

    return NextResponse.json(users);
  } catch (error) {
    console.error('Failed to fetch blocked users:', error);
    
    if (error instanceof Error && error.message === 'Authentication required') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch blocked users' },
      { status: 500 }
    );
  }
}
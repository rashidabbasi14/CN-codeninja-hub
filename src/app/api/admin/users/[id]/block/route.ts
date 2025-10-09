import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAdmin(request);

    // Check content type
    const contentType = request.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      return NextResponse.json(
        { error: 'Content-Type must be application/json' },
        { status: 400 }
      );
    }

    let requestBody;
    try {
      // Clone the request to avoid consuming the body multiple times
      const clonedRequest = request.clone();
      const bodyText = await clonedRequest.text();
      
      if (!bodyText || bodyText.trim() === '') {
        return NextResponse.json(
          { error: 'Request body is empty' },
          { status: 400 }
        );
      }

      requestBody = JSON.parse(bodyText);
    } catch (error) {
      console.error('JSON parsing error:', error);
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    const { block, reason } = requestBody;

    if (typeof block !== 'boolean') {
      return NextResponse.json(
        { error: 'Block parameter must be a boolean' },
        { status: 400 }
      );
    }

    // Check if target user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: params.id },
      select: { id: true, firstName: true, lastName: true, email: true, isBlocked: true }
    });

    if (!targetUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Prevent admin from blocking themselves
    if (targetUser.id === user.id) {
      return NextResponse.json(
        { error: 'Cannot block yourself' },
        { status: 400 }
      );
    }

    // Update user's blocked status
    await prisma.user.update({
      where: { id: params.id },
      data: { isBlocked: block }
    });

    // Create audit log entry
    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: block ? 'BLOCK_USER' : 'UNBLOCK_USER',
        entity: 'User',
        entityId: params.id,
        payload: JSON.stringify({
          targetUserEmail: targetUser.email,
          targetUserName: `${targetUser.firstName} ${targetUser.lastName}`,
          reason: reason || (block ? 'No reason provided' : 'Unblocked by admin'),
          previousStatus: targetUser.isBlocked
        })
      }
    });

    return NextResponse.json({
      success: true,
      message: `User ${block ? 'blocked' : 'unblocked'} successfully`
    });
  } catch (error) {
    console.error('Failed to toggle user block:', error);
    
    if (error instanceof Error && error.message === 'Authentication required') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    
    if (error instanceof Error && error.message === 'Admin access required') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }
    
    return NextResponse.json(
      { error: `Failed to toggle user block: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}
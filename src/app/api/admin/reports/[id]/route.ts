import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminOrModerator } from '@/lib/auth';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  let action: string = '';
  
  try {
    const user = await requireAdminOrModerator(request);
    const body = await request.json();
    action = body.action;

    if (!['resolve', 'dismiss'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be "resolve" or "dismiss"' },
        { status: 400 }
      );
    }

    // Check if the report exists
    const report = await prisma.auditLog.findUnique({
      where: { id: params.id },
      include: {
        actor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    });

    if (!report) {
      return NextResponse.json(
        { error: 'Report not found' },
        { status: 404 }
      );
    }

    if (report.action !== 'FLAG_POST') {
      return NextResponse.json(
        { error: 'Invalid report type' },
        { status: 400 }
      );
    }

    // Check if this report has already been resolved or dismissed
    const existingAction = await prisma.auditLog.findFirst({
      where: {
        OR: [
          { action: 'RESOLVE_REPORT' },
          { action: 'DISMISS_REPORT' }
        ],
        entityId: report.id
      }
    });

    if (existingAction) {
      return NextResponse.json(
        { error: 'Report has already been processed' },
        { status: 400 }
      );
    }

    // Create audit log entry for the resolve/dismiss action
    const auditAction = action === 'resolve' ? 'RESOLVE_REPORT' : 'DISMISS_REPORT';
    const payload = JSON.parse(report.payload || '{}');
    
    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: auditAction,
        entity: 'Report',
        entityId: report.id,
        payload: JSON.stringify({
          originalReportId: report.id,
          reportedBy: {
            id: report.actor.id,
            name: `${report.actor.firstName} ${report.actor.lastName}`,
            email: report.actor.email
          },
          reportReason: payload.reason || 'No reason provided',
          postId: report.entityId,
          postContent: payload.postContent?.substring(0, 100) || 'Content not available',
          adminAction: action
        })
      }
    });

    return NextResponse.json({ 
      success: true, 
      message: `Report ${action}d successfully` 
    });
  } catch (error) {
    console.error(`Failed to ${action} report:`, error);
    
    if (error instanceof Error && error.message === 'Authentication required') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    
    return NextResponse.json(
      { error: `Failed to ${action} report` },
      { status: 500 }
    );
  }
}
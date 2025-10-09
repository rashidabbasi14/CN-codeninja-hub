import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminOrModerator } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    await requireAdminOrModerator(request);

    // Fetch all flag reports from AuditLog
    const flagReports = await prisma.auditLog.findMany({
      where: {
        action: 'FLAG_POST'
      },
      include: {
        actor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Transform the data to match the expected ReportedContent interface
    const reports = await Promise.all(
      flagReports.map(async (report) => {
        const payload = JSON.parse(report.payload || '{}');
        
        // Check if this report has been resolved or dismissed
        const adminAction = await prisma.auditLog.findFirst({
          where: {
            OR: [
              { action: 'RESOLVE_REPORT' },
              { action: 'DISMISS_REPORT' }
            ],
            entityId: report.id
          }
        });

        const status = adminAction
          ? (adminAction.action === 'RESOLVE_REPORT' ? 'resolved' : 'dismissed')
          : 'pending';
        
        // Fetch the post details
        const post = await prisma.post.findUnique({
          where: { id: report.entityId },
          include: {
            author: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true
              }
            }
          }
        });

        // If post doesn't exist, it might have been deleted
        if (!post) {
          return {
            id: report.id,
            postId: report.entityId, // Use entityId as postId for deleted posts
            type: 'post' as const,
            content: payload.postContent || '[Content deleted]',
            author: {
              id: payload.postAuthorId || 'unknown',
              firstName: 'Unknown',
              lastName: 'User',
              email: 'unknown@example.com'
            },
            reportedBy: {
              id: report.actor.id,
              firstName: report.actor.firstName,
              lastName: report.actor.lastName,
              email: report.actor.email
            },
            reason: payload.reason || 'No reason provided',
            createdAt: report.createdAt.toISOString(),
            status: status as 'pending' | 'resolved' | 'dismissed'
          };
        }

        return {
          id: report.id,
          postId: post.id, // Add the actual post ID for deletion
          type: 'post' as const,
          content: post.content,
          author: {
            id: post.author.id,
            firstName: post.author.firstName,
            lastName: post.author.lastName,
            email: post.author.email
          },
          reportedBy: {
            id: report.actor.id,
            firstName: report.actor.firstName,
            lastName: report.actor.lastName,
            email: report.actor.email
          },
          reason: payload.reason || 'No reason provided',
          createdAt: report.createdAt.toISOString(),
          status: status as 'pending' | 'resolved' | 'dismissed'
        };
      })
    );

    return NextResponse.json(reports);
  } catch (error) {
    console.error('Failed to fetch reports:', error);
    
    if (error instanceof Error && error.message === 'Authentication required') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch reports' },
      { status: 500 }
    );
  }
}
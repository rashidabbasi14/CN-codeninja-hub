import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminOrModerator } from '@/lib/auth';

// Add timeout wrapper for database operations
const withTimeout = <T>(promise: Promise<T>, timeoutMs: number = 8000): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Database operation timeout')), timeoutMs)
    )
  ]);
};

// Force dynamic rendering
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAdminOrModerator(request);
    const { searchParams } = new URL(request.url);
    
    const page = parseInt(searchParams.get('page') || '0');
    const limit = parseInt(searchParams.get('limit') || '50');
    const status = searchParams.get('status'); // 'success', 'failed', 'all'
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const search = searchParams.get('search'); // Search in subject, recipients, etc.

    // Build where clause for email-specific filtering
    const where: any = {
      OR: [
        { action: 'EMAIL_PLAYERS_BULK' },
        { action: 'EMAIL_PLAYERS_BULK_FAILED' },
        { entity: 'EMAIL' }
      ]
    };
    
    // Filter by success/failure status
    if (status === 'success') {
      where.action = 'EMAIL_PLAYERS_BULK';
    } else if (status === 'failed') {
      where.action = 'EMAIL_PLAYERS_BULK_FAILED';
    }
    
    // Date range filtering
    if (startDate) {
      where.createdAt = {
        ...where.createdAt,
        gte: new Date(startDate)
      };
    }
    
    if (endDate) {
      where.createdAt = {
        ...where.createdAt,
        lte: new Date(endDate)
      };
    }

    // Get email logs with pagination
    const [emailLogs, totalCount] = await withTimeout(Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          actor: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              role: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        skip: page * limit,
        take: limit
      }),
      prisma.auditLog.count({ where })
    ]), 8000);

    // Process and enhance email logs
    const processedLogs = emailLogs.map((log: any) => {
      const payload = log.payload ? JSON.parse(log.payload) : {};
      const isSuccess = log.action === 'EMAIL_PLAYERS_BULK';
      
      return {
        id: log.id,
        action: log.action,
        entity: log.entity,
        entityId: log.entityId,
        actor: log.actor,
        createdAt: log.createdAt.toISOString(),
        status: isSuccess ? 'success' : 'failed',
        subject: payload.subject || 'N/A',
        recipientCount: payload.recipientCount || 0,
        recipients: payload.recipients || [],
        recipientType: payload.recipientType || 'unknown',
        gameId: payload.gameId || null,
        customEmails: payload.customEmails || null,
        error: payload.error || null,
        adminEmail: payload.adminEmail || log.actor?.email,
        adminName: payload.adminName || `${log.actor?.firstName} ${log.actor?.lastName}`,
        sentAt: payload.sentAt || log.createdAt.toISOString(),
        content: payload.content || null
      };
    });

    // Apply search filter if provided
    let filteredLogs = processedLogs;
    if (search && search.trim()) {
      const searchTerm = search.toLowerCase().trim();
      filteredLogs = processedLogs.filter(log => 
        log.subject.toLowerCase().includes(searchTerm) ||
        log.adminName.toLowerCase().includes(searchTerm) ||
        log.adminEmail.toLowerCase().includes(searchTerm) ||
        (log.recipients && log.recipients.some((email: string) => 
          email.toLowerCase().includes(searchTerm)
        )) ||
        (log.error && log.error.toLowerCase().includes(searchTerm))
      );
    }

    // Get summary statistics
    const stats = {
      total: totalCount,
      successful: emailLogs.filter(log => log.action === 'EMAIL_PLAYERS_BULK').length,
      failed: emailLogs.filter(log => log.action === 'EMAIL_PLAYERS_BULK_FAILED').length,
      totalRecipients: processedLogs.reduce((sum, log) => sum + (log.recipientCount || 0), 0)
    };

    return NextResponse.json({
      emailLogs: search ? filteredLogs : processedLogs,
      pagination: {
        page,
        limit,
        totalCount: search ? filteredLogs.length : totalCount,
        totalPages: Math.ceil((search ? filteredLogs.length : totalCount) / limit),
        hasNext: (page + 1) * limit < (search ? filteredLogs.length : totalCount),
        hasPrev: page > 0
      },
      stats
    });
  } catch (error) {
    console.error('Failed to fetch email logs:', error);
    
    if (error instanceof Error && error.message === 'Authentication required') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    
    if (error instanceof Error && error.message === 'Admin or Moderator access required') {
      return NextResponse.json({ error: 'Admin or Moderator access required' }, { status: 403 });
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch email logs' },
      { status: 500 }
    );
  }
}
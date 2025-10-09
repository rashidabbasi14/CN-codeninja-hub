import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin, requireAdminOrModerator } from '@/lib/auth';

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
    // For static generation, return empty data
    if (process.env.NODE_ENV === 'production' && process.env.NEXT_PHASE === 'phase-export') {
      return NextResponse.json({
        auditLogs: [],
        pagination: {
          page: 0,
          limit: 50,
          totalCount: 0,
          totalPages: 0,
          hasNext: false,
          hasPrev: false
        },
        filters: {
          actions: [],
          entities: [],
          users: []
        }
      });
    }

    const user = await requireAdminOrModerator(request);
    const { searchParams } = new URL(request.url);
    
    const page = parseInt(searchParams.get('page') || '0');
    const limit = parseInt(searchParams.get('limit') || '50');
    const action = searchParams.get('action');
    const entity = searchParams.get('entity');
    const actorId = searchParams.get('actorId');
    const role = searchParams.get('role');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Build where clause for filtering
    const where: any = {};
    
    if (action && action !== 'ALL') {
      where.action = action;
    }
    
    if (entity && entity !== 'ALL') {
      where.entity = {
        equals: entity,
        mode: 'insensitive'
      };
    }
    
    if (actorId) {
      where.actorId = actorId;
    }
    
    if (role && role !== 'ALL') {
      where.actor = {
        role: role
      };
    }
    
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

    // Get audit logs with pagination using timeout wrapper
    const [auditLogs, totalCount] = await withTimeout(Promise.all([
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
    ]), 5000); // 5 second timeout for main query

    // Get unique actions, entities, and users for filter options with limits for performance
    const [actions, entities, users] = await withTimeout(Promise.all([
      prisma.auditLog.findMany({
        select: { action: true },
        distinct: ['action'],
        orderBy: { action: 'asc' },
        take: 50 // Limit to prevent performance issues
      }),
      prisma.auditLog.findMany({
        select: { entity: true },
        distinct: ['entity'],
        orderBy: { entity: 'asc' },
        take: 20 // Limit to prevent performance issues
      }),
      prisma.auditLog.findMany({
        select: {
          actor: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          }
        },
        distinct: ['actorId'],
        orderBy: {
          actor: {
            firstName: 'asc'
          }
        },
        take: 100 // Limit to prevent performance issues
      })
    ]), 3000); // 3 second timeout for filter queries

    return NextResponse.json({
      auditLogs: auditLogs.map((log: any) => ({
        id: log.id,
        action: log.action,
        entity: log.entity,
        entityId: log.entityId,
        actor: log.actor,
        payload: log.payload ? JSON.parse(log.payload) : null,
        createdAt: log.createdAt.toISOString()
      })),
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasNext: (page + 1) * limit < totalCount,
        hasPrev: page > 0
      },
      filters: {
        actions: actions.map((a: any) => a.action),
        entities: [...new Set(entities.map((e: any) => e.entity.toLowerCase()))].sort(),
        users: users.map((u: any) => ({
          id: u.actor.id,
          name: `${u.actor.firstName} ${u.actor.lastName}`,
          email: u.actor.email
        }))
      }
    });
  } catch (error) {
    console.error('Failed to fetch audit logs:', error);
    
    if (error instanceof Error && error.message === 'Authentication required') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    
    if (error instanceof Error && error.message === 'Admin or Moderator access required') {
      return NextResponse.json({ error: 'Admin or Moderator access required' }, { status: 403 });
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch audit logs' },
      { status: 500 }
    );
  }
}
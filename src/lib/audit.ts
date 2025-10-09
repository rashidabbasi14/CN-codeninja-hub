
import { prisma } from './prisma';

export interface AuditLogEntry {
  id: string;
  actorId: string;
  actorName: string;
  action: string;
  entity: string;
  entityId: string;
  payload: any;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

export type AuditAction =
  // User management
  | 'user.created'
  | 'user.updated'
  | 'user.blocked'
  | 'user.unblocked'
  | 'user.promoted'
  | 'user.demoted'
  | 'user.deleted'
  | 'user.email_verified'
  
  // Department management
  | 'department.created'
  | 'department.updated'
  | 'department.deleted'
  
  // Category management
  | 'category.created'
  | 'category.updated'
  | 'category.deleted'
  | 'category.status_changed'
  | 'category.completed'
  | 'category.abandoned'
  | 'category.restored'
  | 'category.copied'
  
  // Game management
  | 'game.created'
  | 'game.updated'
  | 'game.deleted'
  | 'game.published'
  | 'game.unpublished'
  
  // Schedule management
  | 'schedule.generated'
  | 'schedule.updated'
  | 'schedule.published'
  | 'match.moved'
  | 'match.rescheduled'
  | 'match.scheduled'
  | 'match.unscheduled'
  
  // Results management
  | 'result.entered'
  | 'result.updated'
  | 'result.deleted'
  | 'winner.declared'
  
  // Email management
  | 'email.sent'
  | 'email.template.created'
  | 'email.template.updated'
  | 'email.template.deleted'
  | 'email.settings.updated'
  
  // Content moderation
  | 'post.removed'
  | 'comment.removed'
  | 'content.flagged'
  | 'content.approved'
  
  // Events and Registration activities
  | 'events.viewed'
  | 'game.registered'
  | 'game.unregistered'
  | 'game.registration_updated'
  | 'team.joined'
  | 'team.created'
  | 'team.members_added'
  | 'schedule.viewed'
  
  // System actions
  | 'system.backup'
  | 'system.restore'
  | 'system.maintenance'
  | 'settings.updated';

export type AuditEntity =
  | 'user'
  | 'department'
  | 'category'
  | 'game'
  | 'schedule'
  | 'match'
  | 'result'
  | 'email'
  | 'template'
  | 'post'
  | 'comment'
  | 'system'
  | 'settings'
  | 'event'
  | 'registration'
  | 'team';

class AuditLogger {
  async log(
    actorId: string,
    action: AuditAction,
    entity: AuditEntity,
    entityId: string,
    payload: any = {},
    metadata?: {
      ipAddress?: string;
      userAgent?: string;
    }
  ): Promise<void> {
    // Use a timeout to prevent audit logging from blocking main operations
    const auditPromise = this.createAuditLogWithTimeout(actorId, action, entity, entityId, payload, metadata);
    
    // Don't await the audit log creation to avoid blocking the main operation
    auditPromise.catch(error => {
      console.error('Failed to create audit log:', error);
    });
  }

  private async createAuditLogWithTimeout(
    actorId: string,
    action: AuditAction,
    entity: AuditEntity,
    entityId: string,
    payload: any = {},
    metadata?: {
      ipAddress?: string;
      userAgent?: string;
    }
  ): Promise<void> {
    // Set a timeout of 5 seconds for audit logging
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Audit logging timeout')), 5000);
    });

    try {
      await Promise.race([
        this.performAuditLog(actorId, action, entity, entityId, payload, metadata),
        timeoutPromise
      ]);
    } catch (error) {
      console.error('Audit logging failed or timed out:', error);
      // Don't throw error to avoid breaking the main operation
    }
  }

  private async performAuditLog(
    actorId: string,
    action: AuditAction,
    entity: AuditEntity,
    entityId: string,
    payload: any = {},
    metadata?: {
      ipAddress?: string;
      userAgent?: string;
    }
  ): Promise<void> {
    // Get actor information
    const actor = await prisma.user.findUnique({
      where: { id: actorId },
      select: { firstName: true, lastName: true, email: true },
    });

    if (!actor) {
      console.error('Audit log failed: Actor not found', { actorId, action, entity, entityId });
      return;
    }

    // Create audit log entry
    await prisma.auditLog.create({
      data: {
        actorId,
        action,
        entity,
        entityId,
        payload: JSON.stringify({
          ...payload,
          actorName: `${actor.firstName} ${actor.lastName}`,
          ipAddress: metadata?.ipAddress,
          userAgent: metadata?.userAgent,
        }),
      },
    });

    console.log('Audit log created:', {
      actor: `${actor.firstName} ${actor.lastName}`,
      action,
      entity,
      entityId,
    });
  }

  async getAuditLogs(
    filters?: {
      actorId?: string;
      action?: AuditAction;
      entity?: AuditEntity;
      entityId?: string;
      startDate?: Date;
      endDate?: Date;
    },
    pagination?: {
      page?: number;
      limit?: number;
    }
  ): Promise<{
    logs: AuditLogEntry[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    try {
      const page = pagination?.page || 1;
      const limit = pagination?.limit || 50;
      const skip = (page - 1) * limit;

      const where: any = {};

      if (filters?.actorId) where.actorId = filters.actorId;
      if (filters?.action) where.action = filters.action;
      if (filters?.entity) where.entity = filters.entity;
      if (filters?.entityId) where.entityId = filters.entityId;
      
      if (filters?.startDate || filters?.endDate) {
        where.createdAt = {};
        if (filters.startDate) where.createdAt.gte = filters.startDate;
        if (filters.endDate) where.createdAt.lte = filters.endDate;
      }

      const [logs, total] = await Promise.all([
        prisma.auditLog.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        prisma.auditLog.count({ where }),
      ]);

      const parsedLogs: AuditLogEntry[] = logs.map((log: any) => ({
        ...log,
        payload: JSON.parse(log.payload || '{}'),
      }));

      return {
        logs: parsedLogs,
        total,
        page,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      console.error('Failed to get audit logs:', error);
      return {
        logs: [],
        total: 0,
        page: 1,
        totalPages: 0,
      };
    }
  }

  async getEntityHistory(
    entity: AuditEntity,
    entityId: string
  ): Promise<AuditLogEntry[]> {
    try {
      const logs = await prisma.auditLog.findMany({
        where: {
          entity,
          entityId,
        },
        orderBy: { createdAt: 'desc' },
      });

      return logs.map((log: any) => ({
        ...log,
        payload: JSON.parse(log.payload || '{}'),
      }));
    } catch (error) {
      console.error('Failed to get entity history:', error);
      return [];
    }
  }

  async getUserActivity(
    userId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<AuditLogEntry[]> {
    try {
      const where: any = { actorId: userId };
      
      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = startDate;
        if (endDate) where.createdAt.lte = endDate;
      }

      const logs = await prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 100, // Limit to recent 100 activities
      });

      return logs.map((log: any) => ({
        ...log,
        payload: JSON.parse(log.payload || '{}'),
      }));
    } catch (error) {
      console.error('Failed to get user activity:', error);
      return [];
    }
  }

  async getSystemStats(): Promise<{
    totalLogs: number;
    todayLogs: number;
    topActors: Array<{ actorName: string; count: number }>;
    topActions: Array<{ action: string; count: number }>;
    recentActivity: AuditLogEntry[];
  }> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [
        totalLogs,
        todayLogs,
        topActorsRaw,
        topActionsRaw,
        recentActivity,
      ] = await Promise.all([
        prisma.auditLog.count(),
        prisma.auditLog.count({
          where: {
            createdAt: { gte: today },
          },
        }),
        prisma.auditLog.groupBy({
          by: ['actorId'],
          _count: { actorId: true },
          orderBy: { _count: { actorId: 'desc' } },
          take: 5,
        }),
        prisma.auditLog.groupBy({
          by: ['action'],
          _count: { action: true },
          orderBy: { _count: { action: 'desc' } },
          take: 5,
        }),
        prisma.auditLog.findMany({
          orderBy: { createdAt: 'desc' },
          take: 10,
        }),
      ]);

      const topActors = topActorsRaw.map((actor: any) => ({
        actorName: actor.actorName,
        count: actor._count.actorName,
      }));

      const topActions = topActionsRaw.map((action: any) => ({
        action: action.action,
        count: action._count.action,
      }));

      const parsedRecentActivity = recentActivity.map((log: any) => ({
        ...log,
        payload: JSON.parse(log.payload || '{}'),
      }));

      return {
        totalLogs,
        todayLogs,
        topActors,
        topActions,
        recentActivity: parsedRecentActivity,
      };
    } catch (error) {
      console.error('Failed to get system stats:', error);
      return {
        totalLogs: 0,
        todayLogs: 0,
        topActors: [],
        topActions: [],
        recentActivity: [],
      };
    }
  }

  // Helper method to format action descriptions
  formatActionDescription(action: AuditAction, payload: any): string {
    const actionDescriptions: Record<AuditAction, (payload: any) => string> = {
      // User management
      'user.created': (p) => `Created user account`,
      'user.updated': (p) => `Updated user profile${p.fields ? ` (${p.fields.join(', ')})` : ''}`,
      'user.blocked': (p) => `Blocked user account${p.reason ? ` - ${p.reason}` : ''}`,
      'user.unblocked': (p) => `Unblocked user account`,
      'user.promoted': (p) => `Promoted user to ${p.newRole || 'admin'}`,
      'user.demoted': (p) => `Demoted user from ${p.oldRole || 'admin'}`,
      'user.deleted': (p) => `Deleted user account`,
      'user.email_verified': (p) => `Verified email for ${p.targetUserName || 'user'}`,

      // Department management
      'department.created': (p) => `Created department "${p.name}"`,
      'department.updated': (p) => `Updated department "${p.name}"`,
      'department.deleted': (p) => `Deleted department "${p.name}"`,

      // Category management
      'category.created': (p) => `Created category "${p.name}"`,
      'category.updated': (p) => `Updated category "${p.name}"`,
      'category.deleted': (p) => `Deleted category "${p.name}"`,
      'category.status_changed': (p) => `Changed category "${p.name}" status from ${p.oldStatus} to ${p.newStatus}`,
      'category.completed': (p) => `Completed category "${p.name}"`,
      'category.abandoned': (p) => `Abandoned category "${p.name}"`,
      'category.restored': (p) => `Restored category "${p.name}"`,
      'category.copied': (p) => `Created copy of category "${p.originalName}" as "${p.newName}"`,

      // Game management
      'game.created': (p) => `Created game "${p.name}"`,
      'game.updated': (p) => `Updated game "${p.name}"`,
      'game.deleted': (p) => `Deleted game "${p.name}"`,
      'game.published': (p) => `Published game "${p.name}"`,
      'game.unpublished': (p) => `Unpublished game "${p.name}"`,

      // Schedule management
      'schedule.generated': (p) => `Generated schedule for ${p.gameCount || 0} games`,
      'schedule.updated': (p) => `Updated schedule`,
      'schedule.published': (p) => `Published schedule`,
      'match.moved': (p) => `Moved match to ${p.newTime || 'new time'}`,
      'match.rescheduled': (p) => `Rescheduled match`,
      'match.scheduled': (p) => `Scheduled match for ${p.gameName || 'game'}${p.timeSlot ? ` at ${p.timeSlot}` : ''}`,
      'match.unscheduled': (p) => `Unscheduled match from ${p.gameName || 'game'}${p.timeSlot ? ` at ${p.timeSlot}` : ''}`,

      // Results management
      'result.entered': (p) => `Entered result: ${p.winner} won`,
      'result.updated': (p) => `Updated match result`,
      'result.deleted': (p) => `Deleted match result`,
      'winner.declared': (p) => `Declared ${p.winner} as winner`,

      // Email management
      'email.sent': (p) => `Sent email to ${p.recipientCount || 0} recipients`,
      'email.template.created': (p) => `Created email template "${p.name}"`,
      'email.template.updated': (p) => `Updated email template "${p.name}"`,
      'email.template.deleted': (p) => `Deleted email template "${p.name}"`,
      'email.settings.updated': (p) => `Updated email settings`,

      // Content moderation
      'post.removed': (p) => `Removed post${p.reason ? ` - ${p.reason}` : ''}`,
      'comment.removed': (p) => `Removed comment${p.reason ? ` - ${p.reason}` : ''}`,
      'content.flagged': (p) => `Flagged content for review`,
      'content.approved': (p) => `Approved flagged content`,

      // Events and Registration activities
      'events.viewed': (p) => `Viewed events page`,
      'game.registered': (p) => `Registered for game "${p.gameName}"${p.mode === 'TEAM' ? ` as team "${p.teamName}"` : ' individually'}`,
      'game.unregistered': (p) => `Unregistered from game "${p.gameName}"`,
      'game.registration_updated': (p) => `Updated registration for game "${p.gameName}"`,
      'team.joined': (p) => `Joined team "${p.teamName}" for game "${p.gameName}"`,
      'team.created': (p) => `Created team "${p.teamName}" for game "${p.gameName}"`,
      'team.members_added': (p) => `Added ${p.memberCount} member(s) to team "${p.teamName}" for game "${p.gameName}"`,
      'schedule.viewed': (p) => `Viewed schedule for event "${p.eventName}"`,

      // System actions
      'system.backup': (p) => `Created system backup`,
      'system.restore': (p) => `Restored system from backup`,
      'system.maintenance': (p) => `Performed system maintenance`,
      'settings.updated': (p) => `Updated system settings`,
    };

    const formatter = actionDescriptions[action];
    return formatter ? formatter(payload) : `Performed ${action}`;
  }
}

export const auditLogger = new AuditLogger();

// Middleware helper for Next.js API routes
// Middleware helper for Next.js API routes
export function withAudit(
  action: AuditAction,
  entity: AuditEntity,
  getEntityId: (req: any, res: any) => string,
  getPayload?: (req: any, res: any) => any
) {
  return function (handler: any) {
    return async function (req: any, res: any) {
      try {
        // Execute the original handler
        const result = await handler(req, res);
        
        // Log the action after successful execution
        const actorId = req.user?.id || req.session?.userId;
        if (actorId) {
          const entityId = getEntityId(req, res);
          const payload = getPayload ? getPayload(req, res) : req.body;
          
          await auditLogger.log(
            actorId,
            action,
            entity,
            entityId,
            payload,
            {
              ipAddress: req.ip || req.connection?.remoteAddress,
              userAgent: req.headers['user-agent'],
            }
          );
        }
        
        return result;
      } catch (error) {
        // Don't log failed operations
        throw error;
      }
    };
  };
}

// Helper function to extract IP address from request
export function getClientIP(req: any): string {
  return req.ip ||
         req.connection?.remoteAddress ||
         req.socket?.remoteAddress ||
         req.headers['x-forwarded-for']?.split(',')[0] ||
         'unknown';
}

// Helper function to create audit context from request
export function createAuditContext(req: any) {
  return {
    ipAddress: getClientIP(req),
    userAgent: req.headers['user-agent'] || 'unknown',
  };
}
import { NextRequest } from 'next/server';
import { prisma } from './prisma';
import { verifyToken } from './jwt';

export async function getCurrentUser(request: NextRequest) {
  try {
    // Get JWT token from Authorization header
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    
    const token = authHeader.replace('Bearer ', '');
    
    // Verify JWT token
    const payload = verifyToken(token);
    if (!payload) {
      return null;
    }

    // Get user from database using userId from token
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: {
        department: true
      }
    });

    if (!user || user.isBlocked) {
      return null;
    }

    return user;
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
}

export async function requireAuth(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) {
    throw new Error('Authentication required');
  }
  return user;
}

export async function requireAdmin(request: NextRequest) {
  const user = await requireAuth(request);
  if (user.role !== 'ADMIN') {
    throw new Error('Admin access required');
  }
  return user;
}

export async function requireAdminOrModerator(request: NextRequest) {
  const user = await requireAuth(request);
  if (user.role !== 'ADMIN' && user.role !== 'MODERATOR') {
    throw new Error('Admin or Moderator access required');
  }
  return user;
}

export async function requireAdminForDelete(request: NextRequest) {
  const user = await requireAuth(request);
  if (user.role !== 'ADMIN') {
    throw new Error('Admin access required for delete operations');
  }
  return user;
}

export function hasAdminAccess(user: any): boolean {
  return user?.role === 'ADMIN';
}

export function hasModeratorAccess(user: any): boolean {
  return user?.role === 'MODERATOR' || user?.role === 'ADMIN';
}

export function canDelete(user: any): boolean {
  return user?.role === 'ADMIN';
}

export function canModerate(user: any): boolean {
  return user?.role === 'MODERATOR' || user?.role === 'ADMIN';
}
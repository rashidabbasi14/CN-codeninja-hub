import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const department = searchParams.get('department') || '';

    const where: any = {
      // Only return active users (not blocked)
      isBlocked: false
    };

    // Search filter
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
      ];
    }

    // Department filter
    if (department && department !== 'all') {
      where.department = {
        name: department
      };
    }

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        department: {
          select: {
            name: true
          }
        }
      },
      orderBy: {
        firstName: 'asc'
      }
    });

    // Transform the data to match the frontend interface
    const transformedUsers = users
      .filter(u => u.id !== user.id) // Exclude current user
      .map((u: any) => ({
        id: u.id,
        name: `${u.firstName} ${u.lastName}`,
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        department: u.department?.name || 'No Department'
      }));

    return NextResponse.json(transformedUsers);
  } catch (error) {
    console.error('Failed to fetch users:', error);
    
    if (error instanceof Error && error.message === 'Authentication required') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}
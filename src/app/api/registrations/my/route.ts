import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    const registrations = await prisma.registration.findMany({
      where: { userId: user.id },
      include: {
        game: {
          include: {
            category: true
          }
        }
      }
    });

    // For team registrations, we'll need to fetch team data separately if needed
    const transformedRegistrations = registrations.map((reg: any) => ({
      id: reg.id,
      gameId: reg.gameId,
      level: reg.level,
      mode: reg.mode,
      teamId: reg.teamId,
      allowAutoAssign: reg.allowAutoAssign,
      game: {
        name: reg.game.name,
        category: {
          name: reg.game.category.name
        }
      }
    }));

    return NextResponse.json(transformedRegistrations);
  } catch (error) {
    console.error('Failed to fetch user registrations:', error);
    
    if (error instanceof Error && error.message === 'Authentication required') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch registrations' },
      { status: 500 }
    );
  }
}
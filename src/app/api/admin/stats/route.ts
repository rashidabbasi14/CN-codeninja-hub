import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin, requireAdminOrModerator } from '@/lib/auth';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    await requireAdminOrModerator(request);

    // Get user statistics
    const [
      totalUsers,
      activeUsers,
      blockedUsers,
      admins,
      totalGames,
      totalRegistrations
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { isBlocked: false } }),
      prisma.user.count({ where: { isBlocked: true } }),
      prisma.user.count({ where: { role: 'ADMIN' } }),
      prisma.game.count({
        where: {
          category: {
            status: 'ACTIVE'
          }
        }
      }),
      prisma.registration.count({
        where: {
          game: {
            category: {
              status: 'ACTIVE'
            }
          }
        }
      })
    ]);

    // Calculate active games and completed games from active categories only
    const gamesFromActiveCategories = await prisma.game.findMany({
      where: {
        category: {
          status: 'ACTIVE'
        }
      },
      include: {
        matches: {
          select: {
            winnerId: true
          }
        }
      }
    });

    let activeGames = 0;
    let completedGames = 0;

    gamesFromActiveCategories.forEach(game => {
      const totalMatches = game.matches.length;
      const completedMatches = game.matches.filter(match => match.winnerId !== null).length;
      
      if (totalMatches === 0) {
        // No matches yet, consider as active if it's in an active category
        activeGames++;
      } else if (completedMatches === totalMatches) {
        // All matches completed
        completedGames++;
      } else {
        // Some matches pending
        activeGames++;
      }
    });

    const stats = {
      totalUsers,
      activeUsers,
      blockedUsers,
      admins,
      totalGames,
      activeGames,
      completedMatches: completedGames,
      totalRegistrations
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Failed to fetch admin stats:', error);
    
    if (error instanceof Error && error.message === 'Authentication required') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    
    if (error instanceof Error && error.message === 'Admin or Moderator access required') {
      return NextResponse.json({ error: 'Admin or Moderator access required' }, { status: 403 });
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
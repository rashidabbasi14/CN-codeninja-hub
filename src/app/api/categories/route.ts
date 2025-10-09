import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin, requireAdminOrModerator } from '@/lib/auth';
import { auditLogger } from '@/lib/audit';

export async function GET(request: NextRequest) {
  try {
    // For static generation, allow unauthenticated access
    let user = null;
    try {
      user = await requireAdminOrModerator(request);
    } catch (error) {
      // During static generation, there's no authenticated user
      // Return empty array or basic data
      if (process.env.NODE_ENV === 'production' || process.env.NEXT_PHASE === 'phase-export') {
        return NextResponse.json([]);
      }
      throw error;
    }

    // Get status filter from query params
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status') || 'ACTIVE';

    let categories: any[];
    if (statusFilter === 'ALL') {
      categories = await prisma.category.findMany({
        include: {
          games: {
            select: {
              id: true,
              name: true,
              description: true,
              weightage: true,
              typeFormat: true,
              contestType: true,
              avgGameTime: true,
              levels: true,
              simultaneousGames: true,
              allowDraws: true
            }
          }
        },
        orderBy: {
          startDate: 'asc'
        }
      });
    } else {
      // Filter by status using Prisma query
      categories = await prisma.category.findMany({
        where: {
          status: statusFilter
        },
        include: {
          games: {
            select: {
              id: true,
              name: true,
              description: true,
              weightage: true,
              typeFormat: true,
              contestType: true,
              avgGameTime: true,
              levels: true,
              simultaneousGames: true,
              allowDraws: true
            }
          }
        },
        orderBy: {
          startDate: 'asc'
        }
      });
    }

    // Parse JSON strings
    const parsedCategories = categories.map((category: any) => ({
      ...category,
      dailyWindows: JSON.parse(category.dailyWindows || '[]'),
      games: category.games.map((game: any) => ({
        ...game,
        levels: JSON.parse(game.levels || '[]'),
        oneLoserMode: game.contestType === 'SINGLE_ELIMINATION_1V1V1V1' ? game.allowDraws : false
      }))
    }));

    return NextResponse.json(parsedCategories);
  } catch (error) {
    console.error('Failed to fetch categories:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch categories' },
      { status: error instanceof Error && error.message === 'Authentication required' ? 401 : 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAdmin(request);
    const body = await request.json();

    const {
      name,
      gamesCountMode,
      startDate,
      endDate,
      dailyWindows,
      perPersonCap,
      locationName,
      locationMapsLink,
      registrationDeadline
    } = body;

    // Validate required fields
    if (!name || !startDate || !endDate || !locationName || !perPersonCap) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate dates
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (start > end) {
      return NextResponse.json(
        { error: 'Start date must be before end date' },
        { status: 400 }
      );
    }

    const category = await prisma.category.create({
      data: {
        name,
        gamesCountMode: gamesCountMode || 'UNLIMITED',
        startDate: start,
        endDate: end,
        dailyWindows: JSON.stringify(dailyWindows || [{ start: '09:00', end: '17:00' }]),
        perPersonCap: parseInt(perPersonCap),
        locationName,
        locationMapsLink: locationMapsLink || null,
        // registrationDeadline is expected to be an ISO string in UTC from frontend
        registrationDeadline: registrationDeadline ? new Date(registrationDeadline) : null,
        createdBy: user.id,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      include: {
        games: {
          select: {
            id: true,
            name: true,
            description: true,
            weightage: true,
            typeFormat: true,
            contestType: true,
            avgGameTime: true,
            levels: true,
            simultaneousGames: true
          }
        }
      }
    });

    // Log the action
    await auditLogger.log(user.id, 'category.created', 'category', category.id, {
      name: category.name,
      locationName: category.locationName
    });

    // Invalidate related cache entries
    const { invalidateCache } = await import('@/lib/cache');
    invalidateCache('games');
    invalidateCache('events');
    invalidateCache('leaderboard');
    invalidateCache('schedule');
    invalidateCache('results');

    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    console.error('Failed to create category:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create category' },
      { status: error instanceof Error && error.message === 'Authentication required' ? 401 : 500 }
    );
  }
}
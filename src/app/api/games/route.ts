import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get('categoryId');

    let games;
    if (categoryId) {
      games = await prisma.game.findMany({
        where: { categoryId },
        include: {
          category: true,
          registrations: {
            include: {
              user: true,
              team: {
                include: {
                  members: {
                    include: {
                      user: true
                    }
                  }
                }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });
    } else {
      games = await prisma.game.findMany({
        include: {
          category: true,
          registrations: {
            include: {
              user: true,
              team: {
                include: {
                  members: {
                    include: {
                      user: true
                    }
                  }
                }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });
    }

    // Parse JSON fields and map allowDraws to oneLoserMode for 1v1v1v1
    const gamesWithParsedData = games.map((game: any) => {
      // For SINGLE_ELIMINATION_1V1V1V1, allowDraws represents oneLoserMode
      const oneLoserMode = game.contestType === 'SINGLE_ELIMINATION_1V1V1V1'
        ? game.allowDraws
        : false;
      
      return {
        ...game,
        levels: JSON.parse(game.levels || '[]'),
        oneLoserMode
      };
    });

    return NextResponse.json(gamesWithParsedData);
  } catch (error) {
    console.error('Failed to fetch games:', error);
    return NextResponse.json(
      { error: 'Failed to fetch games' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAdmin(request);

    const body = await request.json();
    const {
      categoryId,
      name,
      description,
      weightage,
      typeFormat,
      contestType,
      avgGameTime,
      levels,
      simultaneousGames,
      allowDraws = false,
      courtsRequiredPerMatch = 1,
      minRestMinutes = 15,
      backToBackAllowed = false,
      seedingMethod = 'RANDOM',
      groupSize,
      rounds,
      oneLoserMode = false
    } = body;

    // Validate required fields
    if (!categoryId || !name || !typeFormat || !contestType) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Verify category exists
    const category = await prisma.category.findUnique({
      where: { id: categoryId }
    });

    if (!category) {
      return NextResponse.json(
        { error: 'Category not found' },
        { status: 404 }
      );
    }

    // For SINGLE_ELIMINATION_1V1V1V1, use allowDraws to store oneLoserMode
    // For other contest types, use the provided allowDraws value
    const allowDrawsValue = contestType === 'SINGLE_ELIMINATION_1V1V1V1'
      ? oneLoserMode
      : allowDraws;
    
    const game = await prisma.game.create({
      data: {
        categoryId,
        name,
        description: description || null,
        weightage: weightage || 1,
        typeFormat,
        contestType,
        avgGameTime: avgGameTime || 30,
        levels: JSON.stringify(levels || ['Beginner']),
        simultaneousGames: simultaneousGames || 1,
        allowDraws: allowDrawsValue,
        courtsRequiredPerMatch,
        minRestMinutes,
        backToBackAllowed,
        seedingMethod,
        groupSize,
        rounds,
        createdBy: user.id
      },
      include: {
        category: true
      }
    });

    // Parse JSON fields and map allowDraws to oneLoserMode for response
    const oneLoserModeValue = contestType === 'SINGLE_ELIMINATION_1V1V1V1'
      ? game.allowDraws
      : false;
    
    const gameWithParsedData = {
      ...game,
      levels: JSON.parse(game.levels || '[]'),
      oneLoserMode: oneLoserModeValue
    };

    // Invalidate related cache entries
    const { invalidateCache } = await import('@/lib/cache');
    invalidateCache('games');
    invalidateCache('events');
    invalidateCache('leaderboard');
    invalidateCache('schedule');
    invalidateCache('results');

    return NextResponse.json(gameWithParsedData, { status: 201 });
  } catch (error) {
    console.error('Failed to create game:', error);
    
    if (error instanceof Error && error.message === 'Authentication required') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    if (error instanceof Error && error.message === 'Admin access required') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    return NextResponse.json(
      { error: 'Failed to create game' },
      { status: 500 }
    );
  }
}
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { invalidateCache } from '@/lib/cache';
import { requireAdminForDelete, requireAdminOrModerator } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const game = await prisma.game.findUnique({
      where: { id: params.id },
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
      }
    });

    if (!game) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    // Parse JSON fields and map allowDraws to oneLoserMode for 1v1v1v1
    const oneLoserMode = game.contestType === 'SINGLE_ELIMINATION_1V1V1V1'
      ? game.allowDraws
      : false;
    
    const gameWithParsedData = {
      ...game,
      levels: JSON.parse(game.levels || '[]'),
      oneLoserMode
    };

    return NextResponse.json(gameWithParsedData);
  } catch (error) {
    console.error('Failed to fetch game:', error);
    return NextResponse.json(
      { error: 'Failed to fetch game' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAdminOrModerator(request);

    const body = await request.json();
    const {
      name,
      description,
      weightage,
      typeFormat,
      contestType,
      avgGameTime,
      levels,
      simultaneousGames,
      allowDraws,
      courtsRequiredPerMatch,
      minRestMinutes,
      backToBackAllowed,
      seedingMethod,
      groupSize,
      rounds,
      oneLoserMode = false
    } = body;

    // Check if game exists
    const existingGame = await prisma.game.findUnique({
      where: { id: params.id }
    });

    if (!existingGame) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    // Check if typeFormat is being changed to 1v1 and handle team cleanup
    const isChangingTo1v1 = typeFormat === '1v1' && existingGame.typeFormat !== '1v1';
    
    // For SINGLE_ELIMINATION_1V1V1V1, use allowDraws to store oneLoserMode
    // For other contest types, use the provided allowDraws value
    const allowDrawsValue = contestType === 'SINGLE_ELIMINATION_1V1V1V1'
      ? oneLoserMode
      : allowDraws;
    
    const updatedGame = await prisma.$transaction(async (tx) => {
      // Update the game
      const game = await tx.game.update({
        where: { id: params.id },
        data: {
          name,
          description: description || null,
          weightage,
          typeFormat,
          contestType,
          avgGameTime,
          levels: JSON.stringify(levels),
          simultaneousGames,
          allowDraws: allowDrawsValue,
          courtsRequiredPerMatch,
          minRestMinutes,
          backToBackAllowed,
          seedingMethod,
          groupSize,
          rounds
        },
        include: {
          category: true
        }
      });

      // If changing to 1v1, clean up teams and update registrations
      if (isChangingTo1v1) {
        // Update all registrations for this game to INDIVIDUAL mode
        await tx.registration.updateMany({
          where: { gameId: params.id },
          data: {
            mode: 'INDIVIDUAL',
            teamId: null // Remove team association
          }
        });

        // Delete all teams for this game
        await tx.team.deleteMany({
          where: { gameId: params.id }
        });

        // Delete all matches since team structure changed
        await tx.match.deleteMany({
          where: { gameId: params.id }
        });

        // Delete all time slots since matches are deleted
        await tx.slot.deleteMany({
          where: { gameId: params.id }
        });
      }

      return game;
    });

    // Parse JSON fields and map allowDraws to oneLoserMode for response
    const oneLoserModeValue = contestType === 'SINGLE_ELIMINATION_1V1V1V1'
      ? updatedGame.allowDraws
      : false;
    
    const gameWithParsedData = {
      ...updatedGame,
      levels: JSON.parse(updatedGame.levels || '[]'),
      oneLoserMode: oneLoserModeValue
    };

    // Invalidate related cache entries
    invalidateCache('games');
    invalidateCache('events');
    invalidateCache('leaderboard');
    invalidateCache('schedule');
    invalidateCache('results');

    return NextResponse.json(gameWithParsedData);
  } catch (error) {
    console.error('Failed to update game:', error);
    
    if (error instanceof Error && error.message === 'Authentication required') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    if (error instanceof Error && error.message === 'Admin or Moderator access required') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    return NextResponse.json(
      { error: 'Failed to update game' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAdminForDelete(request);

    // Check if game exists
    const existingGame = await prisma.game.findUnique({
      where: { id: params.id }
    });

    if (!existingGame) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    // Delete related records first
    await prisma.registration.deleteMany({
      where: { gameId: params.id }
    });

    await prisma.match.deleteMany({
      where: { gameId: params.id }
    });

    // Delete the game
    await prisma.game.delete({
      where: { id: params.id }
    });

    // Invalidate related cache entries
    invalidateCache('games');
    invalidateCache('events');
    invalidateCache('leaderboard');
    invalidateCache('schedule');
    invalidateCache('results');

    return NextResponse.json({ message: 'Game deleted successfully' });
  } catch (error) {
    console.error('Failed to delete game:', error);
    return NextResponse.json(
      { error: 'Failed to delete game' },
      { status: 500 }
    );
  }
}
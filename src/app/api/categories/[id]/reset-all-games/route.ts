import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAdmin(request);
    if (!user) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const categoryId = params.id;

    console.log('Resetting all games for category:', categoryId);

    // First, verify the category exists and get all games
    const category = await prisma.category.findUnique({
      where: { id: categoryId },
      include: {
        games: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    if (!category) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    if (category.games.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No games found in this category to reset',
        gamesReset: 0
      });
    }

    const gameIds = category.games.map(game => game.id);
    console.log(`Found ${gameIds.length} games to reset:`, category.games.map(g => g.name));

    // Reset all games in the category in a transaction
    await prisma.$transaction(async (tx) => {
      // Delete all registrations for all games in this category
      await tx.registration.deleteMany({
        where: { gameId: { in: gameIds } }
      });

      // Delete all matches for all games in this category
      await tx.match.deleteMany({
        where: { gameId: { in: gameIds } }
      });

      // Delete all teams for all games in this category
      await tx.team.deleteMany({
        where: { gameId: { in: gameIds } }
      });

      // Delete all slots for all games in this category
      await tx.slot.deleteMany({
        where: { gameId: { in: gameIds } }
      });
    });

    console.log(`Successfully reset ${gameIds.length} games in category: ${category.name}`);

    return NextResponse.json({ 
      success: true,
      message: `Successfully reset all ${gameIds.length} game(s) in category "${category.name}"`,
      categoryId,
      categoryName: category.name,
      gamesReset: gameIds.length,
      gameNames: category.games.map(g => g.name)
    });

  } catch (error) {
    console.error('Error resetting all games in category:', error);
    return NextResponse.json(
      { error: 'Failed to reset all games in category' },
      { status: 500 }
    );
  }
}
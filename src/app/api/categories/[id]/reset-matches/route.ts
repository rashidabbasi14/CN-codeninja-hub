import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, requireAdmin } from '@/lib/auth';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Require admin authentication for DELETE operations
    const user = await requireAdmin(request);
    
    const categoryId = params.id;

    console.log('Resetting all matches for category:', categoryId);

    // First, verify the category exists
    const category = await prisma.category.findUnique({
      where: { id: categoryId },
      include: {
        games: {
          include: {
            matches: true
          }
        }
      }
    });

    if (!category) {
      return NextResponse.json(
        { error: 'Category not found' },
        { status: 404 }
      );
    }

    // Get all matches that don't have winners (concluded matches cannot be reset)
    const allMatches = category.games.flatMap(game => game.matches);
    const matchesToReset = allMatches.filter(match => !match.winnerId);
    
    if (matchesToReset.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No matches to reset. All scheduled matches have concluded.',
        matchesReset: 0
      });
    }

    console.log(`Found ${matchesToReset.length} matches to reset across ${category.games.length} games`);

    // Delete all non-concluded matches
    const deleteResult = await prisma.match.deleteMany({
      where: {
        id: {
          in: matchesToReset.map(match => match.id)
        },
        winnerId: null // Extra safety check
      }
    });

    console.log(`Successfully reset ${deleteResult.count} matches`);

    return NextResponse.json({
      success: true,
      message: `Successfully reset ${deleteResult.count} match(es) across all games in the category`,
      matchesReset: deleteResult.count,
      gamesAffected: category.games.length
    });

  } catch (error) {
    console.error('Error resetting category matches:', error);
    return NextResponse.json(
      { error: 'Failed to reset matches' },
      { status: 500 }
    );
  }
}
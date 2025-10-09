import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';
import { auditLogger } from '@/lib/audit';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAdmin(request);
    const body = await request.json();
    const { name } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Name is required for the copied category' },
        { status: 400 }
      );
    }

    // Get the original category with all its games
    const originalCategory = await prisma.category.findUnique({
      where: { id: params.id },
      include: {
        games: {
          select: {
            name: true,
            weightage: true,
            typeFormat: true,
            contestType: true,
            avgGameTime: true,
            levels: true,
            seedingMethod: true,
            groupSize: true,
            rounds: true,
            allowDraws: true,
            courtsRequiredPerMatch: true,
            minRestMinutes: true,
            backToBackAllowed: true,
            simultaneousGames: true
          }
        }
      }
    });

    if (!originalCategory) {
      return NextResponse.json(
        { error: 'Category not found' },
        { status: 404 }
      );
    }

    // Create the new category
    const newCategory = await prisma.category.create({
      data: {
        name,
        gamesCountMode: originalCategory.gamesCountMode,
        startDate: originalCategory.startDate,
        endDate: originalCategory.endDate,
        dailyWindows: originalCategory.dailyWindows,
        draftEmailTemplate: originalCategory.draftEmailTemplate,
        perPersonCap: originalCategory.perPersonCap,
        locationName: originalCategory.locationName,
        locationMapsLink: originalCategory.locationMapsLink,
        createdBy: user.id,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    // Copy all games from the original category (without registrations)
    const gamePromises = originalCategory.games.map(game => 
      prisma.game.create({
        data: {
          categoryId: newCategory.id,
          name: game.name,
          weightage: game.weightage,
          typeFormat: game.typeFormat,
          contestType: game.contestType,
          avgGameTime: game.avgGameTime,
          levels: game.levels,
          seedingMethod: game.seedingMethod,
          groupSize: game.groupSize,
          rounds: game.rounds,
          allowDraws: game.allowDraws,
          courtsRequiredPerMatch: game.courtsRequiredPerMatch,
          minRestMinutes: game.minRestMinutes,
          backToBackAllowed: game.backToBackAllowed,
          simultaneousGames: game.simultaneousGames,
          createdBy: user.id,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      })
    );

    await Promise.all(gamePromises);

    // Get the complete new category with games
    const completeNewCategory = await prisma.category.findUnique({
      where: { id: newCategory.id },
      include: {
        games: {
          select: {
            id: true,
            name: true,
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
    await auditLogger.log(user.id, 'category.copied', 'category', newCategory.id, {
      originalName: originalCategory.name,
      newName: name,
      gamesCount: originalCategory.games.length
    });

    if (!completeNewCategory) {
      return NextResponse.json(
        { error: 'Failed to retrieve copied category' },
        { status: 500 }
      );
    }

    // Parse JSON strings
    const parsedCategory = {
      ...completeNewCategory,
      status: 'ACTIVE', // New categories are always active
      dailyWindows: JSON.parse(completeNewCategory.dailyWindows || '[]'),
      games: completeNewCategory.games.map((game: any) => ({
        ...game,
        levels: JSON.parse(game.levels || '[]')
      }))
    };

    return NextResponse.json(parsedCategory, { status: 201 });
  } catch (error) {
    console.error('Failed to copy category:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to copy category' },
      { status: error instanceof Error && error.message === 'Authentication required' ? 401 : 500 }
    );
  }
}
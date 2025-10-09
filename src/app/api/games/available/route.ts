import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const games = await prisma.game.findMany({
      where: {
        category: {
          startDate: {
            lte: new Date()
          },
          endDate: {
            gte: new Date()
          }
        }
      },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            perPersonCap: true,
            locationName: true,
            locationMapsLink: true
          }
        },
        _count: {
          select: {
            registrations: true
          }
        }
      },
      orderBy: [
        { category: { name: 'asc' } },
        { name: 'asc' }
      ]
    });

    // Get registration deadlines for all categories using Prisma
    const categoryIds = [...new Set(games.map(game => game.category.id))];
    const categories = await prisma.category.findMany({
      where: {
        id: {
          in: categoryIds
        }
      },
      select: {
        id: true,
        registrationDeadline: true
      }
    });

    // Create a map of category ID to registration deadline
    const deadlineMap = categories.reduce((acc, item) => {
      acc[item.id] = item.registrationDeadline;
      return acc;
    }, {} as Record<string, Date | null>);

    // Add registration deadline to each game's category
    const gamesWithDeadlines = games.map(game => ({
      ...game,
      category: {
        ...game.category,
        registrationDeadline: deadlineMap[game.category.id] || null
      }
    }));

    return NextResponse.json(gamesWithDeadlines);
  } catch (error) {
    console.error('Failed to fetch available games:', error);
    return NextResponse.json(
      { error: 'Failed to fetch games' },
      { status: 500 }
    );
  }
}
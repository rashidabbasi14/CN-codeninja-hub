import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';
import { auditLogger } from '@/lib/audit';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAdmin(request);
    const body = await request.json();
    const { status } = body;

    // Validate status
    const validStatuses = ['ACTIVE', 'COMPLETED', 'ABANDONED', 'ARCHIVED'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status' },
        { status: 400 }
      );
    }

    // Get the current category
    const currentCategory = await prisma.category.findUnique({
      where: { id: params.id },
      select: { name: true }
    });

    if (!currentCategory) {
      return NextResponse.json(
        { error: 'Category not found' },
        { status: 404 }
      );
    }

    // Update the category status using Prisma
    const updatedCategory = await prisma.category.update({
      where: { id: params.id },
      data: {
        status: status,
        updatedAt: new Date()
      },
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
    await auditLogger.log(user.id, 'category.status_changed', 'category', params.id, {
      name: currentCategory.name,
      oldStatus: 'ACTIVE', // Default for now
      newStatus: status
    });

    if (!updatedCategory) {
      return NextResponse.json(
        { error: 'Failed to retrieve updated category' },
        { status: 500 }
      );
    }

    // Parse JSON strings
    const parsedCategory = {
      ...updatedCategory,
      dailyWindows: JSON.parse(updatedCategory.dailyWindows || '[]'),
      games: updatedCategory.games.map((game: any) => ({
        ...game,
        levels: JSON.parse(game.levels || '[]')
      }))
    };

    return NextResponse.json(parsedCategory);
  } catch (error) {
    console.error('Failed to update category status:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update category status' },
      { status: error instanceof Error && error.message === 'Authentication required' ? 401 : 500 }
    );
  }
}
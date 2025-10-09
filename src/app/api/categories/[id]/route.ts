import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin, requireAdminForDelete } from '@/lib/auth';
import { auditLogger } from '@/lib/audit';
import { invalidateCache } from '@/lib/cache';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAdminForDelete(request);
    const categoryId = params.id;

    // Check if category exists
    const category = await prisma.category.findUnique({
      where: { id: categoryId },
      include: {
        games: true
      }
    });

    if (!category) {
      return NextResponse.json(
        { error: 'Category not found' },
        { status: 404 }
      );
    }

    // Delete the category (this will cascade delete games due to foreign key constraints)
    await prisma.category.delete({
      where: { id: categoryId }
    });

    // Log the action
    await auditLogger.log(user.id, 'category.deleted', 'category', categoryId, {
      name: category.name,
      gamesCount: category.games.length
    });

    // Invalidate related cache entries
    invalidateCache('games');
    invalidateCache('events');
    invalidateCache('leaderboard');
    invalidateCache('schedule');
    invalidateCache('results');

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete category:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete category' },
      { status: error instanceof Error && error.message === 'Authentication required' ? 401 : 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAdmin(request);
    const categoryId = params.id;
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

    // Check if category exists
    const existingCategory = await prisma.category.findUnique({
      where: { id: categoryId }
    });

    if (!existingCategory) {
      return NextResponse.json(
        { error: 'Category not found' },
        { status: 404 }
      );
    }

    // Validate dates if provided
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (start > end) {
        return NextResponse.json(
          { error: 'Start date must be before end date' },
          { status: 400 }
        );
      }
    }

    const category = await prisma.category.update({
      where: { id: categoryId },
      data: {
        ...(name && { name }),
        ...(gamesCountMode && { gamesCountMode }),
        ...(startDate && { startDate: new Date(startDate) }),
        ...(endDate && { endDate: new Date(endDate) }),
        ...(dailyWindows && { dailyWindows: JSON.stringify(dailyWindows) }),
        ...(perPersonCap && { perPersonCap: parseInt(perPersonCap) }),
        ...(locationName && { locationName }),
        ...(locationMapsLink !== undefined && { locationMapsLink: locationMapsLink || null }),
        ...(registrationDeadline !== undefined && {
          // registrationDeadline is expected to be an ISO string in UTC from frontend
          registrationDeadline: registrationDeadline ? new Date(registrationDeadline) : null
        }),
        updatedAt: new Date()
      },
      include: {
        games: {
          select: {
            id: true,
            name: true,
            weightage: true,
            typeFormat: true,
            contestType: true
          }
        }
      }
    });

    // Log the action
    await auditLogger.log(user.id, 'category.updated', 'category', categoryId, {
      name: category.name,
      changes: body
    });

    // Invalidate related cache entries
    invalidateCache('games');
    invalidateCache('events');
    invalidateCache('leaderboard');
    invalidateCache('schedule');
    invalidateCache('results');

    return NextResponse.json(category);
  } catch (error) {
    console.error('Failed to update category:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update category' },
      { status: error instanceof Error && error.message === 'Authentication required' ? 401 : 500 }
    );
  }
}
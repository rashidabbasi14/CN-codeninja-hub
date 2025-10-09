import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminOrModerator } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const gameId = params.id;

    // Fetch all slots for the game
    const slots = await prisma.slot.findMany({
      where: { gameId },
      orderBy: {
        startTime: 'asc'
      }
    });

    return NextResponse.json({
      success: true,
      slots
    });
  } catch (error) {
    console.error('Error fetching slots:', error);
    return NextResponse.json(
      { error: 'Failed to fetch slots' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAdminOrModerator(request);
    const gameId = params.id;
    const { searchParams } = new URL(request.url);
    const slotId = searchParams.get('slotId');

    if (!slotId) {
      return NextResponse.json(
        { error: 'slotId parameter is required' },
        { status: 400 }
      );
    }

    // Verify the slot exists and belongs to the game
    const slot = await prisma.slot.findFirst({
      where: {
        id: slotId,
        gameId: gameId
      }
    });

    if (!slot) {
      return NextResponse.json(
        { error: 'Slot not found or does not belong to this game' },
        { status: 404 }
      );
    }

    // Check if the slot has any matches
    const matchCount = await prisma.match.count({
      where: { slotId: slotId }
    });

    if (matchCount > 0) {
      return NextResponse.json(
        { error: 'Cannot delete slot that has matches' },
        { status: 400 }
      );
    }

    // Delete the slot
    await prisma.slot.delete({
      where: { id: slotId }
    });

    console.log(`Deleted unused slot ${slotId} for game ${gameId}`);

    return NextResponse.json({
      success: true,
      message: 'Slot deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting slot:', error);
    
    if (error instanceof Error && error.message === 'Authentication required') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    if (error instanceof Error && error.message === 'Admin or Moderator access required') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    return NextResponse.json(
      { error: 'Failed to delete slot' },
      { status: 500 }
    );
  }
}
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

    const gameId = params.id;

    // Verify the game exists
    const game = await prisma.game.findUnique({
      where: { id: gameId }
    });

    if (!game) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    // Delete all registrations and schedules for this game in a transaction
    await prisma.$transaction(async (tx) => {
      // Delete all registrations for this game
      await tx.registration.deleteMany({
        where: { gameId }
      });

      // Delete all matches for this game
      await tx.match.deleteMany({
        where: { gameId }
      });

      // Delete all teams for this game
      await tx.team.deleteMany({
        where: { gameId }
      });

      // Delete all slots for this game
      await tx.slot.deleteMany({
        where: { gameId }
      });
    });

    return NextResponse.json({ 
      message: 'Game reset successfully',
      gameId 
    });

  } catch (error) {
    console.error('Error resetting game:', error);
    return NextResponse.json(
      { error: 'Failed to reset game' },
      { status: 500 }
    );
  }
}
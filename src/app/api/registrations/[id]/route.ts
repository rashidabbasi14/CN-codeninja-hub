import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth(request);

    const registrationId = params.id;

    // Find the registration
    const registration = await prisma.registration.findUnique({
      where: { id: registrationId },
      include: {
        game: true
      }
    });

    if (!registration) {
      return NextResponse.json({ error: 'Registration not found' }, { status: 404 });
    }

    // Check if user owns this registration
    if (registration.userId !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // If this is a team registration, we need to handle the entire team
    if (registration.mode === 'team' && registration.teamId) {
      // Delete all registrations for this team
      await prisma.registration.deleteMany({
        where: {
          teamId: registration.teamId
        }
      });

      // Delete the team
      await prisma.team.delete({
        where: {
          id: registration.teamId
        }
      });
    } else {
      // Individual registration - just delete this registration
      await prisma.registration.delete({
        where: {
          id: registrationId
        }
      });
    }

    // Log the unregistration
    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: 'UNREGISTER_GAME',
        entity: 'Game',
        entityId: registration.gameId,
        payload: JSON.stringify({
          registrationId,
          mode: registration.mode,
          teamId: registration.teamId
        })
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to unregister from game:', error);
    
    if (error instanceof Error && error.message === 'Authentication required') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    
    return NextResponse.json(
      { error: 'Unregistration failed' },
      { status: 500 }
    );
  }
}
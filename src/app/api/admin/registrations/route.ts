import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin, requireAdminOrModerator } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const user = await requireAdminOrModerator(request);
    
    const { gameId, userIds, level, mode } = await request.json();

    if (!gameId || !userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json({ error: 'Invalid request data' }, { status: 400 });
    }

    // Verify the game exists
    const game = await prisma.game.findUnique({
      where: { id: gameId },
      select: { id: true, name: true, typeFormat: true }
    });

    if (!game) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    const registeredUsers = [];
    const errors = [];

    // Register each user
    for (const userId of userIds) {
      try {
        // Check if user exists
        const userExists = await prisma.user.findUnique({
          where: { id: userId },
          select: { id: true, firstName: true, lastName: true, email: true }
        });

        if (!userExists) {
          errors.push(`User ${userId} not found`);
          continue;
        }

        // Check if user is already registered for this game
        const existingRegistration = await prisma.registration.findFirst({
          where: {
            userId,
            gameId
          }
        });

        if (existingRegistration) {
          errors.push(`${userExists.firstName} ${userExists.lastName} is already registered for this game`);
          continue;
        }

        // Create registration
        await prisma.registration.create({
          data: {
            userId,
            gameId,
            level: level || 'Beginner',
            mode: mode || 'INDIVIDUAL',
            teamId: null,
            allowAutoAssign: true
          }
        });

        registeredUsers.push(userExists);
      } catch (error) {
        console.error(`Error registering user ${userId}:`, error);
        errors.push(`Failed to register user ${userId}`);
      }
    }

    const response: any = {
      message: `Successfully registered ${registeredUsers.length} player(s)`,
      registeredUsers,
      registeredCount: registeredUsers.length
    };

    if (errors.length > 0) {
      response.errors = errors;
      response.errorCount = errors.length;
    }

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error in admin registration:', error);
    return NextResponse.json(
      { error: 'Failed to register players' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAdminOrModerator(request);
    
    const { registrationId } = await request.json();

    if (!registrationId) {
      return NextResponse.json({ error: 'Registration ID is required' }, { status: 400 });
    }

    // Find the registration
    const registration = await prisma.registration.findUnique({
      where: { id: registrationId },
      include: {
        game: true,
        user: true
      }
    });

    if (!registration) {
      return NextResponse.json({ error: 'Registration not found' }, { status: 404 });
    }

    // If this is a team registration, we need to handle the entire team
    if (registration.mode === 'TEAM' && registration.teamId) {
      // Check if this user is the team leader
      const team = await prisma.team.findUnique({
        where: { id: registration.teamId },
        include: {
          members: true,
          registrations: true
        }
      });

      if (team && team.teamLead === registration.userId) {
        // If removing team leader, delete the entire team
        await prisma.registration.deleteMany({
          where: { teamId: registration.teamId }
        });
        
        await prisma.teamMember.deleteMany({
          where: { teamId: registration.teamId }
        });
        
        await prisma.team.delete({
          where: { id: registration.teamId }
        });
      } else {
        // If removing a team member, just remove them from the team
        await prisma.teamMember.deleteMany({
          where: {
            teamId: registration.teamId,
            userId: registration.userId
          }
        });
        
        await prisma.registration.delete({
          where: { id: registrationId }
        });
      }
    } else {
      // Individual registration - just delete this registration
      await prisma.registration.delete({
        where: { id: registrationId }
      });
    }

    return NextResponse.json({
      message: 'Registration removed successfully',
      removedUser: `${registration.user.firstName} ${registration.user.lastName}`
    });

  } catch (error) {
    console.error('Error in admin registration deletion:', error);
    return NextResponse.json(
      { error: 'Failed to remove registration' },
      { status: 500 }
    );
  }
}
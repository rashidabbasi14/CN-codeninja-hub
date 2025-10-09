import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { emailService } from '@/lib/email';
import { generateTeamJoinNotificationEmail } from '@/app/email-templates';
import { auditLogger, createAuditContext } from '@/lib/audit';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const teamId = params.id;

    // Get the team with its game and current members
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: {
        id: true,
        name: true,
        teamLead: true,
        openTeam: true,
        game: {
          select: {
            id: true,
            name: true,
            typeFormat: true
          }
        },
        members: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
                age: true,
                gender: true
              }
            }
          }
        }
      }
    });

    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    // Check if team is open for joining
    if (!team.openTeam) {
      return NextResponse.json({ error: 'This team is not open for individual players to join' }, { status: 400 });
    }

    // Check if user is already a member of this team
    const isAlreadyMember = team.members.some(member => member.user.id === user.id);
    if (isAlreadyMember) {
      return NextResponse.json({ error: 'You are already a member of this team' }, { status: 400 });
    }

    // Check if user is already registered for this game
    const existingRegistration = await prisma.registration.findFirst({
      where: {
        userId: user.id,
        gameId: team.game.id
      }
    });

    if (existingRegistration) {
      return NextResponse.json({ error: 'You are already registered for this game' }, { status: 400 });
    }

    // Get required team size from game format
    const requiredTeamSize = parseInt(team.game.typeFormat.split('v')[0]);
    
    // Check if team is full
    if (team.members.length >= requiredTeamSize) {
      return NextResponse.json({ error: 'This team is already full' }, { status: 400 });
    }

    // Add user to team and create registration
    await prisma.$transaction(async (tx) => {
      // Add user as team member
      await tx.teamMember.create({
        data: {
          teamId: teamId,
          userId: user.id
        }
      });

      // Create registration for the user
      await tx.registration.create({
        data: {
          userId: user.id,
          gameId: team.game.id,
          level: 'Beginner', // Default level, could be made configurable
          mode: 'TEAM',
          teamId: teamId,
          allowAutoAssign: false
        }
      });
    });

    // Send email notification to team leader
    try {
      // Get team leader information
      const teamLeader = await prisma.user.findUnique({
        where: { id: team.teamLead },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true
        }
      });

      if (teamLeader) {
        const playerName = user.firstName && user.lastName
          ? `${user.firstName} ${user.lastName}`
          : user.firstName || user.email;
        
        const teamLeaderName = teamLeader.firstName && teamLeader.lastName
          ? `${teamLeader.firstName} ${teamLeader.lastName}`
          : teamLeader.firstName || teamLeader.email;

        const emailHtml = generateTeamJoinNotificationEmail({
          teamLeaderName,
          teamName: team.name,
          gameName: team.game.name,
          playerName,
          playerEmail: user.email,
          playerPhone: user.phone || undefined,
          playerAge: user.age || undefined,
          playerGender: user.gender || undefined
        });

        await emailService.sendEmail(
          teamLeader.email,
          `New Player Joined Your Team "${team.name}"`,
          emailHtml,
          {},
          'system'
        );
      }
    } catch (emailError) {
      // Log email error but don't fail the request
      console.error('Failed to send team join notification email:', emailError);
    }

    // Log the team join activity
    try {
      await auditLogger.log(
        user.id,
        'team.joined',
        'team',
        teamId,
        {
          teamName: team.name,
          gameName: team.game.name,
          gameId: team.game.id,
          teamLeadId: team.teamLead,
          currentTeamSize: team.members.length + 1, // +1 for the user who just joined
          maxTeamSize: parseInt(team.game.typeFormat.split('v')[0]),
          timestamp: new Date().toISOString()
        },
        createAuditContext(request)
      );
    } catch (auditError) {
      // Don't fail the request if audit logging fails
      console.error('Failed to log team join activity:', auditError);
    }

    return NextResponse.json({
      message: 'Successfully joined the team!',
      teamName: team.name
    });

  } catch (error) {
    console.error('Error joining team:', error);
    return NextResponse.json(
      { error: 'Failed to join team' },
      { status: 500 }
    );
  }
}
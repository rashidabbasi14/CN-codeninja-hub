import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser, requireAdminOrModerator } from '@/lib/auth';
import { auditLogger } from '@/lib/audit';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAdminOrModerator(request);

    const gameId = params.id;

    // Get game details
    const game = await prisma.game.findUnique({
      where: { id: gameId },
      select: {
        id: true,
        name: true,
        typeFormat: true,
        contestType: true
      }
    });

    if (!game) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    // Get all teams for this game
    const teams = await prisma.team.findMany({
      where: { gameId },
      include: {
        leader: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatarUrl: true
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
                avatarUrl: true
              }
            }
          }
        },
        registrations: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                avatarUrl: true
              }
            }
          }
        }
      }
    });

    // Get individual registrations (users not in teams)
    const individualRegistrations = await prisma.registration.findMany({
      where: {
        gameId,
        teamId: null
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatarUrl: true
          }
        }
      }
    });

    // Get all users who could potentially be added to teams
    const allUsers = await prisma.user.findMany({
      where: {
        isBlocked: false,
        NOT: {
          registrations: {
            some: {
              gameId
            }
          }
        }
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        avatarUrl: true
      }
    });

    return NextResponse.json({
      game,
      teams,
      individualRegistrations,
      availableUsers: allUsers
    });

  } catch (error) {
    console.error('Error fetching team data:', error);
    
    if (error instanceof Error && error.message === 'Authentication required') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    if (error instanceof Error && error.message === 'Admin or Moderator access required') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch team data' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAdminOrModerator(request);

    const gameId = params.id;
    const { action, teamName, teamLeadId, memberIds, openTeam } = await request.json();

    if (action === 'CREATE_TEAM') {
      // Check if team name already exists for this game
      if (teamName && teamName.trim()) {
        const existingTeam = await prisma.team.findFirst({
          where: {
            gameId: gameId,
            name: {
              equals: teamName.trim(),
              mode: 'insensitive' // Case-insensitive comparison
            }
          }
        });
        
        if (existingTeam) {
          return NextResponse.json({
            error: `Team name "${teamName}" already exists for this game. Please choose a different name.`
          }, { status: 400 });
        }
      }
      
      // Create new team
      const team = await prisma.team.create({
        data: {
          gameId,
          name: teamName,
          teamLead: teamLeadId,
          openTeam: openTeam || false
        }
      });

      // Add team leader as member
      await prisma.teamMember.create({
        data: {
          teamId: team.id,
          userId: teamLeadId
        }
      });

      // Create registration for team leader if not exists
      const existingRegistration = await prisma.registration.findFirst({
        where: {
          userId: teamLeadId,
          gameId
        }
      });

      if (!existingRegistration) {
        await prisma.registration.create({
          data: {
            userId: teamLeadId,
            gameId,
            level: 'Beginner', // Default level
            mode: 'TEAM',
            teamId: team.id,
            allowAutoAssign: false
          }
        });
      } else {
        // Update existing registration to be part of team
        await prisma.registration.update({
          where: { id: existingRegistration.id },
          data: {
            teamId: team.id,
            mode: 'TEAM'
          }
        });
      }

      // Add other members
      if (memberIds && memberIds.length > 0) {
        for (const memberId of memberIds) {
          // Check if user is already in a team for this game
          const existingMembership = await prisma.teamMember.findFirst({
            where: {
              userId: memberId,
              team: { gameId }
            }
          });

          if (!existingMembership) {
            await prisma.teamMember.create({
              data: {
                teamId: team.id,
                userId: memberId
              }
            });
          }

          // Create or update registration for member
          const existingMemberRegistration = await prisma.registration.findFirst({
            where: {
              userId: memberId,
              gameId
            }
          });

          if (!existingMemberRegistration) {
            await prisma.registration.create({
              data: {
                userId: memberId,
                gameId,
                level: 'Beginner', // Default level
                mode: 'TEAM',
                teamId: team.id,
                allowAutoAssign: false
              }
            });
          } else {
            await prisma.registration.update({
              where: { id: existingMemberRegistration.id },
              data: {
                teamId: team.id,
                mode: 'TEAM'
              }
            });
          }
        }
      }

      return NextResponse.json({ message: 'Team created successfully' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('Error managing teams:', error);
    
    if (error instanceof Error && error.message === 'Authentication required') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    if (error instanceof Error && error.message === 'Admin or Moderator access required') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json(
      { error: 'Failed to manage teams' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAdminOrModerator(request);

    const gameId = params.id;
    const requestBody = await request.json();
    
    const { action, teamId, userIds, level, mode, name } = requestBody as {
      action: string;
      teamId?: string;
      userIds?: string[];
      level?: string;
      mode?: string;
      name?: string;
    };
    if (action === 'ADD_MEMBERS') {
      if (!teamId) {
        return NextResponse.json({ error: 'Team ID is required' }, { status: 400 });
      }

      if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
        return NextResponse.json({ error: 'User IDs are required' }, { status: 400 });
      }

      // First, check if the team is already full
      const team = await prisma.team.findUnique({
        where: { id: teamId },
        include: {
          members: true,
          game: {
            select: {
              name: true,
              typeFormat: true,
              category: {
                select: {
                  id: true,
                  perPersonCap: true,
                  gamesCountMode: true
                }
              }
            }
          }
        }
      });

      if (!team) {
        return NextResponse.json({ error: 'Team not found' }, { status: 404 });
      }

      // Extract required team size from typeFormat (e.g., "5v5" -> 5)
      const requiredSize = team.game.typeFormat ? parseInt(team.game.typeFormat.split('v')[0]) : 0;
      const currentSize = team.members.length;
      
      // Check if adding these users would exceed the team size limit
      if (currentSize + userIds.length > requiredSize) {
        return NextResponse.json({
          error: `Cannot add ${userIds.length} member(s). Team is limited to ${requiredSize} members and currently has ${currentSize} member(s).`
        }, { status: 400 });
      }

      // Check participation limits for each user
      const category = team.game.category;
      if (category.perPersonCap && category.perPersonCap !== 2147483647) {
        const participationErrors = [];
        
        for (const userId of userIds) {
          // Check if user is already registered for this specific game
          const existingRegistrationForThisGame = await prisma.registration.findFirst({
            where: {
              userId,
              gameId
            }
          });

          // If user is already registered for this game, we're just converting them to team mode
          // So we don't need to check participation limits
          if (!existingRegistrationForThisGame) {
            // Count user's current registrations in this category (excluding current game)
            const currentParticipationCount = await prisma.registration.count({
              where: {
                userId,
                game: {
                  categoryId: category.id,
                  id: { not: gameId } // Exclude current game
                }
              }
            });

            // Check if adding this user would exceed the participation limit
            if (currentParticipationCount >= category.perPersonCap) {
              const user = await prisma.user.findUnique({
                where: { id: userId },
                select: { firstName: true, lastName: true, email: true }
              });
              
              const userName = user ?
                (user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.email) :
                'Unknown User';
              
              participationErrors.push(
                `${userName} has already reached the participation limit of ${category.perPersonCap} games in this category.`
              );
            }
          }
        }

        if (participationErrors.length > 0) {
          return NextResponse.json({
            error: participationErrors.join('; ')
          }, { status: 400 });
        }
      }

      // Add users to existing team
      for (const userId of userIds) {
        // Check if user is already in a team for this game
        const existingMembership = await prisma.teamMember.findFirst({
          where: {
            userId,
            team: { gameId }
          }
        });

        if (!existingMembership) {
          await prisma.teamMember.create({
            data: {
              teamId,
              userId
            }
          });

          // Create or update registration
          const existingRegistration = await prisma.registration.findFirst({
            where: {
              userId,
              gameId
            }
          });

          if (!existingRegistration) {
            await prisma.registration.create({
              data: {
                userId,
                gameId,
                level: 'Beginner',
                mode: 'TEAM',
                teamId,
                allowAutoAssign: false
              }
            });
          } else {
            await prisma.registration.update({
              where: { id: existingRegistration.id },
              data: {
                teamId,
                mode: 'TEAM'
              }
            });
          }
        }
      }

      // Log the team member addition
      await auditLogger.log(
        user.id,
        'team.members_added',
        'team',
        teamId,
        {
          teamName: team.name,
          gameName: team.game.name || 'Unknown Game',
          memberCount: userIds.length,
          addedUserIds: userIds
        },
        {
          ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
          userAgent: request.headers.get('user-agent') || 'unknown'
        }
      );

      return NextResponse.json({ message: 'Members added successfully' });
    }

    if (action === 'REGISTER_PLAYERS') {
      if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
        return NextResponse.json({ error: 'User IDs are required' }, { status: 400 });
      }

      // Register individual players directly
      for (const userId of userIds) {
        // Check if user is already registered for this game
        const existingRegistration = await prisma.registration.findFirst({
          where: {
            userId,
            gameId
          }
        });

        if (!existingRegistration) {
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
        }
      }

      return NextResponse.json({ message: 'Players registered successfully' });
    }

    if (action === 'REMOVE_MEMBERS') {
      if (!teamId) {
        return NextResponse.json({ error: 'Team ID is required' }, { status: 400 });
      }

      if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
        return NextResponse.json({ error: 'User IDs are required' }, { status: 400 });
      }

      // Remove users from team
      for (const userId of userIds) {
        // Get the team to check if user is the team leader
        const team = await prisma.team.findUnique({
          where: { id: teamId },
          select: { teamLead: true }
        });

        if (team && team.teamLead === userId) {
          return NextResponse.json(
            { error: 'Cannot remove team leader from team' },
            { status: 400 }
          );
        }

        // Remove team membership
        await prisma.teamMember.deleteMany({
          where: {
            teamId,
            userId
          }
        });

        // Update registration to individual mode
        const registration = await prisma.registration.findFirst({
          where: {
            userId,
            gameId
          }
        });

        if (registration) {
          await prisma.registration.update({
            where: { id: registration.id },
            data: {
              teamId: null,
              mode: 'INDIVIDUAL'
            }
          });
        }
      }

      return NextResponse.json({ message: 'Members removed successfully' });
    }

    if (action === 'UPDATE_TEAM_NAME') {
      if (!teamId) {
        return NextResponse.json({ error: 'Team ID is required' }, { status: 400 });
      }

      if (!name || typeof name !== 'string' || name.trim() === '') {
        return NextResponse.json({ error: 'Team name is required' }, { status: 400 });
      }

      const trimmedName = name.trim();

      // Check if team exists
      const existingTeam = await prisma.team.findUnique({
        where: { id: teamId },
        include: {
          game: {
            select: {
              id: true,
              name: true
            }
          }
        }
      });

      if (!existingTeam) {
        return NextResponse.json({ error: 'Team not found' }, { status: 404 });
      }

      // Check if the new name conflicts with another team in the same game
      const conflictingTeam = await prisma.team.findFirst({
        where: {
          gameId: existingTeam.game.id,
          name: {
            equals: trimmedName,
            mode: 'insensitive'
          },
          id: {
            not: teamId // Exclude the current team
          }
        }
      });

      if (conflictingTeam) {
        return NextResponse.json({
          error: `Team name "${trimmedName}" already exists for this game. Please choose a different name.`
        }, { status: 400 });
      }

      // Update the team name
      const updatedTeam = await prisma.team.update({
        where: { id: teamId },
        data: { name: trimmedName }
      });

      // Log the team name update
      await auditLogger.log(
        user.id,
        'settings.updated',
        'team',
        teamId,
        {
          oldName: existingTeam.name,
          newName: trimmedName,
          gameName: existingTeam.game.name || 'Unknown Game',
          action: 'team_name_updated'
        },
        {
          ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
          userAgent: request.headers.get('user-agent') || 'unknown'
        }
      );

      return NextResponse.json({
        message: 'Team name updated successfully',
        team: updatedTeam
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('Error updating teams:', error);
    
    if (error instanceof Error && error.message === 'Authentication required') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    if (error instanceof Error && error.message === 'Admin or Moderator access required') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json(
      { error: 'Failed to update teams' },
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
    const { action, teamId } = await request.json();

    if (action === 'DELETE_TEAM') {
      // First, get the team to ensure it exists and belongs to this game
      const team = await prisma.team.findFirst({
        where: {
          id: teamId,
          gameId
        },
        include: {
          members: true,
          registrations: true
        }
      });

      if (!team) {
        return NextResponse.json({ error: 'Team not found' }, { status: 404 });
      }

      // Start a transaction to ensure all operations succeed or fail together
      await prisma.$transaction(async (tx) => {
        // 1. Delete all scheduled matches for this team
        await tx.match.deleteMany({
          where: {
            OR: [
              {
                participantAId: teamId,
                participantAType: 'TEAM'
              },
              {
                participantBId: teamId,
                participantBType: 'TEAM'
              }
            ]
          }
        });

        // 2. Update all registrations to individual mode (remove team association)
        await tx.registration.updateMany({
          where: { teamId },
          data: {
            teamId: null,
            mode: 'INDIVIDUAL'
          }
        });

        // 3. Delete all team memberships
        await tx.teamMember.deleteMany({
          where: { teamId }
        });

        // 4. Finally, delete the team itself
        await tx.team.delete({
          where: { id: teamId }
        });
      });

      return NextResponse.json({
        message: 'Team deleted successfully. All members have been converted to individual registrations.'
      });
    }

    console.log('Checking UPDATE_TEAM_NAME action, action value:', action, 'comparison result:', action === 'UPDATE_TEAM_NAME');
    
    if (action === 'UPDATE_TEAM_NAME') {
      if (!teamId) {
        return NextResponse.json({ error: 'Team ID is required' }, { status: 400 });
      }
      
      if (name === undefined || name === null) {
        return NextResponse.json({ error: 'Team name is required' }, { status: 400 });
      }

      if (typeof name !== 'string') {
        return NextResponse.json({ error: 'Team name must be a string' }, { status: 400 });
      }

      const teamName = name as string;
      
      if (!teamName.trim()) {
        return NextResponse.json({ error: 'Team name cannot be empty' }, { status: 400 });
      }

      // Check if team exists and belongs to this game
      const existingTeam = await prisma.team.findFirst({
        where: {
          id: teamId,
          gameId: gameId
        }
      });

      if (!existingTeam) {
        return NextResponse.json({ error: 'Team not found' }, { status: 404 });
      }

      // Check if another team with the same name already exists for this game
      const duplicateTeam = await prisma.team.findFirst({
        where: {
          gameId: gameId,
          name: teamName.trim(),
          id: { not: teamId } // Exclude the current team
        }
      });

      if (duplicateTeam) {
        return NextResponse.json({ error: 'A team with this name already exists for this game' }, { status: 400 });
      }

      // Update the team name
      const updatedTeam = await prisma.team.update({
        where: { id: teamId },
        data: { name: teamName.trim() }
      });

      // Log the action
      await auditLogger.log(
        user.id,
        'team.members_added',
        'team',
        teamId,
        {
          gameId,
          oldName: existingTeam.name,
          newName: teamName.trim(),
          action: 'name_updated'
        }
      );

      return NextResponse.json({
        message: 'Team name updated successfully',
        team: updatedTeam
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('Error deleting team:', error);
    
    if (error instanceof Error && error.message === 'Authentication required') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    if (error instanceof Error && error.message === 'Admin or Moderator access required') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json(
      { error: 'Failed to delete team' },
      { status: 500 }
    );
  }
}
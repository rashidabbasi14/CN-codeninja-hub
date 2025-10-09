import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { auditLogger, createAuditContext } from '@/lib/audit';

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { registrations, eventId } = await request.json();

    if (!registrations || !Array.isArray(registrations) || !eventId) {
      return NextResponse.json({ error: 'Invalid request data' }, { status: 400 });
    }

    // Verify the event exists and get participant cap and registration deadline
    const event = await prisma.category.findUnique({
      where: { id: eventId },
      select: { perPersonCap: true, registrationDeadline: true }
    });

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    // Check registration deadline
    if (event.registrationDeadline && new Date(event.registrationDeadline).getTime() <= new Date().getTime()) {
      return NextResponse.json({ error: 'Registration deadline has passed' }, { status: 400 });
    }

    // Check if user is trying to register for more games than allowed
    if (event.perPersonCap && registrations.length > event.perPersonCap) {
      return NextResponse.json({
        error: `Cannot register for more than ${event.perPersonCap} games`
      }, { status: 400 });
    }

    // Check participation limits for the current user and any team members
    if (event.perPersonCap && event.perPersonCap !== 2147483647) {
      // Get all unique user IDs that will be registered (current user + team members)
      const allUserIds = new Set([user.id]);
      
      for (const reg of registrations) {
        if (reg.mode === 'TEAM' && reg.teamMembers && reg.teamMembers.length > 0) {
          reg.teamMembers.forEach((memberId: string) => allUserIds.add(memberId));
        }
      }

      // Check participation limits for each user
      const participationErrors = [];
      
      for (const userId of allUserIds) {
        // Count user's current registrations in this category
        const currentParticipationCount = await prisma.registration.count({
          where: {
            userId,
            game: {
              categoryId: eventId
            }
          }
        });

        // Check if adding new registrations would exceed the participation limit
        const newRegistrationsForUser = registrations.filter(reg => {
          if (userId === user.id) return true; // Current user is in all registrations
          return reg.mode === 'TEAM' && reg.teamMembers && reg.teamMembers.includes(userId);
        }).length;

        if (currentParticipationCount + newRegistrationsForUser > event.perPersonCap) {
          const userInfo = await prisma.user.findUnique({
            where: { id: userId },
            select: { firstName: true, lastName: true, email: true }
          });
          
          const userName = userInfo ?
            (userInfo.firstName && userInfo.lastName ? `${userInfo.firstName} ${userInfo.lastName}` : userInfo.email) :
            'Unknown User';
          participationErrors.push(
            `${userName} has already reached the participation limit of ${event.perPersonCap} games in this category (currently registered for ${currentParticipationCount} games).`
          );
        }
      }

      if (participationErrors.length > 0) {
        return NextResponse.json({
          error: participationErrors.join('; ')
        }, { status: 400 });
      }
    }

    // Get all game IDs for validation
    const gameNames = registrations.map(reg => reg.gameName);
    const games = await prisma.game.findMany({
      where: { name: { in: gameNames } },
      select: { id: true, name: true }
    });

    if (games.length !== gameNames.length) {
      return NextResponse.json({ error: 'One or more games not found' }, { status: 404 });
    }

    // Create a map of game names to IDs
    const gameNameToId = games.reduce((acc, game) => {
      acc[game.name] = game.id;
      return acc;
    }, {} as Record<string, string>);

    // Check for existing registrations
    const existingRegistrations = await prisma.registration.findMany({
      where: {
        userId: user.id,
        gameId: { in: games.map(g => g.id) }
      }
    });

    if (existingRegistrations.length > 0) {
      const existingGameNames = existingRegistrations.map(reg => {
        const game = games.find(g => g.id === reg.gameId);
        return game?.name;
      }).filter(Boolean);
      
      return NextResponse.json({
        error: `Already registered for: ${existingGameNames.join(', ')}`
      }, { status: 400 });
    }

    // Create registrations with team handling
    const createdRegistrations = [];
    
    for (const reg of registrations) {
      let teamId = null;
      
      // If it's a team registration, create the team and team members
      if (reg.mode === 'TEAM' && reg.teamMembers && reg.teamMembers.length > 0) {
        const gameId = gameNameToId[reg.gameName];
        
        // Check if any team members are already in teams for this game
        // Allow individual registrations to be converted to team registrations
        const allMemberIds = [user.id, ...reg.teamMembers];
        
        // Only check for existing team memberships (not individual registrations)
        const existingTeamMemberships = await prisma.teamMember.findMany({
          where: {
            userId: { in: allMemberIds },
            team: { gameId: gameId }
          },
          include: {
            user: { select: { firstName: true, lastName: true, email: true } },
            team: true
          }
        });
        
        if (existingTeamMemberships.length > 0) {
          // Collect conflicting users (only those already in teams)
          const conflictUsers = existingTeamMemberships.map(tm => ({
            id: tm.userId,
            name: tm.user.firstName && tm.user.lastName ? `${tm.user.firstName} ${tm.user.lastName}` : tm.user.email
          }));
          
          // Remove duplicates based on user ID
          const uniqueConflictUsers = conflictUsers.filter((user, index, self) =>
            index === self.findIndex(u => u.id === user.id)
          );
          
          return NextResponse.json({
            error: `The following users are already in teams for ${reg.gameName}: ${uniqueConflictUsers.map(u => u.name).join(', ')}`
          }, { status: 400 });
        }
        
        // Get existing individual registrations that will be converted to team registrations
        const existingIndividualRegistrations = await prisma.registration.findMany({
          where: {
            gameId: gameId,
            userId: { in: allMemberIds },
            teamId: null // Only individual registrations
          }
        });
        
        // Check if team name already exists for this game
        if (reg.teamName && reg.teamName.trim()) {
          const existingTeam = await prisma.team.findFirst({
            where: {
              gameId: gameId,
              name: {
                equals: reg.teamName.trim(),
                mode: 'insensitive' // Case-insensitive comparison
              }
            }
          });
          
          if (existingTeam) {
            return NextResponse.json({
              error: `Team name "${reg.teamName}" already exists for ${reg.gameName}. Please choose a different name.`
            }, { status: 400 });
          }
        }
        
        // Delete existing individual registrations for users who will join the team
        if (existingIndividualRegistrations.length > 0) {
          await prisma.registration.deleteMany({
            where: {
              id: { in: existingIndividualRegistrations.map(r => r.id) }
            }
          });
        }
        
        // Create the team with team lead
        const team = await prisma.team.create({
          data: {
            gameId: gameId,
            name: reg.teamName || `${user.firstName || user.email}'s Team`,
            teamLead: user.id,
            openTeam: reg.openTeam || false
          }
        });
        
        teamId = team.id;
        
        // Add current user as team member (team lead is also a member)
        await prisma.teamMember.create({
          data: {
            teamId: team.id,
            userId: user.id
          }
        });
        
        // Add other team members and create registrations for them
        // Filter out current user to avoid duplication (they're handled separately)
        const otherMemberIds = reg.teamMembers.filter((id: string) => id !== user.id);
        for (const memberId of otherMemberIds) {
          await prisma.teamMember.create({
            data: {
              teamId: team.id,
              userId: memberId
            }
          });
          
          // Create registration for each team member
          await prisma.registration.create({
            data: {
              userId: memberId,
              gameId: gameId,
              level: reg.level,
              mode: reg.mode,
              teamId: team.id,
              allowAutoAssign: false
            }
          });
        }
      }
      
      // Create the registration for the team lead/individual player
      const registration = await prisma.registration.create({
        data: {
          userId: user.id,
          gameId: gameNameToId[reg.gameName],
          level: reg.level,
          mode: reg.mode,
          teamId: teamId,
          allowAutoAssign: true
        }
      });
      
      createdRegistrations.push(registration);
    }

    // Log the registration activity
    try {
      for (const reg of registrations) {
        await auditLogger.log(
          user.id,
          'game.registered',
          'registration',
          gameNameToId[reg.gameName],
          {
            gameName: reg.gameName,
            level: reg.level,
            mode: reg.mode,
            teamName: reg.teamName || null,
            teamMembersCount: reg.teamMembers?.length || 0,
            openTeam: reg.openTeam || false,
            eventId: eventId,
            timestamp: new Date().toISOString()
          },
          createAuditContext(request)
        );

        // If it's a team registration, also log team creation
        if (reg.mode === 'TEAM' && reg.teamName) {
          await auditLogger.log(
            user.id,
            'team.created',
            'team',
            gameNameToId[reg.gameName],
            {
              teamName: reg.teamName,
              gameName: reg.gameName,
              teamMembersCount: (reg.teamMembers?.length || 0) + 1, // +1 for team lead
              openTeam: reg.openTeam || false,
              timestamp: new Date().toISOString()
            },
            createAuditContext(request)
          );
        }
      }
    } catch (auditError) {
      // Don't fail the request if audit logging fails
      console.error('Failed to log registration activity:', auditError);
    }

    return NextResponse.json({
      message: 'Successfully registered for games',
      count: createdRegistrations.length
    });

  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json({
      error: 'Failed to register for games'
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const gameName = searchParams.get('gameName');

    if (!gameName) {
      return NextResponse.json({ error: 'Game name is required' }, { status: 400 });
    }

    // Find the game by name
    const game = await prisma.game.findFirst({
      where: { name: gameName },
      select: { id: true }
    });

    if (!game) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    // Find and delete the registration
    const registration = await prisma.registration.findFirst({
      where: {
        userId: user.id,
        gameId: game.id
      },
      include: {
        team: {
          include: {
            members: true
          }
        }
      }
    });

    if (!registration) {
      return NextResponse.json({ error: 'Registration not found' }, { status: 404 });
    }

    // If this is a team registration and user is the team lead, clean up the entire team
    if (registration.teamId && registration.team) {
      const team = registration.team;
      
      // Check if user is the team leader
      if (team.teamLead === user.id) {
        // Delete all team member registrations
        await prisma.registration.deleteMany({
          where: {
            teamId: team.id
          }
        });
        
        // Delete all team memberships
        await prisma.teamMember.deleteMany({
          where: {
            teamId: team.id
          }
        });
        
        // Delete the team
        await prisma.team.delete({
          where: {
            id: team.id
          }
        });
      } else {
        // If user is just a team member, only remove their registration and membership
        await prisma.registration.delete({
          where: { id: registration.id }
        });
        
        await prisma.teamMember.deleteMany({
          where: {
            teamId: team.id,
            userId: user.id
          }
        });
      }
    } else {
      // Individual registration, just delete it
      await prisma.registration.delete({
        where: { id: registration.id }
      });
    }

    // Log the unregistration activity
    try {
      await auditLogger.log(
        user.id,
        'game.unregistered',
        'registration',
        game.id,
        {
          gameName: gameName,
          wasTeamLead: registration.teamId && registration.team?.teamLead === user.id,
          teamName: registration.team?.name || null,
          timestamp: new Date().toISOString()
        },
        createAuditContext(request)
      );
    } catch (auditError) {
      // Don't fail the request if audit logging fails
      console.error('Failed to log unregistration activity:', auditError);
    }

    return NextResponse.json({
      message: 'Successfully unregistered from game'
    });

  } catch (error) {
    console.error('Unregistration error:', error);
    return NextResponse.json({
      error: 'Failed to unregister from game'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const registrations = await prisma.registration.findMany({
      where: { userId: user.id },
      include: {
        game: {
          select: {
            name: true,
            typeFormat: true,
            levels: true
          }
        },
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    });

    // For team registrations, get team member information
    const transformedRegistrations = await Promise.all(
      registrations.map(async (reg) => {
        let teamMembers: { id: string; name: string; email: string; }[] = [];
        let isTeamLead = false;
        let teamName: string | undefined = undefined;
        let openTeam = false;
        
        if (reg.mode === 'TEAM' && reg.teamId) {
          // Get team information
          const team = await prisma.team.findUnique({
            where: { id: reg.teamId },
            select: {
              name: true,
              teamLead: true,
              openTeam: true,
              members: {
                include: {
                  user: {
                    select: {
                      id: true,
                      firstName: true,
                      lastName: true,
                      email: true
                    }
                  }
                }
              }
            }
          });
          
          if (team) {
            isTeamLead = team.teamLead === user.id;
            teamName = team.name;
            openTeam = team.openTeam;
            teamMembers = team.members
              .filter(member => member.userId !== user.id) // Exclude current user
              .map(member => ({
                id: member.user.id,
                name: member.user.firstName ? `${member.user.firstName} ${member.user.lastName || ''}`.trim() : member.user.email,
                email: member.user.email,
                isTeamLead: member.userId === team.teamLead
              }));
          }
        }
        
        return {
          ...reg,
          teamMembers,
          isTeamLead,
          teamName,
          openTeam
        };
      })
    );

    return NextResponse.json(transformedRegistrations);

  } catch (error) {
    console.error('Get registrations error:', error);
    return NextResponse.json({
      error: 'Failed to fetch registrations'
    }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { registrations, eventId } = await request.json();

    if (!registrations || !Array.isArray(registrations) || !eventId || registrations.length !== 1) {
      return NextResponse.json({ error: 'Invalid request data. PUT only supports updating one registration at a time.' }, { status: 400 });
    }

    const registration = registrations[0];

    // Verify the event exists and get participant cap and registration deadline
    const event = await prisma.category.findUnique({
      where: { id: eventId },
      select: { perPersonCap: true, registrationDeadline: true }
    });

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    // Check registration deadline
    if (event.registrationDeadline && new Date(event.registrationDeadline).getTime() <= new Date().getTime()) {
      return NextResponse.json({ error: 'Registration deadline has passed' }, { status: 400 });
    }

    // Find the game
    const game = await prisma.game.findFirst({
      where: { name: registration.gameName },
      select: { id: true, name: true }
    });

    if (!game) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    // Find existing registration
    const existingRegistration = await prisma.registration.findFirst({
      where: {
        userId: user.id,
        gameId: game.id
      },
      include: {
        team: {
          include: {
            members: true
          }
        }
      }
    });

    if (!existingRegistration) {
      return NextResponse.json({ error: 'No existing registration found to update' }, { status: 404 });
    }

    // Use a transaction to ensure atomicity
    const result = await prisma.$transaction(async (tx) => {
      // Clean up existing team if it exists and user is team lead
      if (existingRegistration.teamId && existingRegistration.team) {
        const team = existingRegistration.team;
        
        if (team.teamLead === user.id) {
          // Delete all team member registrations
          await tx.registration.deleteMany({
            where: {
              teamId: team.id
            }
          });
          
          // Delete all team memberships
          await tx.teamMember.deleteMany({
            where: {
              teamId: team.id
            }
          });
          
          // Delete the team
          await tx.team.delete({
            where: {
              id: team.id
            }
          });
        } else {
          // If user is just a team member, only remove their registration and membership
          await tx.registration.delete({
            where: { id: existingRegistration.id }
          });
          
          await tx.teamMember.deleteMany({
            where: {
              teamId: team.id,
              userId: user.id
            }
          });
        }
      } else {
        // Individual registration, just delete it
        await tx.registration.delete({
          where: { id: existingRegistration.id }
        });
      }

      // Now create the new registration
      let teamId = null;
      
      // If it's a team registration, create the team and team members
      if (registration.mode === 'TEAM') {
        // Check if any team members are already in teams for this game (only if there are additional members)
        // Allow individual registrations to be converted to team registrations
        if (registration.teamMembers && registration.teamMembers.length > 0) {
          // Remove current user from team members list to avoid duplication (they're handled separately)
          const otherMemberIds = registration.teamMembers.filter((id: string) => id !== user.id);
          const allMemberIds = [user.id, ...otherMemberIds];
          
          // Only check for existing team memberships (not individual registrations)
          const existingTeamMemberships = await tx.teamMember.findMany({
            where: {
              userId: { in: allMemberIds },
              team: { gameId: game.id }
            },
            include: {
              user: { select: { firstName: true, lastName: true, email: true } },
              team: true
            }
          });
          
          if (existingTeamMemberships.length > 0) {
            // Collect conflicting users (only those already in teams)
            const conflictUsers = existingTeamMemberships.map(tm => ({
              id: tm.userId,
              name: tm.user.firstName && tm.user.lastName ? `${tm.user.firstName} ${tm.user.lastName}` : tm.user.email
            }));
            
            // Remove duplicates based on user ID
            const uniqueConflictUsers = conflictUsers.filter((user, index, self) =>
              index === self.findIndex(u => u.id === user.id)
            );
            
            throw new Error(`The following users are already in teams for ${registration.gameName}: ${uniqueConflictUsers.map(u => u.name).join(', ')}`);
          }
          
          // Get existing individual registrations that will be converted to team registrations
          const existingIndividualRegistrations = await tx.registration.findMany({
            where: {
              gameId: game.id,
              userId: { in: allMemberIds },
              teamId: null // Only individual registrations
            }
          });
          
          // Delete existing individual registrations for users who will join the team
          if (existingIndividualRegistrations.length > 0) {
            await tx.registration.deleteMany({
              where: {
                id: { in: existingIndividualRegistrations.map(r => r.id) }
              }
            });
          }
        }
        
        // Check if team name already exists for this game (for edit registration)
        if (registration.teamName && registration.teamName.trim()) {
          const existingTeam = await tx.team.findFirst({
            where: {
              gameId: game.id,
              name: {
                equals: registration.teamName.trim(),
                mode: 'insensitive' // Case-insensitive comparison
              }
            }
          });
          
          if (existingTeam) {
            throw new Error(`Team name "${registration.teamName}" already exists for ${registration.gameName}. Please choose a different name.`);
          }
        }
        
        // Create the team with team lead
        const team = await tx.team.create({
          data: {
            gameId: game.id,
            name: registration.teamName || `${user.firstName || user.email}'s Team`,
            teamLead: user.id,
            openTeam: registration.openTeam || false
          }
        });
        
        teamId = team.id;
        
        // Add current user as team member (team lead is also a member)
        await tx.teamMember.create({
          data: {
            teamId: team.id,
            userId: user.id
          }
        });
        
        // Add other team members and create registrations for them
        // Filter out current user to avoid duplication (they're handled separately)
        const otherMemberIds = registration.teamMembers.filter((id: string) => id !== user.id);
        for (const memberId of otherMemberIds) {
          await tx.teamMember.create({
            data: {
              teamId: team.id,
              userId: memberId
            }
          });
          
          // Create registration for each team member
          await tx.registration.create({
            data: {
              userId: memberId,
              gameId: game.id,
              level: registration.level,
              mode: registration.mode,
              teamId: team.id,
              allowAutoAssign: false
            }
          });
        }
      }
      
      // Create the main registration (for team lead or individual)
      const newRegistration = await tx.registration.create({
        data: {
          userId: user.id,
          gameId: game.id,
          level: registration.level,
          mode: registration.mode,
          teamId: teamId
        }
      });

      return newRegistration;
    });

    // Log the registration update activity
    try {
      await auditLogger.log(
        user.id,
        'game.registration_updated',
        'registration',
        game.id,
        {
          gameName: registration.gameName,
          level: registration.level,
          mode: registration.mode,
          teamName: registration.teamName || null,
          teamMembersCount: registration.teamMembers?.length || 0,
          openTeam: registration.openTeam || false,
          previousMode: existingRegistration.mode,
          previousTeamName: existingRegistration.team?.name || null,
          eventId: eventId,
          timestamp: new Date().toISOString()
        },
        createAuditContext(request)
      );

      // If it's a new team registration, also log team creation
      if (registration.mode === 'TEAM' && registration.teamName && existingRegistration.mode !== 'TEAM') {
        await auditLogger.log(
          user.id,
          'team.created',
          'team',
          game.id,
          {
            teamName: registration.teamName,
            gameName: registration.gameName,
            teamMembersCount: (registration.teamMembers?.length || 0) + 1, // +1 for team lead
            openTeam: registration.openTeam || false,
            timestamp: new Date().toISOString()
          },
          createAuditContext(request)
        );
      }
    } catch (auditError) {
      // Don't fail the request if audit logging fails
      console.error('Failed to log registration update activity:', auditError);
    }

    return NextResponse.json({
      message: 'Registration updated successfully',
      registration: result
    });

  } catch (error) {
    console.error('Registration update error:', error);
    
    if (error instanceof Error && error.message.includes('already registered')) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    
    return NextResponse.json({
      error: 'Failed to update registration'
    }, { status: 500 });
  }
}
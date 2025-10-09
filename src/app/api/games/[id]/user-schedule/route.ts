import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth(request);
    const gameId = params.id;

    // Fetch game details with registrations - only show data relevant to the user
    const game = await prisma.game.findUnique({
      where: { id: gameId },
      include: {
        category: true,
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
            },
            team: {
              include: {
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
                }
              }
            }
          }
        }
      }
    });

    if (!game) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    // Check if user is registered for this game
    const userRegistration = game.registrations.find(reg => 
      reg.user.id === user.id || 
      (reg.team && reg.team.members.some(member => member.user.id === user.id))
    );

    if (!userRegistration) {
      return NextResponse.json({ error: 'You are not registered for this game' }, { status: 403 });
    }

    // Parse daily windows from category
    const dailyWindows = JSON.parse(game.category.dailyWindows || '[]');
    
    // Determine required team size from typeFormat (e.g., "2v2" -> 2, "3v3" -> 3)
    const getRequiredTeamSize = (typeFormat: string): number => {
      const match = typeFormat.match(/^(\d+)v\d+$/);
      return match ? parseInt(match[1]) : 1;
    };
    
    const requiredTeamSize = getRequiredTeamSize(game.typeFormat);
    
    // Filter registrations to only show complete registrations
    const isTeamGame = game.typeFormat !== '1v1' && game.contestType !== 'SCORING';
    const isScoringContest = game.contestType === 'SCORING';
    
    let relevantRegistrations = game.registrations.filter(registration => {
      if (isScoringContest) {
        return registration.mode === 'INDIVIDUAL';
      } else if (isTeamGame) {
        return registration.mode === 'TEAM' && registration.team;
      } else {
        return registration.mode === 'INDIVIDUAL';
      }
    });

    // For team games, deduplicate by team ID
    if (isTeamGame) {
      const seenTeams = new Set();
      relevantRegistrations = relevantRegistrations.filter(registration => {
        if (registration.team && !seenTeams.has(registration.team.id)) {
          seenTeams.add(registration.team.id);
          return true;
        }
        return false;
      });
    }
    
    // Helper function to check if team is complete
    const isTeamComplete = (team: any): boolean => {
      if (!team || !team.members) return false;
      const actualTeamSize = team.members.length;
      return actualTeamSize >= requiredTeamSize;
    };
    
    // Show all registrations but mark completeness status
    const allRegistrations = relevantRegistrations;

    return NextResponse.json({
      game: {
        id: game.id,
        name: game.name,
        contestType: game.contestType,
        typeFormat: game.typeFormat,
        avgGameTime: game.avgGameTime,
        simultaneousGames: game.simultaneousGames,
        category: {
          startDate: game.category.startDate.toISOString(),
          endDate: game.category.endDate.toISOString(),
          dailyWindows: JSON.parse(game.category.dailyWindows || '[]')
        }
      },
      registrations: allRegistrations.map(reg => {
        const isComplete = reg.mode === 'INDIVIDUAL' || (reg.team && isTeamComplete(reg.team));
        return {
          id: reg.id,
          level: reg.level,
          mode: reg.mode,
          isComplete,
          user: reg.user,
          team: reg.team ? {
            id: reg.team.id,
            name: reg.team.name,
            isComplete: isTeamComplete(reg.team),
            requiredSize: requiredTeamSize,
            actualSize: reg.team.members.length,
            members: reg.team.members.map(member => member.user)
          } : null
        };
      }),
      userRegistration: {
        id: userRegistration.id,
        level: userRegistration.level,
        mode: userRegistration.mode,
        teamName: userRegistration.team?.name,
        teamMembers: userRegistration.team?.members.map(member => ({
          id: member.user.id,
          name: `${member.user.firstName} ${member.user.lastName}`,
          email: member.user.email
        })),
        isTeamLead: userRegistration.user.id === user.id
      }
    });

  } catch (error) {
    console.error('Error fetching game schedule data:', error);
    
    if (error instanceof Error && error.message === 'Authentication required') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch schedule data' },
      { status: 500 }
    );
  }
}
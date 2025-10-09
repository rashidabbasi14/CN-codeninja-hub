import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, requireAdmin, requireAdminOrModerator } from '@/lib/auth';
import { SchedulingEngine, ContestType, Participant, Match } from '@/lib/scheduling';
import { validateCrossGameConflicts } from '@/lib/validation';
import { auditLogger } from '@/lib/audit';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth(request);
    const gameId = params.id;

    // Fetch game details with registrations
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
                phone: true,
                avatarUrl: true
              }
            },
            team: {
              include: {
                leader: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                    phone: true,
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
                        phone: true,
                        avatarUrl: true
                      }
                    }
                  }
                }
              }
            }
          }
        },
        slots: true,
        matches: true
      }
    });

    if (!game) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    // Parse daily windows from category
    const dailyWindows = JSON.parse(game.category.dailyWindows || '[]');
    
    // Generate time windows based on category dates and daily windows
    const timeWindows = [];
    const startDate = new Date(game.category.startDate);
    const endDate = new Date(game.category.endDate);
    
    for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
      for (const window of dailyWindows) {
        const windowStart = new Date(date);
        const [startHour, startMinute] = window.start.split(':').map(Number);
        windowStart.setHours(startHour, startMinute, 0, 0);
        
        const windowEnd = new Date(date);
        const [endHour, endMinute] = window.end.split(':').map(Number);
        windowEnd.setHours(endHour, endMinute, 0, 0);
        
        timeWindows.push({
          start: new Date(windowStart),
          end: new Date(windowEnd)
        });
      }
    }

    // Prepare participants from registrations based on game type
    const participants: Participant[] = [];
    const isTeamGame = game.typeFormat !== '1v1' && game.contestType !== 'SCORING';
    const isScoringContest = game.contestType === 'SCORING';
    
    // Determine required team size from typeFormat (e.g., "2v2" -> 2, "3v3" -> 3)
    const getRequiredTeamSize = (typeFormat: string): number => {
      const match = typeFormat.match(/^(\d+)v\d+$/);
      return match ? parseInt(match[1]) : 1;
    };
    
    const requiredTeamSize = getRequiredTeamSize(game.typeFormat);
    
    // Filter registrations based on game type
    let relevantRegistrations = game.registrations.filter(registration => {
      if (isScoringContest) {
        // Scoring contests are always individual, regardless of typeFormat
        return registration.mode === 'INDIVIDUAL';
      } else if (isTeamGame) {
        // Team games (2v2, 3v3, etc.) should only show team registrations
        return registration.mode === 'TEAM' && registration.team;
      } else {
        // 1v1 games should only show individual registrations
        return registration.mode === 'INDIVIDUAL';
      }
    });

    // For team games, deduplicate by team ID to avoid showing the same team multiple times
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
      // Team size = members count (leader is separate, not in members array)
      const actualTeamSize = team.members.length;
      return actualTeamSize >= requiredTeamSize;
    };
    
    // Separate complete and incomplete teams for scheduling
    const completeRegistrations = [];
    const incompleteRegistrations = [];
    
    for (const registration of relevantRegistrations) {
      if (registration.mode === 'TEAM' && registration.team) {
        if (isTeamComplete(registration.team)) {
          completeRegistrations.push(registration);
          participants.push({
            id: registration.team.id,
            name: registration.team.name,
            type: 'team',
            level: registration.level,
            phone: registration.team.leader?.phone || null
          });
        } else {
          incompleteRegistrations.push(registration);
        }
      } else {
        // Individual registrations are always "complete"
        completeRegistrations.push(registration);
        participants.push({
          id: registration.user.id,
          name: `${registration.user.firstName} ${registration.user.lastName}`,
          type: 'user',
          level: registration.level,
          phone: registration.user.phone || null
        });
      }
    }

    // Generate matches based on contest type
    const tournamentSettings = {
      seedingMethod: game.seedingMethod as 'Random' | 'By Registration Order' | 'Manual',
      groupSize: game.groupSize || undefined,
      rounds: game.rounds || undefined,
      allowDraws: game.allowDraws,
      courtsRequiredPerMatch: game.courtsRequiredPerMatch,
      minRestMinutes: game.minRestMinutes,
      backToBackAllowed: game.backToBackAllowed
    };

    let matches: Match[] = [];
    if (participants.length > 0) {
      try {
        matches = SchedulingEngine.generateMatches(
          participants,
          game.contestType as ContestType,
          tournamentSettings
        );
      } catch (error) {
        console.error('Error generating matches:', error);
        // Continue with empty matches array if generation fails
        matches = [];
      }
    }

    // Convert matches to schedule format for the frontend
    const scheduleMatches = matches.map(match => ({
      id: match.id,
      gameId: gameId,
      gameName: game.name,
      participantA: match.participantA.name,
      participantB: match.participantB?.name || '',
      startTime: match.startTime || new Date(),
      endTime: match.endTime || new Date(),
      status: 'scheduled' as const,
      round: match.round || 1,
      position: match.position || 0
    }));

    // Generate time slots for the schedule editor based on timelines
    const timeSlots = [];
    for (let timelineId = 1; timelineId <= game.simultaneousGames; timelineId++) {
      for (const window of timeWindows) {
        let currentTime = new Date(window.start);
        
        while (currentTime < window.end) {
          const slotEnd = new Date(currentTime.getTime() + game.avgGameTime * 60000);
          
          if (slotEnd <= window.end) {
            timeSlots.push({
              id: `timeline-${timelineId}-${currentTime.getTime()}`,
              startTime: new Date(currentTime),
              endTime: slotEnd,
              timelineId: timelineId,
              matches: []
            });
          }
          
          currentTime = slotEnd;
        }
      }
    }

    return NextResponse.json({
      game: {
        id: game.id,
        name: game.name,
        contestType: game.contestType,
        typeFormat: game.typeFormat,
        avgGameTime: game.avgGameTime,
        simultaneousGames: game.simultaneousGames,
        oneLoserMode: game.contestType === 'SINGLE_ELIMINATION_1V1V1V1' ? game.allowDraws : false,
        category: {
          startDate: game.category.startDate.toISOString(),
          endDate: game.category.endDate.toISOString(),
          dailyWindows: JSON.parse(game.category.dailyWindows || '[]')
        }
      },
      registrations: relevantRegistrations.map(reg => {
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
      participants,
      matches: scheduleMatches,
      timeSlots,
      settings: tournamentSettings
    });

  } catch (error) {
    console.error('Error fetching game schedule data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch schedule data' },
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
    const { timeSlots, matches } = await request.json();

    // Verify game exists
    const game = await prisma.game.findUnique({
      where: { id: gameId }
    });

    if (!game) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    // Delete existing slots and matches for this game
    await prisma.match.deleteMany({
      where: { gameId }
    });
    
    await prisma.slot.deleteMany({
      where: { gameId }
    });

    // Create new slots
    const createdSlots = [];
    for (const timeSlot of timeSlots) {
      if (timeSlot.matches.length > 0) {
        const slot = await prisma.slot.create({
          data: {
            gameId,
            timelineId: timeSlot.timelineId || 1,
            startTime: new Date(timeSlot.startTime),
            endTime: new Date(timeSlot.endTime),
            capacity: timeSlot.matches.length,
            published: true
          }
        });
        createdSlots.push({ ...slot, originalId: timeSlot.id });
      }
    }

    // Create matches and link to slots
    for (const match of matches) {
      const timeSlot = timeSlots.find((slot: any) => 
        slot.matches.some((m: any) => m.id === match.id)
      );
      
      if (timeSlot) {
        const correspondingSlot = createdSlots.find(s => s.originalId === timeSlot.id);
        
        if (correspondingSlot) {
          // Find participant IDs and types
          const participantAData = await findParticipant(match.participantA, gameId);
          const participantBData = await findParticipant(match.participantB, gameId);

          // Create match even if participants are TBD (for future rounds in single elimination)
          if (participantAData && participantBData) {
            // Only validate conflicts if at least one participant is real (not TBD)
            if (participantAData.id !== 'TBD' || participantBData.id !== 'TBD') {
              // Validate conflicts only for real participants (not TBD)
              const participants = [];
              if (participantAData.id !== 'TBD') {
                participants.push({ id: participantAData.id, type: participantAData.type });
              }
              if (participantBData.id !== 'TBD') {
                participants.push({ id: participantBData.id, type: participantBData.type });
              }

              for (const participant of participants) {
                // Get team member information if it's a team
                let teamMembers = undefined;
                if (participant.type === 'TEAM') {
                  const teamData = await prisma.team.findUnique({
                    where: { id: participant.id },
                    include: {
                      members: {
                        include: {
                          user: {
                            select: {
                              id: true,
                              firstName: true,
                              lastName: true
                            }
                          }
                        }
                      }
                    }
                  });
                  teamMembers = teamData?.members;
                }

                // Validate cross-game conflicts
                const conflictResult = await validateCrossGameConflicts({
                  participantId: participant.id,
                  participantType: participant.type as 'USER' | 'TEAM',
                  gameId,
                  startTime: new Date(timeSlot.startTime),
                  endTime: new Date(timeSlot.endTime),
                  teamMembers
                }, prisma);

                if (conflictResult.hasConflict) {
                  console.warn(`Scheduling conflict detected for participant ${participant.id}: ${conflictResult.conflictMessage}`);
                  // For admin scheduling, we'll log the warning but continue
                  // Admins can override conflicts if needed
                }
              }
            }

            await prisma.match.create({
              data: {
                gameId,
                slotId: correspondingSlot.id,
                participantAId: participantAData.id,
                participantAType: participantAData.type,
                participantBId: participantBData.id,
                participantBType: participantBData.type
              }
            });
          }
        }
      }
    }

    // Add audit logging for bulk schedule operations
    await auditLogger.log(
      user.id,
      'schedule.generated',
      'game',
      gameId,
      {
        gameName: game.name,
        slotsCreated: createdSlots.length,
        matchesCreated: matches.length,
        timeSlots: timeSlots.length,
        adminScheduled: true,
        bulkOperation: true
      }
    );

    return NextResponse.json({
      message: 'Schedule saved successfully',
      slotsCreated: createdSlots.length,
      matchesCreated: matches.length
    });

  } catch (error) {
    console.error('Error saving game schedule:', error);
    return NextResponse.json(
      { error: 'Failed to save schedule' },
      { status: 500 }
    );
  }
}

async function findParticipant(participant: any, gameId: string) {
  // Handle placeholder participants (for future rounds in single elimination)
  if (!participant || typeof participant === 'string') {
    const participantName = participant || 'TBD';
    
    // Check if this is a placeholder for a future round
    if (participantName.startsWith('Winner of') || participantName === 'TBD') {
      return { id: 'TBD', type: 'PLACEHOLDER' };
    }
    
    // Try to find real participant by name
    return await findRealParticipant(participantName, gameId);
  }
  
  // Handle participant object
  if (participant.id && participant.name) {
    // Check if this is a placeholder participant
    if (participant.id.startsWith('winner-of-match-') || participant.id.startsWith('bye-')) {
      return { id: 'TBD', type: 'PLACEHOLDER' };
    }
    
    // Try to find real participant
    return await findRealParticipant(participant.name, gameId);
  }
  
  return { id: 'TBD', type: 'PLACEHOLDER' };
}

async function findRealParticipant(participantName: string, gameId: string) {
  // First try to find as a team
  const team = await prisma.team.findFirst({
    where: {
      gameId,
      name: participantName
    }
  });

  if (team) {
    return { id: team.id, type: 'TEAM' };
  }

  // Then try to find as a user
  const [firstName, ...lastNameParts] = participantName.split(' ');
  const lastName = lastNameParts.join(' ');

  const user = await prisma.user.findFirst({
    where: {
      firstName,
      lastName,
      registrations: {
        some: {
          gameId
        }
      }
    }
  });

  if (user) {
    return { id: user.id, type: 'USER' };
  }

  return { id: 'TBD', type: 'PLACEHOLDER' };
}
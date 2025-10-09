import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    // First get user's team IDs
    const userTeams = await prisma.team.findMany({
      where: {
        members: {
          some: {
            userId: user.id
          }
        }
      },
      select: { id: true }
    });
    
    const userTeamIds = userTeams.map(t => t.id);

    // Get all matches where the user might be a participant and the match hasn't concluded
    const allMatches = await prisma.match.findMany({
      where: {
        AND: [
          // Match hasn't concluded (no winner)
          { winnerId: null },
          // Match has a scheduled slot
          { slotId: { not: null } },
          // Slot is in the future
          {
            slot: {
              startTime: {
                gt: new Date()
              }
            }
          }
        ]
      },
      include: {
        game: {
          include: {
            category: {
              select: {
                name: true,
                status: true
              }
            }
          }
        },
        slot: true
      },
      orderBy: {
        slot: {
          startTime: 'asc'
        }
      }
    });

    // Filter matches where user is a participant (including 1v1v1v1 JSON format)
    const userMatches = allMatches.filter(match => {
      // Check direct participant matches
      if (match.participantAId === user.id || match.participantBId === user.id) {
        return true;
      }

      // Check team matches
      if (match.participantAType === 'TEAM' && userTeamIds.includes(match.participantAId)) {
        return true;
      }
      if (match.participantBType === 'TEAM' && userTeamIds.includes(match.participantBId)) {
        return true;
      }

      // Check 1v1v1v1 format with JSON data
      if (match.participantAType === 'FOUR_PARTICIPANT_DATA' && match.participantAId !== 'TBD') {
        try {
          const participantAData = JSON.parse(match.participantAId);
          if (participantAData.participant1Id === user.id || participantAData.participant2Id === user.id) {
            return true;
          }
        } catch (e) {
          // Ignore JSON parse errors
        }
      }

      if (match.participantBType === 'FOUR_PARTICIPANT_DATA' && match.participantBId !== 'TBD') {
        try {
          const participantBData = JSON.parse(match.participantBId);
          if (participantBData.participant3Id === user.id || participantBData.participant4Id === user.id) {
            return true;
          }
        } catch (e) {
          // Ignore JSON parse errors
        }
      }

      return false;
    });

    // Get the next match (first one after sorting)
    if (userMatches.length === 0) {
      return NextResponse.json({ nextMatch: null });
    }

    const match = userMatches[0];
    
    // Get opponent information
    let opponent = null;
    let userSide = null;
    
    // Handle 1v1v1v1 format
    if (match.game.contestType === 'SINGLE_ELIMINATION_1V1V1V1') {
      // For 1v1v1v1, we need to show all other participants as opponents
      const participants = [];
      
      // Parse participantA JSON data
      if (match.participantAType === 'FOUR_PARTICIPANT_DATA' && match.participantAId !== 'TBD') {
        try {
          const participantAData = JSON.parse(match.participantAId);
          if (participantAData.participant1Id && participantAData.participant1Id !== 'TBD') {
            participants.push({ id: participantAData.participant1Id, type: participantAData.participant1Type });
          }
          if (participantAData.participant2Id && participantAData.participant2Id !== 'TBD') {
            participants.push({ id: participantAData.participant2Id, type: participantAData.participant2Type });
          }
        } catch (e) {
          // Ignore JSON parse errors
        }
      }
      
      // Parse participantB JSON data
      if (match.participantBType === 'FOUR_PARTICIPANT_DATA' && match.participantBId !== 'TBD') {
        try {
          const participantBData = JSON.parse(match.participantBId);
          if (participantBData.participant3Id && participantBData.participant3Id !== 'TBD') {
            participants.push({ id: participantBData.participant3Id, type: participantBData.participant3Type });
          }
          if (participantBData.participant4Id && participantBData.participant4Id !== 'TBD') {
            participants.push({ id: participantBData.participant4Id, type: participantBData.participant4Type });
          }
        } catch (e) {
          // Ignore JSON parse errors
        }
      }
      
      // Get all opponents (everyone except the current user)
      const allOpponents = [];
      for (const participant of participants) {
        if (participant.id !== user.id) {
          if (participant.type === 'USER') {
            const opponentUser = await prisma.user.findUnique({
              where: { id: participant.id },
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatarUrl: true
              }
            });
            if (opponentUser) {
              allOpponents.push(opponentUser);
            }
          }
        }
      }
      
      opponent = {
        type: 'multi',
        opponents: allOpponents,
        count: allOpponents.length
      };
      userSide = 'MULTI';
    } else {
      // Handle regular 1v1 and team matches
      if (match.participantAId === user.id) {
        userSide = 'A';
        if (match.participantBType === 'USER' && match.participantBId !== 'TBD') {
          const opponentUser = await prisma.user.findUnique({
            where: { id: match.participantBId },
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatarUrl: true
            }
          });
          opponent = opponentUser;
        } else if (match.participantBType === 'TEAM' && match.participantBId !== 'TBD') {
          const team = await prisma.team.findUnique({
            where: { id: match.participantBId },
            include: {
              members: {
                include: {
                  user: {
                    select: {
                      id: true,
                      firstName: true,
                      lastName: true,
                      avatarUrl: true
                    }
                  }
                }
              }
            }
          });
          opponent = {
            type: 'team',
            name: team?.name || 'Team',
            members: team?.members.map(m => m.user) || []
          };
        }
      } else if (match.participantBId === user.id) {
        userSide = 'B';
        if (match.participantAType === 'USER' && match.participantAId !== 'TBD') {
          const opponentUser = await prisma.user.findUnique({
            where: { id: match.participantAId },
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatarUrl: true
            }
          });
          opponent = opponentUser;
        } else if (match.participantAType === 'TEAM' && match.participantAId !== 'TBD') {
          const team = await prisma.team.findUnique({
            where: { id: match.participantAId },
            include: {
              members: {
                include: {
                  user: {
                    select: {
                      id: true,
                      firstName: true,
                      lastName: true,
                      avatarUrl: true
                    }
                  }
                }
              }
            }
          });
          opponent = {
            type: 'team',
            name: team?.name || 'Team',
            members: team?.members.map(m => m.user) || []
          };
        }
      } else {
        // User is part of a team
        if (userTeamIds.includes(match.participantAId)) {
          userSide = 'A';
          if (match.participantBType === 'USER' && match.participantBId !== 'TBD') {
            const opponentUser = await prisma.user.findUnique({
              where: { id: match.participantBId },
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatarUrl: true
              }
            });
            opponent = opponentUser;
          } else if (match.participantBType === 'TEAM' && match.participantBId !== 'TBD') {
            const team = await prisma.team.findUnique({
              where: { id: match.participantBId },
              include: {
                members: {
                  include: {
                    user: {
                      select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        avatarUrl: true
                      }
                    }
                  }
                }
              }
            });
            opponent = {
              type: 'team',
              name: team?.name || 'Team',
              members: team?.members.map(m => m.user) || []
            };
          }
        } else if (userTeamIds.includes(match.participantBId)) {
          userSide = 'B';
          if (match.participantAType === 'USER' && match.participantAId !== 'TBD') {
            const opponentUser = await prisma.user.findUnique({
              where: { id: match.participantAId },
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatarUrl: true
              }
            });
            opponent = opponentUser;
          } else if (match.participantAType === 'TEAM' && match.participantAId !== 'TBD') {
            const team = await prisma.team.findUnique({
              where: { id: match.participantAId },
              include: {
                members: {
                  include: {
                    user: {
                      select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        avatarUrl: true
                      }
                    }
                  }
                }
              }
            });
            opponent = {
              type: 'team',
              name: team?.name || 'Team',
              members: team?.members.map(m => m.user) || []
            };
          }
        }
      }
    }

    const nextMatch = {
      id: match.id,
      game: {
        id: match.game.id,
        name: match.game.name,
        contestType: match.game.contestType,
        category: match.game.category
      },
      slot: {
        startTime: match.slot?.startTime,
        endTime: match.slot?.endTime
      },
      opponent,
      userSide
    };

    return NextResponse.json({ nextMatch });

  } catch (error) {
    console.error('Error fetching next match:', error);
    
    if (error instanceof Error && error.message === 'Authentication required') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch next match' },
      { status: 500 }
    );
  }
}
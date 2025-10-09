import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Fetch the last 15 concluded matches (matches with winnerId) from active categories only
    const recentMatches = await prisma.match.findMany({
      where: {
        winnerId: { not: null },
        winnerType: { not: null },
        game: {
          category: {
            status: 'ACTIVE'
          }
        }
      },
      orderBy: {
        updatedAt: 'desc'
      },
      take: 15,
      include: {
        game: {
          select: {
            id: true,
            name: true,
            category: {
              select: {
                name: true,
                status: true
              }
            }
          }
        },
        slot: {
          select: {
            startTime: true,
            endTime: true
          }
        }
      }
    });

    // Get participant details for each match
    const matchesWithParticipants = await Promise.all(
      recentMatches.map(async (match) => {
        let participantA = null;
        let participantB = null;
        let winner = null;

        // Get participant A details
        if (match.participantAType === 'USER') {
          const user = await prisma.user.findUnique({
            where: { id: match.participantAId },
            select: {
              id: true,
              firstName: true,
              lastName: true,
              department: {
                select: { name: true }
              }
            }
          });
          if (user) {
            participantA = {
              id: user.id,
              name: `${user.firstName} ${user.lastName}`,
              type: 'USER',
              department: user.department?.name || 'No Department'
            };
          }
        } else if (match.participantAType === 'TEAM') {
          const team = await prisma.team.findUnique({
            where: { id: match.participantAId },
            select: {
              id: true,
              name: true,
              members: {
                include: {
                  user: {
                    select: {
                      firstName: true,
                      lastName: true
                    }
                  }
                }
              }
            }
          });
          if (team) {
            participantA = {
              id: team.id,
              name: team.name,
              type: 'TEAM',
              members: team.members.map(member => 
                `${member.user.firstName} ${member.user.lastName}`
              )
            };
          }
        }

        // Get participant B details
        if (match.participantBType === 'USER') {
          const user = await prisma.user.findUnique({
            where: { id: match.participantBId },
            select: {
              id: true,
              firstName: true,
              lastName: true,
              department: {
                select: { name: true }
              }
            }
          });
          if (user) {
            participantB = {
              id: user.id,
              name: `${user.firstName} ${user.lastName}`,
              type: 'USER',
              department: user.department?.name || 'No Department'
            };
          }
        } else if (match.participantBType === 'TEAM') {
          const team = await prisma.team.findUnique({
            where: { id: match.participantBId },
            select: {
              id: true,
              name: true,
              members: {
                include: {
                  user: {
                    select: {
                      firstName: true,
                      lastName: true
                    }
                  }
                }
              }
            }
          });
          if (team) {
            participantB = {
              id: team.id,
              name: team.name,
              type: 'TEAM',
              members: team.members.map(member => 
                `${member.user.firstName} ${member.user.lastName}`
              )
            };
          }
        }

        // Get winner details
        if (match.winnerType === 'USER') {
          const user = await prisma.user.findUnique({
            where: { id: match.winnerId! },
            select: {
              id: true,
              firstName: true,
              lastName: true,
              department: {
                select: { name: true }
              }
            }
          });
          if (user) {
            winner = {
              id: user.id,
              name: `${user.firstName} ${user.lastName}`,
              type: 'USER',
              department: user.department?.name || 'No Department'
            };
          }
        } else if (match.winnerType === 'TEAM') {
          const team = await prisma.team.findUnique({
            where: { id: match.winnerId! },
            select: {
              id: true,
              name: true,
              members: {
                include: {
                  user: {
                    select: {
                      firstName: true,
                      lastName: true
                    }
                  }
                }
              }
            }
          });
          if (team) {
            winner = {
              id: team.id,
              name: team.name,
              type: 'TEAM',
              members: team.members.map(member => 
                `${member.user.firstName} ${member.user.lastName}`
              )
            };
          }
        }

        return {
          id: match.id,
          gameId: match.gameId,
          gameName: match.game.name,
          categoryName: match.game.category.name,
          participantA,
          participantB,
          winner,
          scoreNotes: match.scoreNotes,
          completedAt: match.updatedAt,
          startTime: match.slot?.startTime,
          endTime: match.slot?.endTime
        };
      })
    );

    // Filter out matches where we couldn't resolve participants
    // For scoring contests, participantB can be null, so we only require participantA and winner
    const validMatches = matchesWithParticipants.filter(
      match => match.participantA && match.winner
    );

    return NextResponse.json({
      matches: validMatches,
      count: validMatches.length,
      lastUpdated: new Date().toISOString()
    });

  } catch (error) {
    console.error('Failed to fetch recent matches:', error);
    return NextResponse.json(
      { error: 'Failed to fetch recent matches' },
      { status: 500 }
    );
  }
}
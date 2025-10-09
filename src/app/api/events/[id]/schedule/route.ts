import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, getCurrentUser } from '@/lib/auth';
import { auditLogger, createAuditContext } from '@/lib/audit';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAuth(request);
    const user = await getCurrentUser(request);
    
    const eventId = params.id;

    // Get the event (category) with its games
    const event = await prisma.category.findUnique({
      where: { id: eventId },
      include: {
        games: {
          include: {
            slots: {
              include: {
                matches: {
                  include: {
                    game: true
                  }
                }
              },
              orderBy: {
                startTime: 'asc'
              }
            }
          }
        }
      }
    });

    if (!event) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    console.log('Events schedule API called for event:', eventId);
    console.log('Found event with games:', event.games.map(g => ({ id: g.id, name: g.name, contestType: g.contestType })));

    // Transform the data into a schedule format
    const schedule = {
      eventId: event.id,
      eventName: event.name,
      startDate: event.startDate,
      endDate: event.endDate,
      location: event.locationName,
      games: await Promise.all(event.games.map(async (game) => {
        // Get participants from registrations
        const gameWithRegistrations = await prisma.game.findUnique({
          where: { id: game.id },
          include: {
            registrations: {
              include: {
                user: true,
                team: {
                  include: {
                    members: {
                      include: {
                        user: true
                      }
                    }
                  }
                }
              }
            }
          }
        });

        const participants = gameWithRegistrations?.registrations.map(reg => {
          if (reg.mode === 'TEAM' && reg.team) {
            return {
              id: reg.team.id,
              type: 'TEAM',
              name: reg.team.name,
              members: reg.team.members.map(member => ({
                id: member.user.id,
                name: `${member.user.firstName} ${member.user.lastName}`,
                email: member.user.email
              }))
            };
          } else {
            return {
              id: reg.user.id,
              type: 'USER',
              name: `${reg.user.firstName} ${reg.user.lastName}`,
              email: reg.user.email
            };
          }
        }) || [];

        return {
          id: game.id,
          name: game.name,
          weightage: game.weightage,
          typeFormat: game.typeFormat,
          avgGameTime: game.avgGameTime,
          levels: JSON.parse(game.levels || '[]'),
          contestType: game.contestType,
          slots: game.slots.map(slot => ({
            id: slot.id,
            startTime: slot.startTime,
            endTime: slot.endTime,
            timelineId: (slot as any).timelineId || 1,
            capacity: slot.capacity,
            published: slot.published,
            matches: slot.matches.map(match => {
              let participantA, participantB, participantC, participantD;
              
              // Check if this is a 1v1v1v1 format match (JSON storage)
              if (game.contestType === 'SINGLE_ELIMINATION_1V1V1V1') {
                console.log('Processing 1v1v1v1 match:', {
                  matchId: match.id,
                  participantAId: match.participantAId,
                  participantBId: match.participantBId,
                  participantAType: match.participantAType,
                  participantBType: match.participantBType
                });
                
                try {
                  // Parse JSON from participantAId for participants 1 and 2
                  const participantAData = JSON.parse(match.participantAId);
                  console.log('Parsed participantAData:', participantAData);
                  console.log('Available participants:', participants.map(p => ({ id: p.id, name: p.name, type: p.type })));
                  
                  participantA = participants.find(p => p.id === participantAData.participant1Id) ||
                               { id: participantAData.participant1Id || 'TBD', name: 'TBD', type: participantAData.participant1Type || 'USER' };
                  participantB = participants.find(p => p.id === participantAData.participant2Id) ||
                               { id: participantAData.participant2Id || 'TBD', name: 'TBD', type: participantAData.participant2Type || 'USER' };
                  
                  console.log('Found participantA:', participantA);
                  console.log('Found participantB:', participantB);
                  
                  // Parse JSON from participantBId for participants 3 and 4
                  if (match.participantBId && match.participantBId !== 'TBD' && match.participantBType !== 'PLACEHOLDER') {
                    try {
                      const participantBData = JSON.parse(match.participantBId);
                      console.log('Parsed participantBData:', participantBData);
                      
                      participantC = participants.find(p => p.id === participantBData.participant3Id) ||
                                   { id: participantBData.participant3Id, name: 'TBD', type: participantBData.participant3Type };
                      participantD = participants.find(p => p.id === participantBData.participant4Id) ||
                                   { id: participantBData.participant4Id, name: 'TBD', type: participantBData.participant4Type };
                    } catch (error) {
                      console.log('Failed to parse participantBId as JSON, using TBD for C and D');
                      participantC = { id: 'TBD', name: 'TBD', type: 'USER' };
                      participantD = { id: 'TBD', name: 'TBD', type: 'USER' };
                    }
                  } else {
                    console.log('participantBId is TBD or PLACEHOLDER, using TBD for C and D');
                    participantC = { id: 'TBD', name: 'TBD', type: 'USER' };
                    participantD = { id: 'TBD', name: 'TBD', type: 'USER' };
                  }
                  
                  console.log('Found participantC:', participantC);
                  console.log('Found participantD:', participantD);
                } catch (error) {
                  console.error('JSON parsing failed for 1v1v1v1 match:', error);
                  // Fallback to regular parsing if JSON parsing fails
                  participantA = participants.find(p => p.id === match.participantAId) ||
                               { id: match.participantAId, name: 'TBD', type: match.participantAType };
                  participantB = participants.find(p => p.id === match.participantBId) ||
                               { id: match.participantBId, name: 'TBD', type: match.participantBType };
                }
              } else {
                // Regular 2-participant format
                participantA = participants.find(p => p.id === match.participantAId) ||
                             { id: match.participantAId, name: 'TBD', type: match.participantAType };
                participantB = participants.find(p => p.id === match.participantBId) ||
                             { id: match.participantBId, name: 'TBD', type: match.participantBType };
              }
              
              const winner = match.winnerId ? participants.find(p => p.id === match.winnerId) : null;

              const matchData: any = {
                id: match.id,
                participantA,
                participantB,
                winner: winner,
                scoreNotes: match.scoreNotes,
                flags: match.flags ? JSON.parse(match.flags) : null
              };
              
              // Add participants C and D for 1v1v1v1 format
              if (participantC) matchData.participantC = participantC;
              if (participantD) matchData.participantD = participantD;
              
              return matchData;
            })
          }))
        };
      }))
    };

    // Log the schedule viewing activity
    if (user) {
      try {
        await auditLogger.log(
          user.id,
          'schedule.viewed',
          'event',
          eventId,
          {
            eventName: event.name,
            eventId: eventId,
            gamesCount: event.games.length,
            gameNames: event.games.map(g => g.name),
            totalSlots: event.games.reduce((total, game) => total + game.slots.length, 0),
            timestamp: new Date().toISOString()
          },
          createAuditContext(request)
        );
      } catch (auditError) {
        // Don't fail the request if audit logging fails
        console.error('Failed to log schedule viewing activity:', auditError);
      }
    }

    return NextResponse.json(schedule);

  } catch (error) {
    console.error('Failed to fetch event schedule:', error);
    
    if (error instanceof Error && error.message === 'Authentication required') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch event schedule' },
      { status: 500 }
    );
  }
}
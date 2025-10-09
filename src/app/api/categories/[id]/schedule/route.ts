import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const categoryId = params.id;

    // Fetch category with games and their matches/slots
    const category = await prisma.category.findUnique({
      where: { id: categoryId },
      include: {
        games: {
          select: {
            id: true,
            name: true,
            contestType: true,
            typeFormat: true,
            allowDraws: true,
            description: true,
            slots: {
              include: {
                matches: {
                  include: {
                    game: {
                      select: {
                        name: true,
                        contestType: true,
                        typeFormat: true
                      }
                    }
                  }
                }
              },
              orderBy: {
                startTime: 'asc'
              }
            },
            matches: {
              include: {
                slot: true
              },
              orderBy: {
                createdAt: 'asc'
              }
            },
            registrations: {
              include: {
                user: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true
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
                            email: true
                          }
                        }
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

    if (!category) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    // Transform the data for easier frontend consumption
    const scheduleData = {
      categoryId: category.id,
      categoryName: category.name,
      startDate: category.startDate,
      endDate: category.endDate,
      location: category.locationName,
      games: category.games.map(game => {
        // Get participants from registrations
        const participants = game.registrations.map(reg => {
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
        });

        // Get matches with participant details
        const matches = game.matches.map(match => {
          let participantA, participantB, participantC, participantD;
          
          // Check if this is a 1v1v1v1 format match (JSON storage)
          if (game.contestType === 'SINGLE_ELIMINATION_1V1V1V1') {
            // Initialize all participants as TBD first
            participantA = { id: 'TBD', name: 'TBD', type: 'USER' };
            participantB = { id: 'TBD', name: 'TBD', type: 'USER' };
            participantC = { id: 'TBD', name: 'TBD', type: 'USER' };
            participantD = { id: 'TBD', name: 'TBD', type: 'USER' };

            // Parse JSON from participantAId for participants 1 and 2 (if not TBD)
            if (match.participantAId && match.participantAId !== 'TBD' && match.participantAType === 'FOUR_PARTICIPANT_DATA') {
              try {
                const participantAData = JSON.parse(match.participantAId);
                
                if (participantAData.participant1Id) {
                  participantA = participants.find(p => p.id === participantAData.participant1Id) ||
                               { id: participantAData.participant1Id, name: 'TBD', type: participantAData.participant1Type || 'USER' };
                }
                if (participantAData.participant2Id) {
                  participantB = participants.find(p => p.id === participantAData.participant2Id) ||
                               { id: participantAData.participant2Id, name: 'TBD', type: participantAData.participant2Type || 'USER' };
                }
              } catch (error) {
                console.error('Error parsing participantAId JSON:', error);
              }
            }
            
            // Parse JSON from participantBId for participants 3 and 4 (if not TBD)
            if (match.participantBId && match.participantBId !== 'TBD' && match.participantBType === 'FOUR_PARTICIPANT_DATA') {
              try {
                const participantBData = JSON.parse(match.participantBId);
                
                if (participantBData.participant3Id) {
                  participantC = participants.find(p => p.id === participantBData.participant3Id) ||
                               { id: participantBData.participant3Id, name: 'TBD', type: participantBData.participant3Type || 'USER' };
                }
                if (participantBData.participant4Id) {
                  participantD = participants.find(p => p.id === participantBData.participant4Id) ||
                               { id: participantBData.participant4Id, name: 'TBD', type: participantBData.participant4Type || 'USER' };
                }
              } catch (error) {
                console.error('Error parsing participantBId JSON:', error);
              }
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
            timeSlot: match.slot ? {
              startTime: match.slot.startTime,
              endTime: match.slot.endTime
            } : null,
            flags: match.flags ? JSON.parse(match.flags) : null
          };
          
          // Add participants C and D for 1v1v1v1 format
          if (participantC) matchData.participantC = participantC;
          if (participantD) matchData.participantD = participantD;
          
          return matchData;
        });

        return {
          id: game.id,
          name: game.name,
          description: game.description,
          contestType: game.contestType,
          typeFormat: game.typeFormat,
          oneLoserMode: game.contestType === 'SINGLE_ELIMINATION_1V1V1V1' ? game.allowDraws : false,
          participants,
          matches,
          slots: game.slots.map(slot => ({
            id: slot.id,
            startTime: slot.startTime,
            endTime: slot.endTime,
            timelineId: slot.timelineId,
            published: slot.published,
            matches: slot.matches.map(match => {
              let participantA, participantB, participantC, participantD;
              
              // Check if this is a 1v1v1v1 format match (JSON storage)
              if (game.contestType === 'SINGLE_ELIMINATION_1V1V1V1') {
                // Initialize all participants as TBD first
                participantA = { id: 'TBD', name: 'TBD', type: 'USER' };
                participantB = { id: 'TBD', name: 'TBD', type: 'USER' };
                participantC = { id: 'TBD', name: 'TBD', type: 'USER' };
                participantD = { id: 'TBD', name: 'TBD', type: 'USER' };

                // Parse JSON from participantAId for participants 1 and 2 (if not TBD)
                if (match.participantAId && match.participantAId !== 'TBD' && match.participantAType === 'FOUR_PARTICIPANT_DATA') {
                  try {
                    const participantAData = JSON.parse(match.participantAId);
                    
                    if (participantAData.participant1Id) {
                      participantA = participants.find(p => p.id === participantAData.participant1Id) ||
                                   { id: participantAData.participant1Id, name: 'TBD', type: participantAData.participant1Type || 'USER' };
                    }
                    if (participantAData.participant2Id) {
                      participantB = participants.find(p => p.id === participantAData.participant2Id) ||
                                   { id: participantAData.participant2Id, name: 'TBD', type: participantAData.participant2Type || 'USER' };
                    }
                  } catch (error) {
                    console.error('Error parsing participantAId JSON:', error);
                  }
                }
                
                // Parse JSON from participantBId for participants 3 and 4 (if not TBD)
                if (match.participantBId && match.participantBId !== 'TBD' && match.participantBType === 'FOUR_PARTICIPANT_DATA') {
                  try {
                    const participantBData = JSON.parse(match.participantBId);
                    
                    if (participantBData.participant3Id) {
                      participantC = participants.find(p => p.id === participantBData.participant3Id) ||
                                   { id: participantBData.participant3Id, name: 'TBD', type: participantBData.participant3Type || 'USER' };
                    }
                    if (participantBData.participant4Id) {
                      participantD = participants.find(p => p.id === participantBData.participant4Id) ||
                                   { id: participantBData.participant4Id, name: 'TBD', type: participantBData.participant4Type || 'USER' };
                    }
                  } catch (error) {
                    console.error('Error parsing participantBId JSON:', error);
                  }
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
                scoreNotes: match.scoreNotes
              };
              
              // Add participants C and D for 1v1v1v1 format
              if (participantC) matchData.participantC = participantC;
              if (participantD) matchData.participantD = participantD;
              
              return matchData;
            })
          }))
        };
      })
    };

    return NextResponse.json(scheduleData);
  } catch (error) {
    console.error('Error fetching category schedule:', error);
    return NextResponse.json(
      { error: 'Failed to fetch schedule' },
      { status: 500 }
    );
  }
}
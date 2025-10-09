import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { validateCrossGameConflicts } from '@/lib/validation';
import { auditLogger } from '@/lib/audit';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth(request);
    const gameId = params.id;
    const body = await request.json();
    const {
      timeSlotId,
      participantId,
      participantType,
      side, // 'A' or 'B'
      startTime,
      endTime,
      timelineId = 1
    } = body;

    // Validate date strings before creating Date objects
    if (!startTime || !endTime) {
      return NextResponse.json(
        { error: 'startTime and endTime are required' },
        { status: 400 }
      );
    }

    const startTimeDate = new Date(startTime);
    const endTimeDate = new Date(endTime);

    if (isNaN(startTimeDate.getTime()) || isNaN(endTimeDate.getTime())) {
      return NextResponse.json(
        { error: 'Invalid date format for startTime or endTime' },
        { status: 400 }
      );
    }

    // Check if user is registered for this game
    const userRegistration = await prisma.registration.findFirst({
      where: {
        gameId,
        userId: user.id
      },
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
    });

    if (!userRegistration) {
      return NextResponse.json({ error: 'You are not registered for this game' }, { status: 403 });
    }

    // Validate that the user can only schedule their own matches
    if (participantType === 'TEAM') {
      // For team matches, check if the user is the team leader and the team ID matches
      if (!userRegistration.team || userRegistration.team.id !== participantId) {
        return NextResponse.json({ error: 'You can only schedule matches for your own team' }, { status: 403 });
      }
      // Additional check: user must be the team leader (the one who created the registration)
      if (userRegistration.user.id !== user.id) {
        return NextResponse.json({ error: 'Only the team leader can schedule team matches' }, { status: 403 });
      }
    } else if (participantType === 'USER') {
      // For individual matches, check if the user ID matches
      if (participantId !== user.id) {
        return NextResponse.json({ error: 'You can only schedule your own matches' }, { status: 403 });
      }
    }

    // Get game details to check contest type
    const game = await prisma.game.findUnique({
      where: { id: gameId },
      select: { contestType: true }
    });

    if (!game) {
      return NextResponse.json(
        { error: 'Game not found' },
        { status: 404 }
      );
    }

    // Check if participant is already scheduled in another slot
    let existingParticipantMatch;
    
    if (game.contestType === 'SINGLE_ELIMINATION_1V1V1V1') {
      // For 1v1v1v1 format, we need to check JSON data
      const allMatches = await prisma.match.findMany({
        where: { gameId },
        include: { slot: true }
      });
      
      existingParticipantMatch = allMatches.find(match => {
        // Check participantAId JSON for participants 1 and 2
        if (match.participantAType === 'FOUR_PARTICIPANT_DATA' && match.participantAId !== 'TBD') {
          try {
            const participantAData = JSON.parse(match.participantAId);
            if (participantAData.participant1Id === participantId || participantAData.participant2Id === participantId) {
              return true;
            }
          } catch (e) {
            // Ignore JSON parse errors
          }
        }
        
        // Check participantBId JSON for participants 3 and 4
        if (match.participantBType === 'FOUR_PARTICIPANT_DATA' && match.participantBId !== 'TBD') {
          try {
            const participantBData = JSON.parse(match.participantBId);
            if (participantBData.participant3Id === participantId || participantBData.participant4Id === participantId) {
              return true;
            }
          } catch (e) {
            // Ignore JSON parse errors
          }
        }
        
        return false;
      });
    } else {
      // Original logic for 2-participant matches
      existingParticipantMatch = await prisma.match.findFirst({
        where: {
          gameId,
          OR: [
            { participantAId: participantId },
            { participantBId: participantId }
          ],
          NOT: {
            OR: [
              { participantAId: 'TBD' },
              { participantBId: 'TBD' }
            ]
          }
        },
        include: { slot: true }
      });
    }

    if (existingParticipantMatch) {
      // Check if this is the same slot we're trying to schedule to
      const targetSlot = await prisma.slot.findFirst({
        where: {
          gameId,
          startTime: startTimeDate,
          endTime: endTimeDate,
          timelineId: timelineId
        }
      });

      // If participant is already in a different slot, prevent scheduling
      if (targetSlot && existingParticipantMatch.slotId !== targetSlot.id) {
        return NextResponse.json(
          { error: 'You are already scheduled in another time slot' },
          { status: 400 }
        );
      }
    }

    // Cross-game time overlap validation using helper function
    const conflictResult = await validateCrossGameConflicts({
      participantId,
      participantType: participantType as 'USER' | 'TEAM',
      gameId,
      startTime: startTimeDate,
      endTime: endTimeDate,
      teamMembers: userRegistration.team?.members
    }, prisma);

    if (conflictResult.hasConflict) {
      return NextResponse.json({
        error: conflictResult.conflictMessage
      }, { status: 409 });
    }

    // First, ensure the slot exists
    let slot = await prisma.slot.findFirst({
      where: {
        gameId,
        startTime: startTimeDate,
        endTime: endTimeDate,
        timelineId: timelineId
      }
    });

    if (!slot) {
      // Create the slot if it doesn't exist
      const capacity = game.contestType === 'SINGLE_ELIMINATION_1V1V1V1' ? 4 : 2;
      slot = await prisma.slot.create({
        data: {
          gameId,
          startTime: startTimeDate,
          endTime: endTimeDate,
          timelineId: timelineId,
          capacity: capacity,
          published: false
        }
      });
    }

    // Check if a match already exists for this slot
    let match = await prisma.match.findFirst({
      where: {
        gameId,
        slotId: slot.id
      }
    });

    if (match) {
      // Update existing match
      const updateData: any = {};
      
      if (game.contestType === 'SINGLE_ELIMINATION_1V1V1V1') {
        // Handle 1v1v1v1 format with JSON storage
        if (side === 'A' || side === 'B') {
          // Check if the specific slot position is already occupied
          if (match.participantAType === 'FOUR_PARTICIPANT_DATA' && match.participantAId !== 'TBD') {
            try {
              const participantAData = JSON.parse(match.participantAId);
              if (side === 'A' && participantAData.participant1Id && participantAData.participant1Id !== 'TBD') {
                return NextResponse.json(
                  { error: 'This slot position is already occupied by another participant' },
                  { status: 400 }
                );
              }
              if (side === 'B' && participantAData.participant2Id && participantAData.participant2Id !== 'TBD') {
                return NextResponse.json(
                  { error: 'This slot position is already occupied by another participant' },
                  { status: 400 }
                );
              }
            } catch (e) {
              // If JSON parsing fails, continue with validation
            }
          }
          
          // Participants 1 and 2 go into participantAId as JSON
          let participantAData: any = {};
          
          // Parse existing data if it exists
          if (match.participantAType === 'FOUR_PARTICIPANT_DATA' && match.participantAId !== 'TBD') {
            try {
              participantAData = JSON.parse(match.participantAId);
            } catch (e) {
              participantAData = {};
            }
          }
          
          if (side === 'A') {
            participantAData.participant1Id = participantId;
            participantAData.participant1Type = participantType;
          } else if (side === 'B') {
            participantAData.participant2Id = participantId;
            participantAData.participant2Type = participantType;
          }
          
          updateData.participantAId = JSON.stringify(participantAData);
          updateData.participantAType = 'FOUR_PARTICIPANT_DATA';
        } else {
          // Check if the specific slot position is already occupied
          if (match.participantBType === 'FOUR_PARTICIPANT_DATA' && match.participantBId !== 'TBD') {
            try {
              const participantBData = JSON.parse(match.participantBId);
              if (side === 'C' && participantBData.participant3Id && participantBData.participant3Id !== 'TBD') {
                return NextResponse.json(
                  { error: 'This slot position is already occupied by another participant' },
                  { status: 400 }
                );
              }
              if (side === 'D' && participantBData.participant4Id && participantBData.participant4Id !== 'TBD') {
                return NextResponse.json(
                  { error: 'This slot position is already occupied by another participant' },
                  { status: 400 }
                );
              }
            } catch (e) {
              // If JSON parsing fails, continue with validation
            }
          }
          
          // Participants 3 and 4 go into participantBId as JSON
          let participantBData: any = {};
          
          // Parse existing data if it exists
          if (match.participantBType === 'FOUR_PARTICIPANT_DATA' && match.participantBId !== 'TBD') {
            try {
              participantBData = JSON.parse(match.participantBId);
            } catch (e) {
              participantBData = {};
            }
          }
          
          if (side === 'C') {
            participantBData.participant3Id = participantId;
            participantBData.participant3Type = participantType;
          } else if (side === 'D') {
            participantBData.participant4Id = participantId;
            participantBData.participant4Type = participantType;
          }
          
          updateData.participantBId = JSON.stringify(participantBData);
          updateData.participantBType = 'FOUR_PARTICIPANT_DATA';
        }
      } else {
        // Original logic for 2-participant matches
        // Check for self-scheduling before updating existing match
        if (side === 'A' && match.participantBId && match.participantBId !== 'TBD' && match.participantBId === participantId) {
          return NextResponse.json(
            { error: 'You cannot be scheduled to play against yourself' },
            { status: 400 }
          );
        } else if (side === 'B' && match.participantAId && match.participantAId !== 'TBD' && match.participantAId === participantId) {
          return NextResponse.json(
            { error: 'You cannot be scheduled to play against yourself' },
            { status: 400 }
          );
        }
        
        if (side === 'A') {
          updateData.participantAId = participantId;
          updateData.participantAType = participantType;
        } else {
          updateData.participantBId = participantId;
          updateData.participantBType = participantType;
        }
      }

      match = await prisma.match.update({
        where: { id: match.id },
        data: updateData
      });
    } else {
      // Create new match
      const matchData: any = {
        gameId,
        slotId: slot.id
      };

      if (game.contestType === 'SINGLE_ELIMINATION_1V1V1V1') {
        // Handle 1v1v1v1 format
        if (side === 'A' || side === 'B') {
          // Participants 1 and 2 go into participantAId as JSON
          const participantAData: any = {};
          
          if (side === 'A') {
            participantAData.participant1Id = participantId;
            participantAData.participant1Type = participantType;
          } else if (side === 'B') {
            participantAData.participant2Id = participantId;
            participantAData.participant2Type = participantType;
          }
          
          matchData.participantAId = JSON.stringify(participantAData);
          matchData.participantAType = 'FOUR_PARTICIPANT_DATA';
          matchData.participantBId = 'TBD';
          matchData.participantBType = 'PLACEHOLDER';
        } else {
          // Participants 3 and 4 go into participantBId as JSON
          const participantBData: any = {};
          
          if (side === 'C') {
            participantBData.participant3Id = participantId;
            participantBData.participant3Type = participantType;
          } else if (side === 'D') {
            participantBData.participant4Id = participantId;
            participantBData.participant4Type = participantType;
          }
          
          matchData.participantAId = 'TBD';
          matchData.participantAType = 'PLACEHOLDER';
          matchData.participantBId = JSON.stringify(participantBData);
          matchData.participantBType = 'FOUR_PARTICIPANT_DATA';
        }
      } else {
        // Original logic for 2-participant matches
        if (side === 'A') {
          matchData.participantAId = participantId;
          matchData.participantAType = participantType;
          matchData.participantBId = 'TBD';
          matchData.participantBType = 'PLACEHOLDER';
        } else {
          matchData.participantAId = 'TBD';
          matchData.participantAType = 'PLACEHOLDER';
          matchData.participantBId = participantId;
          matchData.participantBType = participantType;
        }
      }

      if (!matchData.participantAId || !matchData.participantAType ||
          !matchData.participantBId || !matchData.participantBType) {
        console.error('Missing required match data:', matchData);
        return NextResponse.json(
          { error: 'Missing required participant data' },
          { status: 400 }
        );
      }

      match = await prisma.match.create({
        data: matchData
      });

      // Get game name for audit logging
      const gameForAudit = await prisma.game.findUnique({
        where: { id: gameId },
        select: { name: true }
      });

      // Log the match scheduling action
      await auditLogger.log(
        user.id,
        'match.scheduled',
        'match',
        match.id,
        {
          gameId,
          gameName: gameForAudit?.name || 'Unknown Game',
          participantType,
          participantId,
          side,
          timeSlot: `${startTimeDate.toLocaleTimeString()} - ${endTimeDate.toLocaleTimeString()}`,
          timelineId
        }
      );
    }

    return NextResponse.json({
      success: true,
      match,
      slot
    });

  } catch (error) {
    console.error('Error creating/updating match:', error);
    
    if (error instanceof Error && error.message === 'Authentication required') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    
    return NextResponse.json(
      { error: 'Failed to create/update match' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth(request);
    const gameId = params.id;
    const { searchParams } = new URL(request.url);
    const timelineId = searchParams.get('timelineId');

    // Check if user is registered for this game
    const userRegistration = await prisma.registration.findFirst({
      where: {
        gameId,
        userId: user.id
      },
      include: {
        user: true,
        team: true
      }
    });

    if (!userRegistration) {
      return NextResponse.json({ error: 'You are not registered for this game' }, { status: 403 });
    }

    // Build where clause for timeline filtering
    const whereClause: any = { gameId };

    // Add timeline filter if specified
    if (timelineId) {
      whereClause.slot = {
        timelineId: parseInt(timelineId)
      };
    }

    // Get all matches for this game with their slots
    const matches = await prisma.match.findMany({
      where: whereClause,
      include: {
        slot: true
      },
      orderBy: {
        slot: {
          startTime: 'asc'
        }
      }
    });

    return NextResponse.json({
      success: true,
      matches
    });

  } catch (error) {
    console.error('Error fetching matches:', error);
    
    if (error instanceof Error && error.message === 'Authentication required') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch matches' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth(request);
    const gameId = params.id;
    const { searchParams } = new URL(request.url);
    const matchId = searchParams.get('matchId');
    const side = searchParams.get('side'); // 'A' or 'B'

    if (!matchId) {
      return NextResponse.json(
        { error: 'Match ID is required' },
        { status: 400 }
      );
    }

    // Check if user is registered for this game
    const userRegistration = await prisma.registration.findFirst({
      where: {
        gameId,
        userId: user.id
      },
      include: {
        user: true,
        team: true
      }
    });

    if (!userRegistration) {
      return NextResponse.json({ error: 'You are not registered for this game' }, { status: 403 });
    }

    // Get game details to check contest type
    const game = await prisma.game.findUnique({
      where: { id: gameId },
      select: { contestType: true }
    });

    if (!game) {
      return NextResponse.json(
        { error: 'Game not found' },
        { status: 404 }
      );
    }

    // Find the match
    const match = await prisma.match.findFirst({
      where: {
        id: matchId,
        gameId
      },
      include: {
        slot: true
      }
    });

    if (!match) {
      return NextResponse.json(
        { error: 'Match not found' },
        { status: 404 }
      );
    }

    // Validate that the user can only unschedule their own matches
    const userParticipantId = userRegistration.mode === 'TEAM' && userRegistration.team
      ? userRegistration.team.id
      : user.id;
    
    let canUnschedule = false;
    let canUnscheduleA = false;
    let canUnscheduleB = false;
    let canUnscheduleC = false;
    let canUnscheduleD = false;

    if (game.contestType === 'SINGLE_ELIMINATION_1V1V1V1') {
      // Check JSON data for 1v1v1v1 format
      if (match.participantAType === 'FOUR_PARTICIPANT_DATA' && match.participantAId !== 'TBD') {
        try {
          const participantAData = JSON.parse(match.participantAId);
          canUnscheduleA = participantAData.participant1Id === userParticipantId;
          canUnscheduleB = participantAData.participant2Id === userParticipantId;
        } catch (e) {
          // Ignore JSON parse errors
        }
      }
      
      if (match.participantBType === 'FOUR_PARTICIPANT_DATA' && match.participantBId !== 'TBD') {
        try {
          const participantBData = JSON.parse(match.participantBId);
          canUnscheduleC = participantBData.participant3Id === userParticipantId;
          canUnscheduleD = participantBData.participant4Id === userParticipantId;
        } catch (e) {
          // Ignore JSON parse errors
        }
      }
      
      canUnschedule = canUnscheduleA || canUnscheduleB || canUnscheduleC || canUnscheduleD;
    } else {
      // Original logic for 2-participant matches
      canUnscheduleA = match.participantAId === userParticipantId;
      canUnscheduleB = match.participantBId === userParticipantId;
      canUnschedule = canUnscheduleA || canUnscheduleB;
    }
    
    if (!canUnschedule) {
      return NextResponse.json({ error: 'You can only unschedule your own matches' }, { status: 403 });
    }

    // If side is specified, validate that the user can unschedule that side
    if (side === 'A' && !canUnscheduleA) {
      return NextResponse.json({ error: 'You cannot unschedule this participant' }, { status: 403 });
    }
    if (side === 'B' && !canUnscheduleB) {
      return NextResponse.json({ error: 'You cannot unschedule this participant' }, { status: 403 });
    }
    if (side === 'C' && !canUnscheduleC) {
      return NextResponse.json({ error: 'You cannot unschedule this participant' }, { status: 403 });
    }
    if (side === 'D' && !canUnscheduleD) {
      return NextResponse.json({ error: 'You cannot unschedule this participant' }, { status: 403 });
    }

    if (side === 'A' || side === 'B' || side === 'C' || side === 'D') {
      // Remove one participant
      const updateData: any = {};
      
      if (game.contestType === 'SINGLE_ELIMINATION_1V1V1V1') {
        // Handle 1v1v1v1 format JSON removal
        if (side === 'A' || side === 'B') {
          // Remove from participantAId JSON
          let participantAData: any = {};
          if (match.participantAType === 'FOUR_PARTICIPANT_DATA' && match.participantAId !== 'TBD') {
            try {
              participantAData = JSON.parse(match.participantAId);
            } catch (e) {
              participantAData = {};
            }
          }
          
          if (side === 'A') {
            delete participantAData.participant1Id;
            delete participantAData.participant1Type;
          } else if (side === 'B') {
            delete participantAData.participant2Id;
            delete participantAData.participant2Type;
          }
          
          // Check if participantAData is now empty
          const hasParticipant1 = participantAData.participant1Id && participantAData.participant1Id !== 'TBD';
          const hasParticipant2 = participantAData.participant2Id && participantAData.participant2Id !== 'TBD';
          
          if (!hasParticipant1 && !hasParticipant2) {
            updateData.participantAId = 'TBD';
            updateData.participantAType = 'PLACEHOLDER';
          } else {
            updateData.participantAId = JSON.stringify(participantAData);
            updateData.participantAType = 'FOUR_PARTICIPANT_DATA';
          }
        } else {
          // Remove from participantBId JSON
          let participantBData: any = {};
          if (match.participantBType === 'FOUR_PARTICIPANT_DATA' && match.participantBId !== 'TBD') {
            try {
              participantBData = JSON.parse(match.participantBId);
            } catch (e) {
              participantBData = {};
            }
          }
          
          if (side === 'C') {
            delete participantBData.participant3Id;
            delete participantBData.participant3Type;
          } else if (side === 'D') {
            delete participantBData.participant4Id;
            delete participantBData.participant4Type;
          }
          
          // Check if participantBData is now empty
          const hasParticipant3 = participantBData.participant3Id && participantBData.participant3Id !== 'TBD';
          const hasParticipant4 = participantBData.participant4Id && participantBData.participant4Id !== 'TBD';
          
          if (!hasParticipant3 && !hasParticipant4) {
            updateData.participantBId = 'TBD';
            updateData.participantBType = 'PLACEHOLDER';
          } else {
            updateData.participantBId = JSON.stringify(participantBData);
            updateData.participantBType = 'FOUR_PARTICIPANT_DATA';
          }
        }
        
        // Check if both sides would be empty after this removal
        const aWouldBeEmpty = (updateData.participantAId === 'TBD') || (match.participantAId === 'TBD' && (side === 'C' || side === 'D'));
        const bWouldBeEmpty = (updateData.participantBId === 'TBD') || (match.participantBId === 'TBD' && (side === 'A' || side === 'B'));
        
        if (aWouldBeEmpty && bWouldBeEmpty) {
          // Delete the entire match if both sides would be empty
          await prisma.match.delete({
            where: { id: matchId }
          });
          
          // Log match unscheduling
          await auditLogger.log(
            user.id,
            'match.unscheduled',
            'match',
            matchId,
            {
              gameId,
              slotTime: match.slot ? `${match.slot.startTime} - ${match.slot.endTime}` : 'Unknown',
              reason: 'Complete match deletion - all participants removed',
              contestType: game.contestType,
              side
            }
          );
        } else {
          // Just update the match to remove one participant
          await prisma.match.update({
            where: { id: matchId },
            data: updateData
          });
          
          // Log participant removal
          await auditLogger.log(
            user.id,
            'match.unscheduled',
            'match',
            matchId,
            {
              gameId,
              slotTime: match.slot ? `${match.slot.startTime} - ${match.slot.endTime}` : 'Unknown',
              reason: `Participant removed from side ${side}`,
              contestType: game.contestType,
              side
            }
          );
        }
      } else {
        // Original logic for 2-participant matches
        if (side === 'A') {
          updateData.participantAId = 'TBD';
          updateData.participantAType = 'PLACEHOLDER';
        } else {
          updateData.participantBId = 'TBD';
          updateData.participantBType = 'PLACEHOLDER';
        }

        // Check if both sides would be empty after this removal
        const wouldBeEmpty = (side === 'A' && (match.participantBId === 'TBD' || !match.participantBId)) ||
                            (side === 'B' && (match.participantAId === 'TBD' || !match.participantAId));

        if (wouldBeEmpty) {
          // Delete the entire match if both sides would be empty
          await prisma.match.delete({
            where: { id: matchId }
          });
          
          // Log match unscheduling
          await auditLogger.log(
            user.id,
            'match.unscheduled',
            'match',
            matchId,
            {
              gameId,
              slotTime: match.slot ? `${match.slot.startTime} - ${match.slot.endTime}` : 'Unknown',
              reason: 'Complete match deletion - all participants removed',
              contestType: game.contestType,
              side
            }
          );
        } else {
          // Just update the match to remove one participant
          await prisma.match.update({
            where: { id: matchId },
            data: updateData
          });
          
          // Log participant removal
          await auditLogger.log(
            user.id,
            'match.unscheduled',
            'match',
            matchId,
            {
              gameId,
              slotTime: match.slot ? `${match.slot.startTime} - ${match.slot.endTime}` : 'Unknown',
              reason: `Participant removed from side ${side}`,
              contestType: game.contestType,
              side
            }
          );
        }
      }
    } else {
      // Delete entire match (only if user is involved in the match)
      await prisma.match.delete({
        where: { id: matchId }
      });
      
      // Log match unscheduling
      await auditLogger.log(
        user.id,
        'match.unscheduled',
        'match',
        matchId,
        {
          gameId,
          slotTime: match.slot ? `${match.slot.startTime} - ${match.slot.endTime}` : 'Unknown',
          reason: 'Complete match deletion',
          contestType: game.contestType
        }
      );
    }

    return NextResponse.json({
      success: true
    });

  } catch (error) {
    console.error('Error deleting match participant:', error);
    
    if (error instanceof Error && error.message === 'Authentication required') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    
    return NextResponse.json(
      { error: 'Failed to delete match participant' },
      { status: 500 }
    );
  }
}
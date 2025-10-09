import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { ContestValidator, ParticipantStatus, MatchResult } from '@/lib/contest-validation';
import { sendMatchScheduledNotification } from '@/lib/email/match-notification';
import { validateCrossGameConflicts } from '@/lib/validation';
import { auditLogger } from '@/lib/audit';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const gameId = params.id;
    const body = await request.json();
    const {
      timeSlotId,
      participantId,
      participantType,
      side, // 'A', 'B', 'C', or 'D' for 1v1v1v1
      startTime,
      endTime,
      timelineId = 1, // Default to timeline 1 if not provided
      overrideConflicts = false // Admin override flag
    } = body;

    console.log('📥 Received match scheduling request:', {
      timeSlotId,
      participantId,
      participantType,
      side,
      startTime,
      endTime,
      gameId,
      overrideConflicts
    });

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

    // Get existing matches to build participant status
    const existingMatches = await prisma.match.findMany({
      where: { gameId },
      include: { slot: true }
    });

    // Build participant statuses for validation
    const participantStatuses = await buildParticipantStatuses(gameId, existingMatches);
    const existingMatchResults: MatchResult[] = existingMatches.map(match => {
      let participantAId = match.participantAId;
      let participantBId = match.participantBId;
      let participantCId: string | undefined;
      let participantDId: string | undefined;
      
      // Extract participants 1 and 2 from JSON if it's a 1v1v1v1 match
      if (match.participantAType === 'FOUR_PARTICIPANT_DATA' && match.participantAId) {
        try {
          const participantAData = JSON.parse(match.participantAId);
          participantAId = participantAData.participant1Id || match.participantAId;
          participantBId = participantAData.participant2Id || match.participantBId;
        } catch (e) {
          // If parsing fails, use original values
        }
      }
      
      // Extract participants 3 and 4 from JSON if it's a 1v1v1v1 match
      if (match.participantBType === 'FOUR_PARTICIPANT_DATA' && match.participantBId) {
        try {
          const participantBData = JSON.parse(match.participantBId);
          participantCId = participantBData.participant3Id;
          participantDId = participantBData.participant4Id;
        } catch (e) {
          // If parsing fails, leave undefined
        }
      }
      
      return {
        id: match.id,
        participantAId,
        participantBId,
        participantCId,
        participantDId,
        winnerId: match.winnerId || undefined,
        isCompleted: !!match.winnerId,
        contestType: game.contestType
      };
    });

    // Validate if participant can be scheduled
    const validationResult = ContestValidator.canParticipantBeScheduled(
      participantId,
      game.contestType,
      participantStatuses,
      existingMatchResults
    );

    if (!validationResult.canSchedule) {
      return NextResponse.json(
        { error: validationResult.reason },
        { status: 400 }
      );
    }

    // Check if participant is already scheduled in another slot
    const existingParticipantMatch = await prisma.match.findFirst({
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

    if (existingParticipantMatch && !overrideConflicts) {
      // Check if this is the same slot we're trying to schedule to
      const targetSlot = await prisma.slot.findFirst({
        where: {
          gameId,
          startTime: startTimeDate,
          endTime: endTimeDate,
          timelineId: timelineId
        }
      });

      // For single elimination, allow participants to be scheduled in different slots (tournament progression)
      // For other contest types, prevent scheduling in different slots
      if (targetSlot && existingParticipantMatch.slotId !== targetSlot.id) {
        // For single elimination, only prevent if the existing match has both real participants and no winner
        // Matches with TBD opponents are not considered "active" matches
        const hasRealOpponent = (existingParticipantMatch.participantAId !== 'TBD' && existingParticipantMatch.participantBId !== 'TBD');
        if (!existingParticipantMatch.winnerId && hasRealOpponent) {
          return NextResponse.json(
            { error: 'Participant has an incomplete match and cannot be scheduled in another time slot' },
            { status: 400 }
          );
        }
      }
    }

    // Validate cross-game conflicts for real participants (not TBD)
    console.log('Checking cross-game conflicts for participant:', participantId, 'type:', participantType);
    if (participantId !== 'TBD') {
      // Get team member information if it's a team
      let teamMembers = undefined;
      if (participantType === 'TEAM') {
        const teamData = await prisma.team.findUnique({
          where: { id: participantId },
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

      // Validate cross-game conflicts (skip if admin override is enabled)
      if (!overrideConflicts) {
        console.log('🚀 About to validate cross-game conflicts for:', {
          participantId,
          participantType,
          gameId,
          startTime: startTimeDate.toISOString(),
          endTime: endTimeDate.toISOString(),
          hasTeamMembers: !!teamMembers
        });
        
        const conflictResult = await validateCrossGameConflicts({
          participantId,
          participantType: participantType as 'USER' | 'TEAM',
          gameId,
          startTime: startTimeDate,
          endTime: endTimeDate,
          teamMembers
        }, prisma);

        console.log('Conflict validation result:', conflictResult);
        if (conflictResult.hasConflict) {
          console.log('CONFLICT DETECTED - returning error:', conflictResult.conflictMessage);
          return NextResponse.json(
            { error: conflictResult.conflictMessage },
            { status: 409 }
          );
        }
      } else {
        console.log('ADMIN OVERRIDE: Skipping conflict validation for participant:', participantId);
      }
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
      // Set capacity based on contest type
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
      // Handle 1v1v1v1 format differently
      if (game.contestType === 'SINGLE_ELIMINATION_1V1V1V1') {
        // For 1v1v1v1, check if participant is already in the match
        let existingParticipants = [];
        
        // Add participantA if it exists
        if (match.participantAId && match.participantAId !== 'TBD') {
          existingParticipants.push(match.participantAId);
        }
        
        // Add participantB if it exists (for side B)
        if (match.participantBId && match.participantBId !== 'TBD') {
          try {
            // Try to parse as JSON for participants C and D
            const fourParticipantData = JSON.parse(match.participantBId);
            if (fourParticipantData.participantCId) existingParticipants.push(fourParticipantData.participantCId);
            if (fourParticipantData.participantDId) existingParticipants.push(fourParticipantData.participantDId);
          } catch (e) {
            // If not JSON, treat as regular participant B
            existingParticipants.push(match.participantBId);
          }
        }
        
        if (existingParticipants.includes(participantId)) {
          return NextResponse.json(
            { error: 'Participant is already scheduled in this time slot' },
            { status: 400 }
          );
        }
        
        if (existingParticipants.length >= 4) {
          return NextResponse.json(
            { error: 'This match already has 4 participants' },
            { status: 400 }
          );
        }
        
        // Check if the specific slot position is already occupied for 1v1v1v1 format
        if (side === 'A' || side === 'B') {
          // Check participantAId JSON for participants 1 and 2
          if (match.participantAType === 'FOUR_PARTICIPANT_DATA' && match.participantAId !== 'TBD') {
            try {
              const participantAData = JSON.parse(match.participantAId);
              if (side === 'A' && participantAData.participant1Id && participantAData.participant1Id !== 'TBD') {
                return NextResponse.json(
                  { error: 'This slot position is already occupied by another participant 1' },
                  { status: 400 }
                );
              }
              if (side === 'B' && participantAData.participant2Id && participantAData.participant2Id !== 'TBD') {
                return NextResponse.json(
                  { error: 'This slot position is already occupied by another participant 2' },
                  { status: 400 }
                );
              }
            } catch (e) {
              // If JSON parsing fails, continue with validation
            }
          }
        } else if (side === 'C' || side === 'D') {
          // Check participantBId JSON for participants 3 and 4
          if (match.participantBType === 'FOUR_PARTICIPANT_DATA' && match.participantBId !== 'TBD') {
            try {
              const participantBData = JSON.parse(match.participantBId);
              if (side === 'C' && participantBData.participant3Id && participantBData.participant3Id !== 'TBD') {
                return NextResponse.json(
                  { error: 'This slot position is already occupied by another participant 3' },
                  { status: 400 }
                );
              }
              if (side === 'D' && participantBData.participant4Id && participantBData.participant4Id !== 'TBD') {
                return NextResponse.json(
                  { error: 'This slot position is already occupied by another participant 4' },
                  { status: 400 }
                );
              }
            } catch (e) {
              // If JSON parsing fails, continue with validation
            }
          }
        }
      } else {
        // Original logic for 2-participant matches
        if ((side === 'A' && match.participantAId === participantId) ||
            (side === 'B' && match.participantBId === participantId)) {
          return NextResponse.json(
            { error: 'Participant is already scheduled in this time slot' },
            { status: 400 }
          );
        }

        // Check if there's already a real participant in the target side
        if (side === 'A' && match.participantAId && match.participantAId !== 'TBD') {
          return NextResponse.json(
            { error: 'This slot position is already occupied by another participant 5' },
            { status: 400 }
          );
        } else if (side === 'B' && match.participantBId && match.participantBId !== 'TBD') {
          return NextResponse.json(
            { error: 'This slot position is already occupied by another participant 6' },
            { status: 400 }
          );
        }
      }

      // For existing matches, validate the pairing if both sides will be filled
      // Skip this validation for 1v1v1v1 format as it uses JSON storage
      if (game.contestType !== 'SINGLE_ELIMINATION_1V1V1V1') {
        if (side === 'A' && match.participantBId && match.participantBId !== 'TBD') {
          const pairingValidation = ContestValidator.canParticipantsBeMatched(
            participantId,
            match.participantBId,
            game.contestType,
            participantStatuses,
            existingMatchResults
          );
          
          if (!pairingValidation.canMatch) {
            return NextResponse.json(
              { error: pairingValidation.reason },
              { status: 400 }
            );
          }
        } else if (side === 'B' && match.participantAId && match.participantAId !== 'TBD') {
          const pairingValidation = ContestValidator.canParticipantsBeMatched(
            match.participantAId,
            participantId,
            game.contestType,
            participantStatuses,
            existingMatchResults
          );
          
          if (!pairingValidation.canMatch) {
            return NextResponse.json(
              { error: pairingValidation.reason },
              { status: 400 }
            );
          }
        }
      }

      // Update existing match
      const updateData: any = {};
      
      if (game.contestType === 'SINGLE_ELIMINATION_1V1V1V1') {
        // Handle 1v1v1v1 format
        if (side === 'A' || side === 'B') {
          // Participants 1 and 2 go into participantAId as JSON
          let participantAData: any = {};
          
          // Parse existing data if it exists and is JSON
          if (match.participantAId && match.participantAId !== 'TBD') {
            try {
              participantAData = JSON.parse(match.participantAId);
            } catch (e) {
              // If not JSON, reset to empty structure
              participantAData = {};
            }
          }
          
          // Add new participant
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
          // Participants 3 and 4 go into participantBId as JSON
          let participantBData: any = {};
          
          // Parse existing data if it exists and is JSON
          if (match.participantBId && match.participantBId !== 'TBD') {
            try {
              participantBData = JSON.parse(match.participantBId);
            } catch (e) {
              // If not JSON, reset to empty structure
              participantBData = {};
            }
          }
          
          // Add new participant
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

      // Validate that all required fields are present and not undefined
      if (!matchData.participantAId || !matchData.participantAType ||
          !matchData.participantBId || !matchData.participantBType) {
        console.error('Missing required match data:', matchData);
        return NextResponse.json(
          { error: 'Missing required participant data' },
          { status: 400 }
        );
      }

      console.log('Creating match with data:', matchData);

      match = await prisma.match.create({
        data: matchData
      });
    }

    // Check if both participants are now real (not TBD) and send email notification
    const finalMatch = await prisma.match.findUnique({
      where: { id: match.id },
      include: {
        game: {
          include: {
            category: true
          }
        },
        slot: true
      }
    });

    // Check if all participants are scheduled and send email notification
    let shouldSendEmail = false;
    
    if (finalMatch && finalMatch.slot && finalMatch.game) {
      if (finalMatch.game.contestType === 'SINGLE_ELIMINATION_1V1V1V1') {
        // For 1v1v1v1 format, check if all 4 participants are real
        let realParticipantCount = 0;
        
        // Check participants 1 and 2 from participantAId JSON
        if (finalMatch.participantAType === 'FOUR_PARTICIPANT_DATA' && finalMatch.participantAId !== 'TBD') {
          try {
            const participantAData = JSON.parse(finalMatch.participantAId);
            if (participantAData.participant1Id && participantAData.participant1Type !== 'PLACEHOLDER') {
              realParticipantCount++;
            }
            if (participantAData.participant2Id && participantAData.participant2Type !== 'PLACEHOLDER') {
              realParticipantCount++;
            }
          } catch (error) {
            console.error('Error parsing participantAId JSON for email check:', error);
          }
        }
        
        // Check participants 3 and 4 from participantBId JSON
        if (finalMatch.participantBType === 'FOUR_PARTICIPANT_DATA' && finalMatch.participantBId !== 'TBD') {
          try {
            const participantBData = JSON.parse(finalMatch.participantBId);
            if (participantBData.participant3Id && participantBData.participant3Type !== 'PLACEHOLDER') {
              realParticipantCount++;
            }
            if (participantBData.participant4Id && participantBData.participant4Type !== 'PLACEHOLDER') {
              realParticipantCount++;
            }
          } catch (error) {
            console.error('Error parsing participantBId JSON for email check:', error);
          }
        }
        
        // For 1v1v1v1, need all 4 participants to be real
        shouldSendEmail = (realParticipantCount === 4);
        console.log(`1v1v1v1 match email check: ${realParticipantCount}/4 participants are real, shouldSendEmail: ${shouldSendEmail}`);
      } else if (finalMatch.game.contestType === 'SCORING') {
        // For scoring contests, only participant A is required
        shouldSendEmail = (
          finalMatch.participantAId !== 'TBD' &&
          finalMatch.participantAType !== 'PLACEHOLDER'
        );
        console.log(`Scoring contest email check: participantA=${finalMatch.participantAId}, shouldSendEmail: ${shouldSendEmail}`);
      } else {
        // For regular 2-participant matches, check if both participants are real
        shouldSendEmail = (
          finalMatch.participantAId !== 'TBD' &&
          finalMatch.participantBId !== 'TBD' &&
          finalMatch.participantAType !== 'PLACEHOLDER' &&
          finalMatch.participantBType !== 'PLACEHOLDER'
        );
        console.log(`Regular match email check: participantA=${finalMatch.participantAId}, participantB=${finalMatch.participantBId}, shouldSendEmail: ${shouldSendEmail}`);
      }
    }

    if (shouldSendEmail && finalMatch && finalMatch.slot && finalMatch.game) {
      // Send email notification asynchronously (don't wait for it to complete)
      // Pass the raw UTC datetime to the notification service
      // The notification service will handle timezone conversion per user
      const matchDateTime = finalMatch.slot.startTime; // Keep as UTC Date object

      const timelineName = `Timeline ${finalMatch.slot.timelineId}`;

      console.log(`Sending match scheduled notification for ${finalMatch.game.contestType} match: ${finalMatch.game.name}`);

      sendMatchScheduledNotification({
        gameId: finalMatch.gameId,
        gameName: finalMatch.game.name,
        categoryName: finalMatch.game.category?.name || 'Unknown Category',
        contestType: finalMatch.game.contestType,
        matchDateTime: matchDateTime, // Pass UTC datetime instead of formatted strings
        timelineName,
        participantAId: finalMatch.participantAId,
        participantAType: finalMatch.participantAType as 'USER' | 'TEAM' | 'PLACEHOLDER' | 'FOUR_PARTICIPANT_DATA',
        participantBId: finalMatch.participantBId,
        participantBType: finalMatch.participantBType as 'USER' | 'TEAM' | 'PLACEHOLDER' | 'FOUR_PARTICIPANT_DATA',
        eventId: finalMatch.game.category?.id
      }).catch(error => {
        console.error('Failed to send match scheduled notification:', error);
      });
    } else {
      console.log('Skipping email notification - not all participants are scheduled yet');
    }

    // Add audit logging for admin match scheduling
    const auditUser = await requireAuth(request);
    if (auditUser) {
      // Get game name for audit logging
      const gameForAudit = await prisma.game.findUnique({
        where: { id: gameId },
        select: { name: true }
      });

      await auditLogger.log(
        auditUser.id,
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
          timelineId,
          adminScheduled: true,
          overrideConflicts
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
    return NextResponse.json(
      { error: 'Failed to create/update match' },
      { status: 500 }
    );
  }
}

// Helper function to build participant statuses
async function buildParticipantStatuses(gameId: string, existingMatches: any[]): Promise<ParticipantStatus[]> {
  // Get all registrations for this game
  const registrations = await prisma.registration.findMany({
    where: { gameId },
    include: {
      user: true,
      team: true
    }
  });

  const participantStatuses: ParticipantStatus[] = [];

  for (const registration of registrations) {
    const participantId = registration.mode === 'TEAM' && registration.team
      ? registration.team.id
      : registration.user.id;
    
    const participantName = registration.mode === 'TEAM' && registration.team
      ? registration.team.name
      : `${registration.user.firstName} ${registration.user.lastName}`;

    // Calculate stats from existing matches
    let wins = 0;
    let losses = 0;
    let totalMatches = 0;
    let hasActiveMatch = false;
    let isEliminated = false;

    for (const match of existingMatches) {
      let isParticipantInMatch = false;
      
      // Check participantA (could be regular participant or JSON for participants 1 and 2)
      if (match.participantAType === 'FOUR_PARTICIPANT_DATA' && match.participantAId) {
        try {
          const participantAData = JSON.parse(match.participantAId);
          if (participantAData.participant1Id === participantId ||
              participantAData.participant2Id === participantId) {
            isParticipantInMatch = true;
          }
        } catch (e) {
          // If parsing fails, check as regular participant
          if (match.participantAId === participantId) {
            isParticipantInMatch = true;
          }
        }
      } else if (match.participantAId === participantId) {
        isParticipantInMatch = true;
      }
      
      // Check participantB (could be regular participant or JSON for participants 3 and 4)
      if (!isParticipantInMatch) {
        if (match.participantBType === 'FOUR_PARTICIPANT_DATA' && match.participantBId) {
          try {
            const participantBData = JSON.parse(match.participantBId);
            if (participantBData.participant3Id === participantId ||
                participantBData.participant4Id === participantId) {
              isParticipantInMatch = true;
            }
          } catch (e) {
            // If parsing fails, check as regular participant
            if (match.participantBId === participantId) {
              isParticipantInMatch = true;
            }
          }
        } else if (match.participantBId === participantId) {
          isParticipantInMatch = true;
        }
      }
      
      if (isParticipantInMatch) {
        if (match.winnerId) {
          totalMatches++;
          if (match.winnerId === participantId) {
            wins++;
          } else {
            losses++;
            // In single elimination, losing means elimination
            if (match.game?.contestType === 'SINGLE_ELIMINATION' || match.game?.contestType === 'SINGLE_ELIMINATION_1V1V1V1') {
              isEliminated = true;
            }
          }
        } else {
          // Match exists but no winner = active match
          // For 1v1v1v1 matches, check if there are enough participants for an active match
          if (match.game?.contestType === 'SINGLE_ELIMINATION_1V1V1V1') {
            // Count how many real participants are in the match
            let realParticipantCount = 0;
            
            // Check participantA data
            if (match.participantAType === 'FOUR_PARTICIPANT_DATA' && match.participantAId) {
              try {
                const participantAData = JSON.parse(match.participantAId);
                if (participantAData.participant1Id && participantAData.participant1Id !== 'TBD') realParticipantCount++;
                if (participantAData.participant2Id && participantAData.participant2Id !== 'TBD') realParticipantCount++;
              } catch (e) {
                // If parsing fails, check as regular participant
                if (match.participantAId && match.participantAId !== 'TBD') realParticipantCount++;
              }
            } else if (match.participantAId && match.participantAId !== 'TBD') {
              realParticipantCount++;
            }
            
            // Check participantB data
            if (match.participantBType === 'FOUR_PARTICIPANT_DATA' && match.participantBId) {
              try {
                const participantBData = JSON.parse(match.participantBId);
                if (participantBData.participant3Id && participantBData.participant3Id !== 'TBD') realParticipantCount++;
                if (participantBData.participant4Id && participantBData.participant4Id !== 'TBD') realParticipantCount++;
              } catch (e) {
                // If parsing fails, check as regular participant
                if (match.participantBId && match.participantBId !== 'TBD') realParticipantCount++;
              }
            } else if (match.participantBId && match.participantBId !== 'TBD') {
              realParticipantCount++;
            }
            
            // For 1v1v1v1, need at least 2 participants for an active match
            if (realParticipantCount >= 2) {
              hasActiveMatch = true;
            }
          } else {
            // Original logic for 2-participant matches
            const hasRealOpponent = (match.participantAId === participantId && match.participantBId && match.participantBId !== 'TBD') ||
                                   (match.participantBId === participantId && match.participantAId && match.participantAId !== 'TBD');
            if (hasRealOpponent) {
              hasActiveMatch = true;
            }
          }
        }
      }
    }

    participantStatuses.push({
      id: participantId,
      name: participantName,
      type: registration.mode === 'TEAM' ? 'team' : 'user',
      isEliminated,
      hasActiveMatch,
      wins,
      losses,
      totalMatches
    });
  }

  return participantStatuses;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const gameId = params.id;
    const body = await request.json();
    const { matchId, winnerId, winnerType, scoreNotes } = body;

    console.log('PATCH matches API received:', {
      matchId,
      winnerId,
      winnerType,
      scoreNotes,
      winnerIdType: typeof winnerId,
      winnerTypeType: typeof winnerType
    });

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

    // Get the match being updated
    const existingMatch = await prisma.match.findFirst({
      where: {
        id: matchId,
        gameId
      }
    });

    if (!existingMatch) {
      return NextResponse.json(
        { error: 'Match not found' },
        { status: 404 }
      );
    }

    // Update match with winner and score - explicitly handle undefined values
    const updateData: any = {
      winnerId: winnerId || null,
      winnerType: winnerType || null
    };

    // Add scoreNotes if provided (for scoring contests)
    if (scoreNotes !== undefined) {
      updateData.scoreNotes = scoreNotes;
    }

    const match = await prisma.match.update({
      where: {
        id: matchId,
        gameId
      },
      data: updateData
    });

    // If this is a single elimination match and we're setting a winner,
    // we need to handle bracket progression
    if (game.contestType === 'SINGLE_ELIMINATION' && winnerId) {
      console.log('Single elimination match completed:', {
        winnerId,
        participantAId: existingMatch.participantAId,
        participantBId: existingMatch.participantBId
      });
      
      // Find if there's a next round match that this winner should advance to
      await handleSingleEliminationProgression(gameId, existingMatch, winnerId, winnerType);
    }

    // TODO: Add audit logging

    return NextResponse.json({
      success: true,
      match,
      contestType: game.contestType
    });

  } catch (error) {
    console.error('Error updating match winner:', error);
    return NextResponse.json(
      { error: 'Failed to update match winner' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const gameId = params.id;
    const { searchParams } = new URL(request.url);
    const timelineId = searchParams.get('timelineId');

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
    // Require authentication for DELETE operations
    const user = await requireAuth(request);
    
    const gameId = params.id;
    const { searchParams } = new URL(request.url);
    const matchId = searchParams.get('matchId');
    const side = searchParams.get('side'); // 'A' or 'B'

    console.log('DELETE request - gameId:', gameId, 'matchId:', matchId, 'side:', side);

    if (!matchId) {
      return NextResponse.json(
        { error: 'Match ID is required' },
        { status: 400 }
      );
    }

    // First, let's find the match with more detailed logging
    const match = await prisma.match.findFirst({
      where: {
        id: matchId
      },
      include: {
        slot: true
      }
    });

    console.log('Found match:', match);

    if (!match) {
      console.log('Match not found with ID:', matchId);
      return NextResponse.json(
        { error: 'Match not found' },
        { status: 404 }
      );
    }

    // Verify the match belongs to the correct game
    if (match.gameId !== gameId) {
      console.log('Match gameId mismatch:', match.gameId, 'vs', gameId);
      return NextResponse.json(
        { error: 'Match not found in this game' },
        { status: 404 }
      );
    }

    // Check if this is a 1v1v1v1 match by looking at the game's contest type
    const game = await prisma.game.findUnique({
      where: { id: gameId },
      select: { contestType: true }
    });

    const is1v1v1v1 = game?.contestType === 'SINGLE_ELIMINATION_1V1V1V1';

    // If no side is specified, delete the entire match
    if (!side) {
      console.log('Deleting entire match:', matchId);
      await prisma.match.delete({
        where: { id: matchId }
      });
      
      return NextResponse.json({
        success: true
      });
    }

    if (is1v1v1v1) {
      // Handle 1v1v1v1 format - all participants are stored in JSON
      const updateData: any = {};
      
      if (side === 'A') {
        // Remove participant A (participant1) from participantAId JSON
        try {
          const participantAData = JSON.parse(match.participantAId || '{}');
          if (participantAData.participant2Id) {
            // Keep participant B, remove participant A
            const newParticipantAData = {
              participant2Id: participantAData.participant2Id,
              participant2Type: participantAData.participant2Type
            };
            updateData.participantAId = JSON.stringify(newParticipantAData);
          } else {
            // No participant B, set to TBD
            updateData.participantAId = 'TBD';
            updateData.participantAType = 'PLACEHOLDER';
          }
        } catch (error) {
          console.error('Error parsing participantAId JSON:', error);
          updateData.participantAId = 'TBD';
          updateData.participantAType = 'PLACEHOLDER';
        }
      } else if (side === 'B') {
        // Remove participant B (participant2) from participantAId JSON
        try {
          const participantAData = JSON.parse(match.participantAId || '{}');
          if (participantAData.participant1Id) {
            // Keep participant A, remove participant B
            const newParticipantAData = {
              participant1Id: participantAData.participant1Id,
              participant1Type: participantAData.participant1Type
            };
            updateData.participantAId = JSON.stringify(newParticipantAData);
          } else {
            // No participant A, set to TBD
            updateData.participantAId = 'TBD';
            updateData.participantAType = 'PLACEHOLDER';
          }
        } catch (error) {
          console.error('Error parsing participantAId JSON:', error);
          updateData.participantAId = 'TBD';
          updateData.participantAType = 'PLACEHOLDER';
        }
      } else if (side === 'C') {
        // Remove participant C (participant3) from participantBId JSON
        try {
          const participantBData = JSON.parse(match.participantBId || '{}');
          if (participantBData.participant4Id) {
            // Keep participant D, remove participant C
            const newParticipantBData = {
              participant4Id: participantBData.participant4Id,
              participant4Type: participantBData.participant4Type
            };
            updateData.participantBId = JSON.stringify(newParticipantBData);
          } else {
            // No participant D, set to TBD
            updateData.participantBId = 'TBD';
            updateData.participantBType = 'PLACEHOLDER';
          }
        } catch (error) {
          console.error('Error parsing participantBId JSON:', error);
          updateData.participantBId = 'TBD';
          updateData.participantBType = 'PLACEHOLDER';
        }
      } else if (side === 'D') {
        // Remove participant D (participant4) from participantBId JSON
        try {
          const participantBData = JSON.parse(match.participantBId || '{}');
          if (participantBData.participant3Id) {
            // Keep participant C, remove participant D
            const newParticipantBData = {
              participant3Id: participantBData.participant3Id,
              participant3Type: participantBData.participant3Type
            };
            updateData.participantBId = JSON.stringify(newParticipantBData);
          } else {
            // No participant C, set to TBD
            updateData.participantBId = 'TBD';
            updateData.participantBType = 'PLACEHOLDER';
          }
        } catch (error) {
          console.error('Error parsing participantBId JSON:', error);
          updateData.participantBId = 'TBD';
          updateData.participantBType = 'PLACEHOLDER';
        }
      }

      // Check if all participants would be empty after this removal
      let hasParticipant1 = false;
      let hasParticipant2 = false;
      try {
        const newParticipantAData = JSON.parse(updateData.participantAId || match.participantAId || '{}');
        hasParticipant1 = newParticipantAData.participant1Id && newParticipantAData.participant1Id !== 'TBD';
        hasParticipant2 = newParticipantAData.participant2Id && newParticipantAData.participant2Id !== 'TBD';
      } catch (error) {
        // If parsing fails, check if it's TBD
        hasParticipant1 = (updateData.participantAId || match.participantAId) !== 'TBD';
        hasParticipant2 = false;
      }
      
      let hasParticipant3 = false;
      let hasParticipant4 = false;
      try {
        const newParticipantBData = JSON.parse(updateData.participantBId || match.participantBId || '{}');
        hasParticipant3 = newParticipantBData.participant3Id && newParticipantBData.participant3Id !== 'TBD';
        hasParticipant4 = newParticipantBData.participant4Id && newParticipantBData.participant4Id !== 'TBD';
      } catch (error) {
        // If parsing fails, check if it's TBD
        hasParticipant3 = (updateData.participantBId || match.participantBId) !== 'TBD';
        hasParticipant4 = false;
      }

      const wouldBeEmpty = !hasParticipant1 && !hasParticipant2 && !hasParticipant3 && !hasParticipant4;

      if (wouldBeEmpty) {
        // Delete the entire match if all participants would be empty
        await prisma.match.delete({
          where: { id: matchId }
        });
      } else {
        // Just update the match to remove one participant
        await prisma.match.update({
          where: { id: matchId },
          data: updateData
        });
      }
    } else if (side === 'A' || side === 'B') {
      // Handle regular 2-participant match
      const updateData: any = {};
      
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
      } else {
        // Just update the match to remove one participant
        await prisma.match.update({
          where: { id: matchId },
          data: updateData
        });
      }
    } else if (side === 'C' || side === 'D') {
      // This should not happen for non-1v1v1v1 matches, but handle gracefully
      await prisma.match.delete({
        where: { id: matchId }
      });
    } else {
      // Delete entire match for unknown sides
      await prisma.match.delete({
        where: { id: matchId }
      });
    }

    // Add audit logging for admin match unscheduling
    const auditUser = await requireAuth(request);
    if (auditUser) {
      // Get game details for audit logging
      const gameForAudit = await prisma.game.findUnique({
        where: { id: gameId },
        select: { name: true, contestType: true }
      });

      await auditLogger.log(
        auditUser.id,
        'match.unscheduled',
        'match',
        matchId,
        {
          gameId,
          gameName: gameForAudit?.name || 'Unknown Game',
          slotTime: match.slot ? `${match.slot.startTime} - ${match.slot.endTime}` : 'Unknown',
          reason: side ? `Admin removed participant from side ${side}` : 'Admin deleted entire match',
          contestType: gameForAudit?.contestType,
          side,
          adminUnscheduled: true
        }
      );
    }

    return NextResponse.json({
      success: true
    });

  } catch (error) {
    console.error('Error deleting match participant:', error);
    return NextResponse.json(
      { error: 'Failed to delete match participant' },
      { status: 500 }
    );
  }
}

// Helper function to handle single elimination bracket progression
async function handleSingleEliminationProgression(
  gameId: string,
  completedMatch: any,
  winnerId: string,
  winnerType: string
) {
  try {
    // Get all matches for this game to understand the bracket structure
    const allMatches = await prisma.match.findMany({
      where: { gameId },
      include: { slot: true },
      orderBy: { slot: { startTime: 'asc' } }
    });

    // Organize matches into rounds based on time slots
    const matchesByTime = new Map<string, any[]>();
    allMatches.forEach(match => {
      if (match.slot) {
        const timeKey = match.slot.startTime.toISOString();
        if (!matchesByTime.has(timeKey)) {
          matchesByTime.set(timeKey, []);
        }
        matchesByTime.get(timeKey)!.push(match);
      }
    });

    // Sort time slots to identify rounds
    const sortedTimes = Array.from(matchesByTime.keys()).sort();
    const rounds: any[][] = sortedTimes.map(time => matchesByTime.get(time)!);

    // Find which round the completed match belongs to
    let completedMatchRound = -1;
    let completedMatchIndex = -1;
    
    for (let roundIndex = 0; roundIndex < rounds.length; roundIndex++) {
      const matchIndex = rounds[roundIndex].findIndex(m => m.id === completedMatch.id);
      if (matchIndex !== -1) {
        completedMatchRound = roundIndex;
        completedMatchIndex = matchIndex;
        break;
      }
    }

    if (completedMatchRound === -1) {
      console.log('Could not find completed match in rounds');
      return;
    }

    // Find the next round
    const nextRoundIndex = completedMatchRound + 1;
    if (nextRoundIndex >= rounds.length) {
      console.log('No next round found - tournament complete');
      return;
    }

    const nextRound = rounds[nextRoundIndex];
    
    // In single elimination, the winner advances to a specific position in the next round
    // The position is determined by the bracket structure:
    // - Match 0,1 in round N feed into match 0 in round N+1
    // - Match 2,3 in round N feed into match 1 in round N+1
    // - And so on...
    
    const nextMatchIndex = Math.floor(completedMatchIndex / 2);
    
    if (nextMatchIndex >= nextRound.length) {
      console.log('Next match index out of bounds:', nextMatchIndex, 'available matches:', nextRound.length);
      return;
    }

    const nextMatch = nextRound[nextMatchIndex];
    
    if (!nextMatch) {
      console.log('No next match found at index:', nextMatchIndex);
      return;
    }

    console.log('Advancing winner to next round:', {
      winnerId,
      fromMatch: completedMatch.id,
      fromRound: completedMatchRound,
      fromIndex: completedMatchIndex,
      toMatch: nextMatch.id,
      toRound: nextRoundIndex,
      toIndex: nextMatchIndex
    });

    // Determine which slot to fill in the next match
    // If completedMatchIndex is even, winner goes to participantA
    // If completedMatchIndex is odd, winner goes to participantB
    const updateData: any = {};
    
    if (completedMatchIndex % 2 === 0) {
      // Even index matches feed into participantA slot
      if (nextMatch.participantAId === 'TBD') {
        updateData.participantAId = winnerId;
        updateData.participantAType = winnerType;
      }
    } else {
      // Odd index matches feed into participantB slot
      if (nextMatch.participantBId === 'TBD') {
        updateData.participantBId = winnerId;
        updateData.participantBType = winnerType;
      }
    }

    // If the calculated slot is already filled, try the other slot
    if (Object.keys(updateData).length === 0) {
      if (nextMatch.participantAId === 'TBD') {
        updateData.participantAId = winnerId;
        updateData.participantAType = winnerType;
      } else if (nextMatch.participantBId === 'TBD') {
        updateData.participantBId = winnerId;
        updateData.participantBType = winnerType;
      }
    }

    if (Object.keys(updateData).length > 0) {
      await prisma.match.update({
        where: { id: nextMatch.id },
        data: updateData
      });
      
      console.log('Successfully advanced winner:', updateData);
    } else {
      console.log('No available slots in next match:', nextMatch.id);
    }

  } catch (error) {
    console.error('Error handling single elimination progression:', error);
    // Don't throw error to avoid breaking the main match update
  }
}
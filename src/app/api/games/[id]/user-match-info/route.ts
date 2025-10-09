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

    // Get game details with registrations for name resolution
    const game = await prisma.game.findUnique({
      where: { id: gameId },
      select: {
        id: true,
        name: true,
        contestType: true,
        typeFormat: true,
        allowDraws: true,
        matches: {
          include: {
            slot: true
          }
        },
        registrations: {
          include: {
            user: true,
            team: true
          }
        }
      }
    });

    if (!game) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    // For SINGLE_ELIMINATION_1V1V1V1, allowDraws represents oneLoserMode
    const oneLoserMode = game.contestType === 'SINGLE_ELIMINATION_1V1V1V1'
      ? game.allowDraws
      : false;

    // Determine participant ID based on registration type
    const participantId = userRegistration.mode === 'TEAM' && userRegistration.team
      ? userRegistration.team.id
      : user.id;

    // Helper function to resolve participant name
    const resolveParticipantName = (participantId: string, participantType: string): string => {
      if (participantId === 'TBD') return 'TBD';
      
      if (participantType === 'TEAM') {
        const teamRegistration = game.registrations.find(reg =>
          reg.team && reg.team.id === participantId
        );
        return teamRegistration?.team?.name || participantId;
      } else if (participantType === 'USER') {
        const userRegistration = game.registrations.find(reg =>
          reg.user.id === participantId
        );
        if (userRegistration) {
          const user = userRegistration.user;
          return `${user.firstName} ${user.lastName}`;
        }
        return participantId;
      }
      
      return participantId;
    };

    // Find user's matches based on contest type
    let userMatches = [];

    if (game.contestType === 'SINGLE_ELIMINATION_1V1V1V1') {
      // Handle 4-player single elimination
      userMatches = game.matches.filter(match => {
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
    } else if (game.contestType === 'SCORING') {
      // For scoring contests, find matches where user is a participant
      userMatches = game.matches.filter(match => 
        match.participantAId === participantId || match.participantBId === participantId
      );
    } else {
      // For regular 2-participant matches (single elimination, round robin)
      userMatches = game.matches.filter(match =>
        match.participantAId === participantId || match.participantBId === participantId
      );
    }

    // Process matches to get relevant info
    const matchInfo = userMatches.map(match => {
      const isCompleted = !!match.winnerId;
      // In oneLoserMode for 1v1v1v1, winnerId represents the LOSER, so invert the logic
      const isWinner = game.contestType === 'SINGLE_ELIMINATION_1V1V1V1' && oneLoserMode
        ? match.winnerId !== participantId && isCompleted
        : match.winnerId === participantId;
      
      let opponent = null;
      let userSide = null;

      if (game.contestType === 'SINGLE_ELIMINATION_1V1V1V1') {
        // For 4-player matches, we need to determine position and opponents
        let participantAData = null;
        let participantBData = null;
        
        try {
          if (match.participantAType === 'FOUR_PARTICIPANT_DATA' && match.participantAId !== 'TBD') {
            participantAData = JSON.parse(match.participantAId);
          }
          if (match.participantBType === 'FOUR_PARTICIPANT_DATA' && match.participantBId !== 'TBD') {
            participantBData = JSON.parse(match.participantBId);
          }
        } catch (e) {
          // Ignore JSON parse errors
        }

        // Determine user's position and opponents
        if (participantAData?.participant1Id === participantId) {
          userSide = 'A1';
          opponent = 'Multi-player match';
        } else if (participantAData?.participant2Id === participantId) {
          userSide = 'A2';
          opponent = 'Multi-player match';
        } else if (participantBData?.participant3Id === participantId) {
          userSide = 'B1';
          opponent = 'Multi-player match';
        } else if (participantBData?.participant4Id === participantId) {
          userSide = 'B2';
          opponent = 'Multi-player match';
        }
      } else if (game.contestType === 'SCORING') {
        // For scoring contests, it's individual performance
        opponent = 'Individual Contest';
        userSide = 'INDIVIDUAL';
      } else {
        // For regular 2-participant matches
        if (match.participantAId === participantId) {
          userSide = 'A';
          opponent = resolveParticipantName(match.participantBId, match.participantBType);
        } else {
          userSide = 'B';
          opponent = resolveParticipantName(match.participantAId, match.participantAType);
        }
      }

      return {
        id: match.id,
        isCompleted,
        isWinner: isCompleted ? isWinner : null,
        opponent,
        userSide,
        scoreNotes: match.scoreNotes,
        slot: match.slot ? {
          startTime: match.slot.startTime,
          endTime: match.slot.endTime,
          published: match.slot.published
        } : null
      };
    });

    // Calculate summary stats
    const totalMatches = matchInfo.length;
    const completedMatches = matchInfo.filter(m => m.isCompleted).length;
    const wonMatches = matchInfo.filter(m => m.isWinner === true).length;
    const lostMatches = matchInfo.filter(m => m.isWinner === false).length;
    const upcomingMatches = matchInfo.filter(m => !m.isCompleted && m.slot).length;

    // Find next match
    const now = new Date();
    const nextMatch = matchInfo
      .filter(m => !m.isCompleted && m.slot && new Date(m.slot.startTime) > now)
      .sort((a, b) => new Date(a.slot!.startTime).getTime() - new Date(b.slot!.startTime).getTime())[0];

    return NextResponse.json({
      gameId,
      gameName: game.name,
      contestType: game.contestType,
      typeFormat: game.typeFormat,
      registrationMode: userRegistration.mode,
      summary: {
        totalMatches,
        completedMatches,
        wonMatches,
        lostMatches,
        upcomingMatches
      },
      nextMatch: nextMatch ? {
        id: nextMatch.id,
        opponent: nextMatch.opponent,
        startTime: nextMatch.slot?.startTime,
        endTime: nextMatch.slot?.endTime
      } : null,
      matches: matchInfo
    });

  } catch (error) {
    console.error('Error fetching user match info:', error);
    
    if (error instanceof Error && error.message === 'Authentication required') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch match info' },
      { status: 500 }
    );
  }
}
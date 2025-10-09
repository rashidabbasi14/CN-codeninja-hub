import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminOrModerator } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAdminOrModerator(request);

    const gameId = params.id;

    // Get game details
    const game = await prisma.game.findUnique({
      where: { id: gameId },
      select: {
        id: true,
        name: true,
        typeFormat: true,
        contestType: true
      }
    });

    if (!game) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    // Check if it's a team game
    const playersPerSide = parseInt(game.typeFormat.split('v')[0]);
    const isTeamGame = playersPerSide > 1;

    // Get all matches for this game to determine scheduled participants
    const matches = await prisma.match.findMany({
      where: { gameId },
      select: {
        participantAId: true,
        participantAType: true,
        participantBId: true,
        participantBType: true
      }
    });

    // Extract scheduled participant IDs
    const scheduledParticipantIds = new Set<string>();
    matches.forEach(match => {
      // Handle SINGLE_ELIMINATION_1V1V1V1 contest type with JSON participant data
      if (game.contestType === 'SINGLE_ELIMINATION_1V1V1V1') {
        // For 1v1v1v1 format, participants are stored as JSON in participantAId and participantBId
        if (match.participantAType === 'FOUR_PARTICIPANT_DATA' && match.participantAId && match.participantAId !== 'TBD') {
          try {
            const participantAData = JSON.parse(match.participantAId);
            if (participantAData.participant1Id && participantAData.participant1Id !== 'TBD') {
              scheduledParticipantIds.add(participantAData.participant1Id);
            }
            if (participantAData.participant2Id && participantAData.participant2Id !== 'TBD') {
              scheduledParticipantIds.add(participantAData.participant2Id);
            }
          } catch (e) {
            // Ignore JSON parse errors
          }
        }
        
        if (match.participantBType === 'FOUR_PARTICIPANT_DATA' && match.participantBId && match.participantBId !== 'TBD') {
          try {
            const participantBData = JSON.parse(match.participantBId);
            if (participantBData.participant3Id && participantBData.participant3Id !== 'TBD') {
              scheduledParticipantIds.add(participantBData.participant3Id);
            }
            if (participantBData.participant4Id && participantBData.participant4Id !== 'TBD') {
              scheduledParticipantIds.add(participantBData.participant4Id);
            }
          } catch (e) {
            // Ignore JSON parse errors
          }
        }
      } else {
        // Original logic for other contest types
        if (match.participantAId && match.participantAId !== 'TBD') {
          scheduledParticipantIds.add(match.participantAId);
        }
        if (match.participantBId && match.participantBId !== 'TBD') {
          scheduledParticipantIds.add(match.participantBId);
        }
      }
    });

    if (!isTeamGame) {
      // For individual games (1v1), count total registrations
      const allRegistrations = await prisma.registration.findMany({
        where: { gameId },
        select: { userId: true }
      });

      const totalRegistrations = allRegistrations.length;
      const scheduledPlayers = allRegistrations.filter(reg =>
        scheduledParticipantIds.has(reg.userId)
      ).length;
      const unscheduledPlayers = totalRegistrations - scheduledPlayers;

      return NextResponse.json({
        isTeamGame: false,
        totalTeams: 0,
        incompleteTeams: 0,
        individualPlayers: totalRegistrations,
        totalPlayers: totalRegistrations,
        scheduledParticipants: scheduledPlayers,
        unscheduledParticipants: unscheduledPlayers
      });
    }

    // Get all teams for this game
    const teams = await prisma.team.findMany({
      where: { gameId },
      include: {
        members: true
      }
    });

    // Get individual registrations (users not in teams)
    const individualRegistrations = await prisma.registration.findMany({
      where: {
        gameId,
        teamId: null
      },
      select: { userId: true }
    });

    // Calculate team statistics
    const totalTeams = teams.length;
    const completeTeams = teams.filter(team => team.members.length >= playersPerSide);
    const incompleteTeams = teams.filter(team => team.members.length < playersPerSide).length;
    const individualPlayers = individualRegistrations.length;
    
    // Calculate total players across all teams and individual registrations
    const totalPlayersInTeams = teams.reduce((sum, team) => sum + team.members.length, 0);
    const totalPlayers = totalPlayersInTeams + individualPlayers;

    // Calculate scheduled/unscheduled counts
    const scheduledTeams = teams.filter(team => scheduledParticipantIds.has(team.id)).length;
    // Only count complete teams that are not scheduled as unscheduled
    const unscheduledCompleteTeams = completeTeams.filter(team => !scheduledParticipantIds.has(team.id)).length;
    
    const scheduledIndividualPlayers = individualRegistrations.filter(reg =>
      scheduledParticipantIds.has(reg.userId)
    ).length;
    const unscheduledIndividualPlayers = individualPlayers - scheduledIndividualPlayers;

    const totalScheduledParticipants = scheduledTeams + scheduledIndividualPlayers;
    // For team games, only complete teams that are not scheduled should be counted as unscheduled
    const totalUnscheduledParticipants = unscheduledCompleteTeams;

    return NextResponse.json({
      isTeamGame: true,
      totalTeams,
      completeTeams: completeTeams.length,
      incompleteTeams,
      individualPlayers,
      totalPlayers,
      requiredPlayersPerTeam: playersPerSide,
      scheduledParticipants: totalScheduledParticipants,
      unscheduledParticipants: totalUnscheduledParticipants,
      scheduledTeams,
      unscheduledTeams: unscheduledCompleteTeams,
      scheduledIndividualPlayers,
      unscheduledIndividualPlayers
    });

  } catch (error) {
    console.error('Error fetching game stats:', error);
    
    if (error instanceof Error && error.message === 'Authentication required') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    if (error instanceof Error && error.message === 'Admin or Moderator access required') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json(
      { error: 'Failed to fetch game stats' },
      { status: 500 }
    );
  }
}
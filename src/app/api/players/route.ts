import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// Helper function to safely parse JSON participant data
function safeParseParticipantData(participantAId: string, participantBId: string): { participantAData: any, participantBData: any } | null {
  if (!participantAId || !participantBId ||
      participantAId === 'TBD' || participantBId === 'TBD' ||
      participantAId.trim() === '' || participantBId.trim() === '') {
    return null;
  }
  
  try {
    const participantAData = JSON.parse(participantAId);
    const participantBData = JSON.parse(participantBId);
    return { participantAData, participantBData };
  } catch (e) {
    console.error('Error parsing participant data:', e);
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const currentUser = await requireAuth(request);

    // Get all users with their registrations, matches, and stats
    const users = await prisma.user.findMany({
      where: {
        isBlocked: false
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        gender: true,
        age: true,
        avatarUrl: true,
        jobTitle: true,
        privacyHideAge: true,
        privacyHideGender: true,
        department: {
          select: {
            name: true
          }
        },
        registrations: {
          select: {
            id: true,
            level: true,
            mode: true,
            game: {
              select: {
                id: true,
                name: true,
                weightage: true,
                category: {
                  select: {
                    name: true
                  }
                }
              }
            }
          }
        }
      },
      orderBy: {
        firstName: 'asc'
      }
    });

    // Get all matches to calculate win/loss stats
    const matches = await prisma.match.findMany({
      where: {
        winnerId: {
          not: null
        }
      },
      select: {
        id: true,
        participantAId: true,
        participantAType: true,
        participantBId: true,
        participantBType: true,
        winnerId: true,
        winnerType: true,
        game: {
          select: {
            id: true,
            name: true,
            weightage: true,
            contestType: true,
            allowDraws: true
          }
        }
      }
    });

    // Get all team memberships for team-based match handling
    const teamMemberships = await prisma.teamMember.findMany({
      select: {
        userId: true,
        teamId: true
      }
    });

    // Create team membership lookup
    const userTeamMap = new Map<string, string[]>();
    teamMemberships.forEach(membership => {
      if (!userTeamMap.has(membership.userId)) {
        userTeamMap.set(membership.userId, []);
      }
      userTeamMap.get(membership.userId)!.push(membership.teamId);
    });

    // Calculate stats for each player
    const playersWithStats = users.map(user => {
      const userRegistrations = user.registrations;
      const registeredGames = userRegistrations.map(reg => ({
        id: reg.game.id,
        name: reg.game.name,
        category: reg.game.category.name,
        level: reg.level,
        mode: reg.mode
      }));

      // Calculate wins and losses using the same logic as the leaderboard
      let totalWins = 0;
      let totalLosses = 0;
      let totalPoints = 0;
      let totalMatchesPlayed = 0;

      // Get user's team IDs
      const userTeamIds = userTeamMap.get(user.id) || [];

      // Filter matches where user WON (same logic as leaderboard)
      const userMatches = matches.filter(match => {
        const is1v1v1v1 = match.game.contestType === 'SINGLE_ELIMINATION_1V1V1V1';
        const isOneLoserMode = is1v1v1v1 && match.game.allowDraws;
        const isOneWinnerMode = is1v1v1v1 && !match.game.allowDraws;
        
        if ((isOneLoserMode || isOneWinnerMode) && match.participantAType === 'FOUR_PARTICIPANT_DATA') {
          // Handle both types of 1v1v1v1 matches
          const parsedData = safeParseParticipantData(match.participantAId, match.participantBId);
          if (parsedData) {
            const { participantAData, participantBData } = parsedData;
            const allParticipantIds = [
              participantAData.participant1Id,
              participantAData.participant2Id,
              participantBData.participant3Id,
              participantBData.participant4Id
            ].filter(Boolean);
            
            // Check if user or their team participated
            const userParticipated = allParticipantIds.includes(user.id) ||
              (userTeamIds.length > 0 && allParticipantIds.some(id => userTeamIds.includes(id)));
            
            if (!userParticipated) return false;
            
            if (isOneLoserMode) {
              // In one loser mode, user wins if they participated AND are NOT the winnerId
              return match.winnerId !== user.id && !userTeamIds.includes(match.winnerId || '');
            } else if (isOneWinnerMode) {
              // In one winner mode, user wins if they ARE the winnerId
              return (match.winnerId === user.id && match.winnerType === 'USER') ||
                     (match.winnerId !== null && userTeamIds.includes(match.winnerId) && match.winnerType === 'TEAM');
            }
          }
          return false;
        } else {
          // Handle regular matches (1v1, team-based, etc.)
          const isParticipantA = match.participantAId === user.id && match.participantAType === 'USER';
          const isParticipantB = match.participantBId === user.id && match.participantBType === 'USER';
          const isTeamParticipantA = userTeamIds.includes(match.participantAId || '') && match.participantAType === 'TEAM';
          const isTeamParticipantB = userTeamIds.includes(match.participantBId || '') && match.participantBType === 'TEAM';
          
          const userParticipated = isParticipantA || isParticipantB || isTeamParticipantA || isTeamParticipantB;
          
          if (!userParticipated) return false;
          
          // User wins if they are the winner (individual) or their team is the winner
          return (match.winnerId === user.id && match.winnerType === 'USER') ||
                 (match.winnerId !== null && userTeamIds.includes(match.winnerId) && match.winnerType === 'TEAM');
        }
      });

      // Group wins by game to apply proper scoring logic (same as leaderboard)
      const winsByGame = new Map<string, any[]>();
      userMatches.forEach(match => {
        if (!winsByGame.has(match.game.id)) {
          winsByGame.set(match.game.id, []);
        }
        winsByGame.get(match.game.id)!.push(match);
      });

      // Calculate points for each game (same logic as leaderboard)
      for (const [gameId, gameWins] of winsByGame) {
        const game = gameWins[0].game;
        
        if (game.contestType === 'SCORING') {
          // For scoring contests, we would need to implement the ranking logic
          // For now, skip scoring contests as they're handled differently
          // This matches the leaderboard behavior
        } else {
          // For non-scoring contests, use the same logic as leaderboard
          totalPoints += gameWins.length * game.weightage;
        }
      }

      totalWins = userMatches.length;

      // Count total matches participated (including losses)
      matches.forEach(match => {
        const is1v1v1v1 = match.game.contestType === 'SINGLE_ELIMINATION_1V1V1V1';
        let userParticipated = false;

        if (is1v1v1v1 && match.participantAType === 'FOUR_PARTICIPANT_DATA') {
          const parsedData = safeParseParticipantData(match.participantAId, match.participantBId);
          if (parsedData) {
            const { participantAData, participantBData } = parsedData;
            const allParticipantIds = [
              participantAData.participant1Id,
              participantAData.participant2Id,
              participantBData.participant3Id,
              participantBData.participant4Id
            ].filter(Boolean);
            
            userParticipated = allParticipantIds.includes(user.id) ||
              (userTeamIds.length > 0 && allParticipantIds.some(id => userTeamIds.includes(id)));
          }
        } else {
          const isParticipantA = match.participantAId === user.id && match.participantAType === 'USER';
          const isParticipantB = match.participantBId === user.id && match.participantBType === 'USER';
          const isTeamParticipantA = userTeamIds.includes(match.participantAId || '') && match.participantAType === 'TEAM';
          const isTeamParticipantB = userTeamIds.includes(match.participantBId || '') && match.participantBType === 'TEAM';
          
          userParticipated = isParticipantA || isParticipantB || isTeamParticipantA || isTeamParticipantB;
        }

        if (userParticipated) {
          totalMatchesPlayed++;
        }
      });

      totalLosses = totalMatchesPlayed - totalWins;
      const winRate = totalMatchesPlayed > 0 ? (totalWins / totalMatchesPlayed) * 100 : 0;

      return {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        gender: !user.privacyHideGender ? user.gender : null,
        age: !user.privacyHideAge ? user.age : null,
        avatarUrl: user.avatarUrl,
        jobTitle: user.jobTitle,
        department: user.department?.name,
        registeredGames,
        totalGames: registeredGames.length,
        totalPoints,
        totalWins,
        totalLosses,
        totalMatches: totalMatchesPlayed,
        winRate: Math.round(winRate * 100) / 100
      };
    });

    // Sort all players by total points (descending), then by win rate
    playersWithStats.sort((a, b) => {
      if (b.totalPoints !== a.totalPoints) {
        return b.totalPoints - a.totalPoints;
      }
      return b.winRate - a.winRate;
    });

    return NextResponse.json({
      players: playersWithStats,
      totalPlayers: playersWithStats.length
    });

  } catch (error) {
    console.error('Error fetching players:', error);
    
    if (error instanceof Error && error.message === 'Authentication required') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch players' },
      { status: 500 }
    );
  }
}
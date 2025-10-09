
import { prisma } from './prisma';

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

export interface LeaderboardEntry {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  avatarUrl?: string;
  jobTitle?: string;
  department?: string;
  gender?: string;
  age?: number;
  totalPoints: number;
  totalWins: number;
  gamesPlayed: number;
  winRate: number;
  lastWin?: Date;
  rank: number;
  tiebreakData: {
    headToHeadPoints: number;
    headToHeadDifferential: number;
    overallDifferential: number;
    mostWins: number;
    earliestWin?: Date;
  };
}

export interface TeamLeaderboardEntry {
  teamId: string;
  teamName: string;
  totalPoints: number;
  totalWins: number;
  gamesPlayed: number;
  winRate: number;
  lastWin?: Date;
  rank: number;
  members: {
    userId: string;
    firstName: string;
    lastName: string;
    email: string;
    department?: string;
  }[];
  tiebreakData: {
    headToHeadPoints: number;
    headToHeadDifferential: number;
    overallDifferential: number;
    mostWins: number;
    earliestWin?: Date;
  };
}

export interface CategoryLeaderboard {
  categoryId: string;
  categoryName: string;
  entries: LeaderboardEntry[];
}

export interface GameLeaderboard {
  gameId: string;
  gameName: string;
  entries: LeaderboardEntry[] | TeamLeaderboardEntry[];
  isTeamBased: boolean;
}

export interface TiebreakRule {
  type: 'total_points' | 'head_to_head_points' | 'head_to_head_differential' | 
        'overall_differential' | 'most_wins' | 'earliest_win' | 'random';
  order: 'desc' | 'asc';
}

export interface ScoringConfig {
  winPoints: number;
  drawPoints: number;
  lossPoints: number;
  tiebreakRules: TiebreakRule[];
}

class ScoringService {
  private defaultTiebreakRules: TiebreakRule[] = [
    { type: 'total_points', order: 'desc' },
    { type: 'head_to_head_points', order: 'desc' },
    { type: 'head_to_head_differential', order: 'desc' },
    { type: 'overall_differential', order: 'desc' },
    { type: 'most_wins', order: 'desc' },
    { type: 'earliest_win', order: 'asc' },
    { type: 'random', order: 'desc' },
  ];

  private defaultScoringConfig: ScoringConfig = {
    winPoints: 3,
    drawPoints: 1,
    lossPoints: 0,
    tiebreakRules: this.defaultTiebreakRules,
  };

  async calculateGlobalLeaderboard(
    filters?: {
      departmentId?: string;
      level?: string;
      hideAge?: boolean;
      hideGender?: boolean;
      verifiedOnly?: boolean;
    }
  ): Promise<LeaderboardEntry[]> {
    try {
      // First, get all matches with their related data in a single query (only from active categories)
      const allMatches = await prisma.match.findMany({
        where: {
          winnerId: { not: null },
          game: {
            category: {
              status: 'ACTIVE'
            }
          }
        },
        include: {
          game: {
            include: {
              category: {
                select: {
                  id: true,
                  status: true
                }
              },
              registrations: {
                include: {
                  user: {
                    include: {
                      department: true,
                    },
                  },
                },
              },
            },
          },
          slot: true,
        },
      });

      // Get all team memberships in a single query
      const teamMemberships = await prisma.teamMember.findMany({
        include: {
          user: {
            include: {
              department: true,
            },
          },
          team: true,
        },
      });

      // Get all users with their basic info
      const users = await prisma.user.findMany({
        where: {
          isBlocked: false,
          ...(filters?.departmentId && { departmentId: filters.departmentId }),
          ...(filters?.verifiedOnly && { isEmailVerified: true }),
        },
        include: {
          department: true,
          registrations: {
            include: {
              game: true,
            },
          },
        },
      });

      // Pre-calculate scoring contest rankings to avoid repeated queries
      const scoringContestRankings = new Map<string, Array<{ userId: string; score: number; position: number }>>();
      
      // Group matches by game and calculate scoring contest rankings once
      const matchesByGame = new Map<string, any[]>();
      allMatches.forEach(match => {
        if (!matchesByGame.has(match.gameId)) {
          matchesByGame.set(match.gameId, []);
        }
        matchesByGame.get(match.gameId)!.push(match);
      });

      // Pre-calculate scoring contest rankings
      for (const [gameId, gameMatches] of matchesByGame) {
        const firstMatch = gameMatches[0];
        if (firstMatch?.game?.contestType === 'SCORING') {
          const scoringResults: Array<{ userId: string; score: number }> = [];
          
          gameMatches.forEach(match => {
            if (match.winnerId && match.winnerType === 'USER' && match.scoreNotes) {
              const score = parseFloat(match.scoreNotes);
              if (!isNaN(score)) {
                scoringResults.push({
                  userId: match.winnerId,
                  score: score
                });
              }
            }
          });
          
          // Sort by score (highest first) and assign positions
          scoringResults.sort((a, b) => b.score - a.score);
          const rankings = scoringResults.map((result, index) => ({
            ...result,
            position: index
          }));
          
          scoringContestRankings.set(gameId, rankings);
        }
      }

      // Create team membership lookup
      const userTeamMap = new Map<string, string[]>();
      teamMemberships.forEach(membership => {
        if (!userTeamMap.has(membership.userId)) {
          userTeamMap.set(membership.userId, []);
        }
        userTeamMap.get(membership.userId)!.push(membership.teamId);
      });

      const leaderboardEntries: LeaderboardEntry[] = [];

      for (const user of users) {
        // Get user's team IDs
        const userTeamIds = userTeamMap.get(user.id) || [];
        
        // Filter matches for this user (individual and team wins)
        const userMatches = allMatches.filter(match => {
          const isOneLoserMode = match.game.contestType === 'SINGLE_ELIMINATION_1V1V1V1' && match.game.allowDraws;
          
          if (isOneLoserMode) {
            // In 1 Loser mode, user wins if they are NOT the winnerId
            // Check if user participated in the match
            if (match.participantAType === 'FOUR_PARTICIPANT_DATA') {
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
                
                // User wins if they participated AND are NOT the winnerId
                return userParticipated && match.winnerId !== user.id && !userTeamIds.includes(match.winnerId || '');
              }
              return false;
            }
            return false;
          } else {
            // Normal mode: user wins if they ARE the winnerId
            return (match.winnerId === user.id && match.winnerType === 'USER') ||
              (match.winnerId && userTeamIds.includes(match.winnerId) && match.winnerType === 'TEAM');
          }
        });

        // Filter by level if specified
        const filteredMatches = userMatches.filter(match =>
          !filters?.level || user.registrations.some(reg =>
            reg.gameId === match.gameId && reg.level === filters.level
          )
        );

        // Calculate total points with proper scoring for different contest types
        let totalPoints = 0;
        
        // Group wins by game to apply proper scoring logic
        const winsByGame = new Map<string, any[]>();
        filteredMatches.forEach(match => {
          if (!winsByGame.has(match.gameId)) {
            winsByGame.set(match.gameId, []);
          }
          winsByGame.get(match.gameId)!.push(match);
        });
        
        // Calculate points for each game
        for (const [gameId, gameWins] of winsByGame) {
          const game = gameWins[0].game;
          
          if (game.contestType === 'SCORING') {
            // Use pre-calculated rankings
            const rankings = scoringContestRankings.get(gameId);
            if (rankings) {
              const userRanking = rankings.find(r => r.userId === user.id);
              if (userRanking) {
                let positionalPoints = 0;
                if (userRanking.position === 0) positionalPoints = 3; // 1st place
                else if (userRanking.position === 1) positionalPoints = 2; // 2nd place
                else if (userRanking.position === 2) positionalPoints = 1; // 3rd place
                
                totalPoints += positionalPoints;
              }
            }
          } else {
            // For non-scoring contests, use the original logic
            totalPoints += gameWins.length * game.weightage;
          }
        }
        
        // Calculate games played
        const gamesPlayed = user.registrations.filter((reg: any) =>
          !filters?.level || reg.level === filters.level
        ).length;

        // Calculate win rate
        const winRate = gamesPlayed > 0 ? (filteredMatches.length / gamesPlayed) * 100 : 0;

        // Find last win
        const lastWin = filteredMatches.length > 0
          ? new Date(Math.max(...filteredMatches.map((w: any) => w.slot?.startTime?.getTime() || w.createdAt.getTime())))
          : undefined;

        // Find earliest win
        const earliestWin = filteredMatches.length > 0
          ? new Date(Math.min(...filteredMatches.map((w: any) => w.slot?.startTime?.getTime() || w.createdAt.getTime())))
          : undefined;

        leaderboardEntries.push({
          userId: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          avatarUrl: user.avatarUrl || undefined,
          jobTitle: user.jobTitle || undefined,
          department: user.department?.name,
          gender: (!filters?.hideGender && !user.privacyHideGender) ? user.gender : undefined,
          age: (!filters?.hideAge && !user.privacyHideAge && user.age !== null) ? user.age : undefined,
          totalPoints,
          totalWins: filteredMatches.length,
          gamesPlayed,
          winRate,
          lastWin,
          rank: 0, // Will be calculated after sorting
          tiebreakData: {
            headToHeadPoints: 0, // TODO: Calculate head-to-head
            headToHeadDifferential: 0,
            overallDifferential: 0,
            mostWins: filteredMatches.length,
            earliestWin,
          },
        });
      }

      // Sort and assign ranks
      const sortedEntries = this.sortByTiebreakRules(leaderboardEntries, this.defaultTiebreakRules);
      
      // Assign ranks (handle ties)
      let currentRank = 1;
      for (let i = 0; i < sortedEntries.length; i++) {
        if (i > 0 && this.compareEntries(sortedEntries[i], sortedEntries[i - 1]) !== 0) {
          currentRank = i + 1;
        }
        sortedEntries[i].rank = currentRank;
      }

      return sortedEntries;
    } catch (error) {
      console.error('Failed to calculate global leaderboard:', error);
      throw error;
    }
  }

  async calculateCategoryLeaderboard(categoryId: string): Promise<CategoryLeaderboard> {
    try {
      const category = await prisma.category.findUnique({
        where: { id: categoryId },
        include: {
          games: {
            include: {
              matches: {
                include: {
                  game: true,
                  slot: true,
                },
              },
              registrations: {
                include: {
                  user: {
                    include: {
                      department: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!category) {
        throw new Error('Category not found');
      }

      // Get all participants in this category
      const participantMap = new Map<string, LeaderboardEntry>();

      category.games.forEach((game: any) => {
        game.registrations.forEach((registration: any) => {
          const user = registration.user;
          if (!participantMap.has(user.id)) {
            participantMap.set(user.id, {
              userId: user.id,
              firstName: user.firstName,
              lastName: user.lastName,
              email: user.email,
              department: user.department?.name,
              totalPoints: 0,
              totalWins: 0,
              gamesPlayed: 0,
              winRate: 0,
              rank: 0,
              tiebreakData: {
                headToHeadPoints: 0,
                headToHeadDifferential: 0,
                overallDifferential: 0,
                mostWins: 0,
              },
            });
          }
          
          const entry = participantMap.get(user.id)!;
          entry.gamesPlayed++;
        });

        // Count wins
        // For SINGLE_ELIMINATION_1V1V1V1 with 1 Loser mode, allowDraws represents oneLoserMode
        const isOneLoserMode = game.contestType === 'SINGLE_ELIMINATION_1V1V1V1' && game.allowDraws;
        
        game.matches.forEach((match: any) => {
          if (match.winnerId && match.winnerType) {
            // For 1v1v1v1 with 1 Loser mode, we need to handle 4-player matches differently
            if (isOneLoserMode && match.participantAType === 'FOUR_PARTICIPANT_DATA') {
              // Parse participant data to get all 4 players
              const parsedData = safeParseParticipantData(match.participantAId, match.participantBId);
              if (parsedData) {
                const { participantAData, participantBData } = parsedData;
                
                // Get all participant IDs
                const allParticipants = [
                  participantAData.participant1Id,
                  participantAData.participant2Id,
                  participantBData.participant3Id,
                  participantBData.participant4Id
                ].filter(Boolean);
                
                // In 1 Loser mode, winnerId is the loser, so everyone else wins
                allParticipants.forEach(participantId => {
                  if (participantId !== match.winnerId) {
                    // Find the user for this participant
                    const registration = game.registrations.find((reg: any) =>
                      (reg.mode === 'TEAM' && reg.team?.id === participantId) ||
                      (reg.mode === 'INDIVIDUAL' && reg.user.id === participantId)
                    );
                    
                    if (registration) {
                      const entry = participantMap.get(registration.user.id);
                      if (entry) {
                        entry.totalWins++;
                        entry.totalPoints += game.weightage;
                      }
                    }
                  }
                });
              }
            }
            // For individual games, winner is a user
            else if (match.winnerType === 'USER') {
              const entry = participantMap.get(match.winnerId);
              if (entry) {
                entry.totalWins++;
                entry.totalPoints += game.weightage;
              }
            }
            // For team games, award points to all team members who are registered for this game
            else if (match.winnerType === 'TEAM') {
              // Find all users who are registered for this game and are members of the winning team
              game.registrations.forEach((registration: any) => {
                if (registration.teamId === match.winnerId) {
                  const entry = participantMap.get(registration.user.id);
                  if (entry) {
                    entry.totalWins++;
                    entry.totalPoints += game.weightage;
                  }
                }
              });
            }
          }
        });
      });

      // Calculate win rates and sort
      const entries = Array.from(participantMap.values()).map(entry => ({
        ...entry,
        winRate: entry.gamesPlayed > 0 ? (entry.totalWins / entry.gamesPlayed) * 100 : 0,
        tiebreakData: {
          ...entry.tiebreakData,
          mostWins: entry.totalWins,
        },
      }));

      const sortedEntries = this.sortByTiebreakRules(entries, this.defaultTiebreakRules);
      
      // Assign ranks
      let currentRank = 1;
      for (let i = 0; i < sortedEntries.length; i++) {
        if (i > 0 && this.compareEntries(sortedEntries[i], sortedEntries[i - 1]) !== 0) {
          currentRank = i + 1;
        }
        sortedEntries[i].rank = currentRank;
      }

      return {
        categoryId: category.id,
        categoryName: category.name,
        entries: sortedEntries,
      };
    } catch (error) {
      console.error('Failed to calculate category leaderboard:', error);
      throw error;
    }
  }

  async calculateGameLeaderboard(gameId: string): Promise<GameLeaderboard> {
    try {
      const game = await prisma.game.findUnique({
        where: { id: gameId },
        include: {
          matches: {
            include: {
              slot: true,
            },
          },
          registrations: {
            include: {
              user: {
                include: {
                  department: true,
                },
              },
              team: {
                include: {
                  members: {
                    include: {
                      user: {
                        include: {
                          department: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!game) {
        throw new Error('Game not found');
      }

      // Determine if this is a team-based game
      const isTeamBased = game.typeFormat !== '1v1' && game.contestType !== 'SCORING';

      if (isTeamBased) {
        // Handle team-based games
        const teamMap = new Map<string, TeamLeaderboardEntry>();

        // Initialize teams
        game.registrations.forEach((registration: any) => {
          if (registration.team && !teamMap.has(registration.team.id)) {
            teamMap.set(registration.team.id, {
              teamId: registration.team.id,
              teamName: registration.team.name,
              totalPoints: 0,
              totalWins: 0,
              gamesPlayed: 1,
              winRate: 0,
              rank: 0,
              members: registration.team.members.map((member: any) => ({
                userId: member.user.id,
                firstName: member.user.firstName,
                lastName: member.user.lastName,
                email: member.user.email,
                department: member.user.department?.name,
              })),
              tiebreakData: {
                headToHeadPoints: 0,
                headToHeadDifferential: 0,
                overallDifferential: 0,
                mostWins: 0,
              },
            });
          }
        });

        // Count team wins and calculate points
        // For SINGLE_ELIMINATION_1V1V1V1 with 1 Loser mode, allowDraws represents oneLoserMode
        const isOneLoserMode = game.contestType === 'SINGLE_ELIMINATION_1V1V1V1' && game.allowDraws;
        
        game.matches.forEach((match: any) => {
          if (match.winnerId && match.winnerType === 'TEAM') {
            // For 1v1v1v1 with 1 Loser mode, handle inverted logic
            if (isOneLoserMode && match.participantAType === 'FOUR_PARTICIPANT_DATA') {
              // Parse participant data to get all 4 teams
              const parsedData = safeParseParticipantData(match.participantAId, match.participantBId);
              if (parsedData) {
                const { participantAData, participantBData } = parsedData;
                
                // Get all team IDs
                const allTeams = [
                  participantAData.participant1Id,
                  participantAData.participant2Id,
                  participantBData.participant3Id,
                  participantBData.participant4Id
                ].filter(Boolean);
                
                // In 1 Loser mode, winnerId is the loser, so all other teams win
                allTeams.forEach(teamId => {
                  if (teamId !== match.winnerId) {
                    const teamEntry = teamMap.get(teamId);
                    if (teamEntry) {
                      teamEntry.totalWins++;
                      teamEntry.totalPoints += game.weightage;
                      teamEntry.lastWin = match.slot?.startTime;
                      
                      if (!teamEntry.tiebreakData.earliestWin || (match.slot?.startTime && match.slot.startTime < teamEntry.tiebreakData.earliestWin)) {
                        teamEntry.tiebreakData.earliestWin = match.slot?.startTime;
                      }
                    }
                  }
                });
              }
            } else {
              // Normal team win logic
              const teamEntry = teamMap.get(match.winnerId);
              if (teamEntry) {
                teamEntry.totalWins++;
                teamEntry.totalPoints += game.weightage;
                teamEntry.lastWin = match.slot?.startTime;
                
                if (!teamEntry.tiebreakData.earliestWin || (match.slot?.startTime && match.slot.startTime < teamEntry.tiebreakData.earliestWin)) {
                  teamEntry.tiebreakData.earliestWin = match.slot?.startTime;
                }
              }
            }
          }
        });

        // Calculate win rates for teams
        const teamEntries = Array.from(teamMap.values()).map(entry => ({
          ...entry,
          winRate: entry.gamesPlayed > 0 ? (entry.totalWins / entry.gamesPlayed) * 100 : 0,
          tiebreakData: {
            ...entry.tiebreakData,
            mostWins: entry.totalWins,
          },
        }));

        const sortedTeamEntries = this.sortByTiebreakRules(teamEntries as any, this.defaultTiebreakRules);
        
        // Assign ranks to teams
        let currentRank = 1;
        for (let i = 0; i < sortedTeamEntries.length; i++) {
          if (i > 0 && this.compareEntries(sortedTeamEntries[i] as any, sortedTeamEntries[i - 1] as any) !== 0) {
            currentRank = i + 1;
          }
          sortedTeamEntries[i].rank = currentRank;
        }

        return {
          gameId: game.id,
          gameName: game.name,
          entries: sortedTeamEntries,
          isTeamBased: true,
        };
      } else {
        // Handle individual games (existing logic)
        const participantMap = new Map<string, LeaderboardEntry>();

        game.registrations.forEach((registration: any) => {
          const user = registration.user;
          participantMap.set(user.id, {
            userId: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            department: user.department?.name,
            totalPoints: 0,
            totalWins: 0,
            gamesPlayed: 1,
            winRate: 0,
            rank: 0,
            tiebreakData: {
              headToHeadPoints: 0,
              headToHeadDifferential: 0,
              overallDifferential: 0,
              mostWins: 0,
            },
          });
        });

        // Count wins and calculate points for individual games
        if (game.contestType === 'SCORING') {
          // For scoring contests, implement positional weightage system
          const scoringResults: Array<{
            userId: string;
            score: number;
            matchTime: Date | null;
          }> = [];

          // Collect all scores from matches
          game.matches.forEach((match: any) => {
            if (match.winnerId && match.winnerType === 'USER' && match.scoreNotes) {
              const score = parseFloat(match.scoreNotes);
              if (!isNaN(score)) {
                scoringResults.push({
                  userId: match.winnerId,
                  score: score,
                  matchTime: match.slot?.startTime || null
                });
              }
            }
          });

          // Sort by score (highest first) and assign positional points
          scoringResults.sort((a, b) => b.score - a.score);
          
          scoringResults.forEach((result, index) => {
            const entry = participantMap.get(result.userId);
            if (entry) {
              entry.totalWins++; // Count as a win for participation
              
              // Award positional points: 1st=3, 2nd=2, 3rd=1, others=0
              let positionalPoints = 0;
              if (index === 0) positionalPoints = 3; // 1st place
              else if (index === 1) positionalPoints = 2; // 2nd place
              else if (index === 2) positionalPoints = 1; // 3rd place
              
              entry.totalPoints += positionalPoints;
              entry.lastWin = result.matchTime || undefined;
              
              if (!entry.tiebreakData.earliestWin || (result.matchTime && result.matchTime < entry.tiebreakData.earliestWin)) {
                entry.tiebreakData.earliestWin = result.matchTime || undefined;
              }
            }
          });
        } else {
          // For non-scoring contests, use the original logic
          // For SINGLE_ELIMINATION_1V1V1V1 with 1 Loser mode, allowDraws represents oneLoserMode
          const isOneLoserMode = game.contestType === 'SINGLE_ELIMINATION_1V1V1V1' && game.allowDraws;
          
          game.matches.forEach((match: any) => {
            if (match.winnerId && match.winnerType === 'USER') {
              // For 1v1v1v1 with 1 Loser mode, handle inverted logic
              if (isOneLoserMode && match.participantAType === 'FOUR_PARTICIPANT_DATA') {
                // Parse participant data to get all 4 players
                const parsedData = safeParseParticipantData(match.participantAId, match.participantBId);
                if (parsedData) {
                  const { participantAData, participantBData } = parsedData;
                  
                  // Get all participant IDs
                  const allParticipants = [
                    participantAData.participant1Id,
                    participantAData.participant2Id,
                    participantBData.participant3Id,
                    participantBData.participant4Id
                  ].filter(Boolean);
                  
                  // In 1 Loser mode, winnerId is the loser, so everyone else wins
                  allParticipants.forEach(participantId => {
                    if (participantId !== match.winnerId) {
                      const entry = participantMap.get(participantId);
                      if (entry) {
                        entry.totalWins++;
                        entry.totalPoints += game.weightage;
                        entry.lastWin = match.slot?.startTime;
                        
                        if (!entry.tiebreakData.earliestWin || (match.slot?.startTime && match.slot.startTime < entry.tiebreakData.earliestWin)) {
                          entry.tiebreakData.earliestWin = match.slot?.startTime;
                        }
                      }
                    }
                  });
                }
              } else {
                // Normal user win logic
                const entry = participantMap.get(match.winnerId);
                if (entry) {
                  entry.totalWins++;
                  entry.totalPoints += game.weightage;
                  entry.lastWin = match.slot?.startTime;
                  
                  if (!entry.tiebreakData.earliestWin || (match.slot?.startTime && match.slot.startTime < entry.tiebreakData.earliestWin)) {
                    entry.tiebreakData.earliestWin = match.slot?.startTime;
                  }
                }
              }
            }
          });
        }

        // Calculate win rates
        const entries = Array.from(participantMap.values()).map(entry => ({
          ...entry,
          winRate: entry.gamesPlayed > 0 ? (entry.totalWins / entry.gamesPlayed) * 100 : 0,
          tiebreakData: {
            ...entry.tiebreakData,
            mostWins: entry.totalWins,
          },
        }));

        const sortedEntries = this.sortByTiebreakRules(entries, this.defaultTiebreakRules);
        
        // Assign ranks
        let currentRank = 1;
        for (let i = 0; i < sortedEntries.length; i++) {
          if (i > 0 && this.compareEntries(sortedEntries[i], sortedEntries[i - 1]) !== 0) {
            currentRank = i + 1;
          }
          sortedEntries[i].rank = currentRank;
        }

        return {
          gameId: game.id,
          gameName: game.name,
          entries: sortedEntries,
          isTeamBased: false,
        };
      }
    } catch (error) {
      console.error('Failed to calculate game leaderboard:', error);
      throw error;
    }
  }

  async updateLeaderboardsAfterMatch(matchId: string): Promise<void> {
    try {
      const match = await prisma.match.findUnique({
        where: { id: matchId },
        include: {
          game: {
            include: {
              category: true,
            },
          },
        },
      });

      if (!match || !match.winnerId) return;

      // Update global leaderboard cache (if implemented)
      // This would typically trigger a background job to recalculate leaderboards
      
      console.log(`Leaderboards updated after match ${matchId}`);
    } catch (error) {
      console.error('Failed to update leaderboards after match:', error);
    }
  }

  private sortByTiebreakRules(entries: LeaderboardEntry[], rules: TiebreakRule[]): LeaderboardEntry[] {
    return entries.sort((a, b) => {
      for (const rule of rules) {
        const comparison = this.compareByRule(a, b, rule);
        if (comparison !== 0) {
          return comparison;
        }
      }
      return 0;
    });
  }

  private compareByRule(a: LeaderboardEntry, b: LeaderboardEntry, rule: TiebreakRule): number {
    let comparison = 0;

    switch (rule.type) {
      case 'total_points':
        comparison = a.totalPoints - b.totalPoints;
        break;
      case 'head_to_head_points':
        comparison = a.tiebreakData.headToHeadPoints - b.tiebreakData.headToHeadPoints;
        break;
      case 'head_to_head_differential':
        comparison = a.tiebreakData.headToHeadDifferential - b.tiebreakData.headToHeadDifferential;
        break;
      case 'overall_differential':
        comparison = a.tiebreakData.overallDifferential - b.tiebreakData.overallDifferential;
        break;
      case 'most_wins':
        comparison = a.tiebreakData.mostWins - b.tiebreakData.mostWins;
        break;
      case 'earliest_win':
        if (a.tiebreakData.earliestWin && b.tiebreakData.earliestWin) {
          comparison = a.tiebreakData.earliestWin.getTime() - b.tiebreakData.earliestWin.getTime();
        } else if (a.tiebreakData.earliestWin) {
          comparison = -1;
        } else if (b.tiebreakData.earliestWin) {
          comparison = 1;
        } else {
          comparison = 0;
        }
        break;
      case 'random':
        comparison = Math.random() - 0.5;
        break;
      default:
        comparison = 0;
    }

    return rule.order === 'desc' ? -comparison : comparison;
  }

  private compareEntries(a: LeaderboardEntry, b: LeaderboardEntry): number {
    return this.compareByRule(a, b, this.defaultTiebreakRules[0]);
  }
}

export const scoringService = new ScoringService();

// Helper functions for leaderboard calculations
export function calculateWinRate(wins: number, totalGames: number): number {
  return totalGames > 0 ? (wins / totalGames) * 100 : 0;
}

export function formatWinRate(winRate: number): string {
  return `${winRate.toFixed(1)}%`;
}

export function getRankSuffix(rank: number): string {
  const lastDigit = rank % 10;
  const lastTwoDigits = rank % 100;
  
  if (lastTwoDigits >= 11 && lastTwoDigits <= 13) {
    return 'th';
  }
  
  switch (lastDigit) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
}

export function formatRank(rank: number): string {
  return `${rank}${getRankSuffix(rank)}`;
}
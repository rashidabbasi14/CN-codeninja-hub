import { NextRequest, NextResponse } from 'next/server';
import { scoringService } from '@/lib/scoring';
import { prisma } from '@/lib/prisma';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// Simple in-memory cache for leaderboard data
let leaderboardCache: {
  data: any;
  timestamp: number;
} | null = null;

const CACHE_DURATION = 10000; // 10 seconds cache

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const departmentId = searchParams.get('department');
    const level = searchParams.get('level');
    const hideAge = searchParams.get('hideAge') === 'true';
    const hideGender = searchParams.get('hideGender') === 'true';
    const verifiedOnly = searchParams.get('verifiedOnly') === 'true';

    // Create cache key based on filters
    const cacheKey = JSON.stringify({ departmentId, level, hideAge, hideGender, verifiedOnly });
    const now = Date.now();

    // Check if we have valid cached data
    if (leaderboardCache &&
        leaderboardCache.timestamp + CACHE_DURATION > now &&
        leaderboardCache.data.cacheKey === cacheKey) {
      return NextResponse.json(leaderboardCache.data.response);
    }

    // Use the scoring service to get proper leaderboard with team wins aggregated
    const leaderboardEntries = await scoringService.calculateGlobalLeaderboard({
      departmentId: departmentId || undefined,
      level: level || undefined,
      hideAge,
      hideGender,
      verifiedOnly,
    });

    // Get all team memberships in a single query for performance
    const allTeamMemberships = await prisma.teamMember.findMany({
      select: { userId: true, teamId: true },
    });

    // Get all matches in a single query for performance
    const allMatches = await prisma.match.findMany({
      where: {
        winnerId: { not: null },
      },
      select: {
        winnerId: true,
        winnerType: true,
      },
    });

    // Create lookup maps for performance
    const userTeamMap = new Map<string, string[]>();
    allTeamMemberships.forEach(membership => {
      if (!userTeamMap.has(membership.userId)) {
        userTeamMap.set(membership.userId, []);
      }
      userTeamMap.get(membership.userId)!.push(membership.teamId);
    });

    // Count wins efficiently
    const individualWinCounts = new Map<string, number>();
    const teamWinCounts = new Map<string, number>();

    allMatches.forEach(match => {
      if (match.winnerType === 'USER' && match.winnerId) {
        individualWinCounts.set(match.winnerId, (individualWinCounts.get(match.winnerId) || 0) + 1);
      } else if (match.winnerType === 'TEAM' && match.winnerId) {
        teamWinCounts.set(match.winnerId, (teamWinCounts.get(match.winnerId) || 0) + 1);
      }
    });

    // Build user data efficiently
    const usersWithBreakdown = leaderboardEntries.map(entry => {
      const userTeamIds = userTeamMap.get(entry.userId) || [];
      const individualWins = individualWinCounts.get(entry.userId) || 0;
      const teamWins = userTeamIds.reduce((sum, teamId) => sum + (teamWinCounts.get(teamId) || 0), 0);

      return {
        id: entry.userId,
        firstName: entry.firstName,
        lastName: entry.lastName,
        email: entry.email,
        avatarUrl: entry.avatarUrl,
        jobTitle: entry.jobTitle,
        department: entry.department || 'No Department',
        totalPoints: Math.round(entry.totalPoints * 10) / 10,
        totalWins: entry.totalWins,
        individualWins,
        teamWins,
        gamesPlayed: entry.gamesPlayed,
        winRate: Math.round(entry.winRate),
        rank: entry.rank,
        gender: entry.gender,
        age: entry.age
      };
    });

    // Calculate department statistics from the leaderboard entries
    const departmentStats = leaderboardEntries.reduce((acc, entry) => {
      const deptName = entry.department || 'No Department';
      
      if (!acc[deptName]) {
        acc[deptName] = {
          department: deptName,
          totalPoints: 0,
          members: 0,
          totalWins: 0,
          totalGames: 0
        };
      }
      
      acc[deptName].totalPoints += entry.totalPoints;
      acc[deptName].totalWins += entry.totalWins;
      acc[deptName].totalGames += entry.gamesPlayed;
      acc[deptName].members += 1;
      
      return acc;
    }, {} as Record<string, any>);

    const departmentLeaderboard = Object.values(departmentStats).map((dept: any) => ({
      ...dept,
      avgPoints: dept.members > 0 ? Math.round((dept.totalPoints / dept.members) * 10) / 10 : 0,
      winRate: dept.totalGames > 0 ? Math.round((dept.totalWins / dept.totalGames) * 100) : 0
    })).sort((a, b) => {
      if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
      return b.avgPoints - a.avgPoints;
    });

    // Get comprehensive statistics (only from active categories)
    const totalUsers = usersWithBreakdown.length;
    const totalMatches = await prisma.match.count({
      where: {
        game: {
          category: {
            status: 'ACTIVE'
          }
        }
      }
    });
    const totalIndividualWins = await prisma.match.count({
      where: {
        winnerType: 'USER',
        game: {
          category: {
            status: 'ACTIVE'
          }
        }
      }
    });
    const totalTeamWins = await prisma.match.count({
      where: {
        winnerType: 'TEAM',
        game: {
          category: {
            status: 'ACTIVE'
          }
        }
      }
    });
    
    // Get active games and categories (only from active categories)
    const activeGames = await prisma.game.count({
      where: {
        category: {
          status: 'ACTIVE'
        }
      }
    });
    const activeCategories = await prisma.category.count({
      where: { status: 'ACTIVE' }
    });
    
    // Get total registrations (only from active categories)
    const totalRegistrations = await prisma.registration.count({
      where: {
        game: {
          category: {
            status: 'ACTIVE'
          }
        }
      }
    });
    
    // Get teams count (only from active categories)
    const totalTeams = await prisma.team.count({
      where: {
        game: {
          category: {
            status: 'ACTIVE'
          }
        }
      }
    });
    
    // Calculate average points per user
    const totalPoints = usersWithBreakdown.reduce((sum, user) => sum + user.totalPoints, 0);
    const avgPointsPerUser = totalUsers > 0 ? Math.round((totalPoints / totalUsers) * 10) / 10 : 0;
    
    // Get top performer
    const topPerformer = usersWithBreakdown.length > 0 ? usersWithBreakdown[0] : null;
    
    // Calculate participation rate (users with at least one game played)
    const activeUsers = usersWithBreakdown.filter(user => user.gamesPlayed > 0).length;
    const participationRate = totalUsers > 0 ? Math.round((activeUsers / totalUsers) * 100) : 0;

    // Get game-specific leaderboards (only from active categories)
    const games = await prisma.game.findMany({
      where: {
        category: {
          status: 'ACTIVE'
        }
      },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            startDate: true
          }
        },
        matches: {
          include: {
            game: {
              select: {
                weightage: true
              }
            }
          }
        },
        registrations: {
          include: {
            user: {
              include: {
                department: true,
                teamMemberships: {
                  include: {
                    team: true
                  }
                }
              }
            }
          }
        }
      },
      orderBy: [
        {
          category: {
            startDate: 'asc'
          }
        },
        {
          name: 'asc'
        }
      ]
    });

    // Calculate game-specific leaderboards
    const gameLeaderboards = await Promise.all(
      games.map(async (game) => {
        const gameLeaderboard = await scoringService.calculateGameLeaderboard(game.id);
        
        // Get winners (top 3)
        const winners = gameLeaderboard.entries.slice(0, 3);
        
        // Check if game is completed by verifying all matches have winners
        const totalMatches = game.matches.length;
        const completedMatches = game.matches.filter(match => match.winnerId !== null).length;
        const isGameCompleted = totalMatches > 0 && completedMatches === totalMatches;
        
        return {
          gameId: game.id,
          gameName: game.name,
          categoryId: game.category.id,
          categoryName: game.category.name,
          weightage: game.weightage,
          typeFormat: game.typeFormat,
          contestType: game.contestType,
          totalParticipants: gameLeaderboard.entries.length,
          isTeamBased: gameLeaderboard.isTeamBased,
          winners,
          entries: gameLeaderboard.entries,
          isCompleted: isGameCompleted,
          totalMatches,
          completedMatches
        };
      })
    );

    // Get all departments for filtering
    const departments = await prisma.department.findMany({
      select: {
        id: true,
        name: true
      }
    });

    const responseData = {
      users: usersWithBreakdown,
      departments: departmentLeaderboard,
      gameLeaderboards,
      availableDepartments: departments,
      availableGames: games.map(game => ({
        id: game.id,
        name: game.name,
        categoryName: game.category.name,
        typeFormat: game.typeFormat,
        categoryStartDate: game.category.startDate
      })),
      stats: {
        totalUsers,
        totalMatches,
        totalIndividualWins,
        totalTeamWins,
        activeGames,
        activeCategories,
        totalRegistrations,
        totalTeams,
        avgPointsPerUser,
        topPerformer,
        activeUsers,
        participationRate,
        totalPoints
      }
    };

    // Cache the response
    leaderboardCache = {
      data: {
        cacheKey,
        response: responseData
      },
      timestamp: now
    };

    return NextResponse.json(responseData);

  } catch (error) {
    console.error('Failed to fetch leaderboard data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch leaderboard data' },
      { status: 500 }
    );
  }
}
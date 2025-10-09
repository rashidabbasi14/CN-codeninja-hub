"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Trophy, Medal, Award, Users, Target, Filter, Crown, MapPin, TrendingUp, Gamepad2, Calendar, UserCheck, Zap, Star, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useUser } from "@/contexts/UserContext";
import Navigation from "@/components/Navigation";
import MatchFeed from "@/components/MatchFeed";
import { useEffect, useState, useRef } from "react";

// TypeScript interfaces
interface LeaderboardUser {
  id?: string;
  userId?: string;
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
  rank: number;
}

interface TeamLeaderboardUser {
  teamId: string;
  teamName: string;
  totalPoints: number;
  totalWins: number;
  gamesPlayed: number;
  winRate: number;
  rank: number;
  members: {
    userId: string;
    firstName: string;
    lastName: string;
    email: string;
    department?: string;
  }[];
}

interface GameLeaderboard {
  gameId: string;
  gameName: string;
  categoryId: string;
  categoryName: string;
  weightage: number;
  typeFormat: string;
  contestType: string;
  totalParticipants: number;
  isTeamBased: boolean;
  winners: LeaderboardUser[] | TeamLeaderboardUser[];
  entries: LeaderboardUser[] | TeamLeaderboardUser[];
  isCompleted: boolean;
  totalMatches: number;
  completedMatches: number;
}

interface DepartmentStats {
  department: string;
  totalPoints: number;
  totalWins: number;
  members: number;
  avgPoints: number;
  winRate: number;
  totalGames: number;
}

interface LeaderboardStats {
  totalUsers: number;
  totalMatches: number;
  totalIndividualWins: number;
  totalTeamWins: number;
  activeGames: number;
  activeCategories: number;
  totalRegistrations: number;
  totalTeams: number;
  avgPointsPerUser: number;
  topPerformer: LeaderboardUser | null;
  activeUsers: number;
  participationRate: number;
  totalPoints: number;
}

interface AvailableDepartment {
  id: string;
  name: string;
}

interface AvailableGame {
  id: string;
  name: string;
  categoryName: string;
  typeFormat: string;
  categoryStartDate: string;
}

interface LeaderboardData {
  users: LeaderboardUser[];
  departments: DepartmentStats[];
  gameLeaderboards: GameLeaderboard[];
  availableDepartments: AvailableDepartment[];
  availableGames: AvailableGame[];
  stats: LeaderboardStats;
}

function getRankIcon(rank: number, hasScore: boolean = true) {
  if (!hasScore) {
    return <div className="h-6 w-6 rounded-full bg-slate-600 flex items-center justify-center text-xs text-white font-bold">{rank}</div>;
  }
  
  switch (rank) {
    case 1:
      return <Crown className="h-6 w-6 text-yellow-400" />;
    case 2:
      return <Medal className="h-6 w-6 text-gray-400" />;
    case 3:
      return <Award className="h-6 w-6 text-amber-600" />;
    default:
      return <div className="h-6 w-6 rounded-full bg-slate-600 flex items-center justify-center text-xs text-white font-bold">{rank}</div>;
  }
}

function getContestTypeDisplayName(contestType: string) {
  switch (contestType?.toLowerCase()) {
    case 'knockout':
      return 'Knockout Tournament';
    case 'league':
      return 'League Format';
    case 'round_robin':
      return 'Round Robin';
    case 'single_elimination':
      return 'Single Elimination';
    case 'double_elimination':
      return 'Double Elimination';
    case 'swiss':
      return 'Swiss System';
    case 'group_stage':
      return 'Group Stage';
    default:
      return contestType || 'Tournament';
  }
}

export default function LeaderboardPage() {
  const { user: currentUser, apiCall, loading: userLoading } = useUser();
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardData | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  
  // Slideshow states
  const [currentSlide, setCurrentSlide] = useState(0);
  
  // Filter states
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [selectedGame, setSelectedGame] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showDepartmentDropdown, setShowDepartmentDropdown] = useState(false);
  const [showGameDropdown, setShowGameDropdown] = useState(false);
  
  // Ref for scrolling to current user
  const currentUserRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Only load data if user context is ready
    if (!userLoading) {
      if (currentUser) {
        loadLeaderboardData();
      } else {
        // User is not logged in, redirect to login
        window.location.href = '/auth/login';
        return;
      }
    }
  }, [userLoading, currentUser]);


  // Auto-refresh leaderboard data every 30 seconds
  useEffect(() => {
    if (!userLoading && !currentUser) return;

    const interval = setInterval(() => {
      // Load data silently without showing loading state
      loadLeaderboardDataSilently();
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [userLoading, currentUser]);

  const loadLeaderboardDataSilently = async () => {
    try {
      const response = await apiCall('/api/leaderboard?verifiedOnly=true');
      if (response.ok) {
        const data = await response.json();
        setLeaderboardData(data);
      }
    } catch (error) {
      console.error('Failed to load leaderboard data silently:', error);
    }
    // Note: No setDataLoading(false) here to avoid showing loading state
  };

  const loadLeaderboardData = async () => {
    setDataLoading(true);
    try {
      const response = await apiCall('/api/leaderboard?verifiedOnly=true');
      if (response.ok) {
        const data = await response.json();
        setLeaderboardData(data);
      }
    } catch (error) {
      console.error('Failed to load leaderboard data:', error);
    } finally {
      setDataLoading(false);
    }
  };

  // Get total slides (1 global + game-specific leaderboards)
  const getTotalSlides = () => {
    if (!leaderboardData) return 1;
    return 1 + leaderboardData.gameLeaderboards.length;
  };

  // Get current leaderboard data based on slide
  const getCurrentLeaderboard = () => {
    if (!leaderboardData) return null;
    
    if (currentSlide === 0) {
      // Global leaderboard
      return {
        type: 'global',
        title: 'Global Leaderboard',
        subtitle: 'Ranked by total weightage points from tournament wins',
        entries: getFilteredUsers(),
        categoryName: null,
        gameInfo: null
      };
    } else {
      // Game-specific leaderboard
      const gameIndex = currentSlide - 1;
      const gameLeaderboard = leaderboardData.gameLeaderboards[gameIndex];
      if (!gameLeaderboard) return null;
      
      return {
        type: 'game',
        title: gameLeaderboard.gameName,
        subtitle: `${gameLeaderboard.categoryName} • ${gameLeaderboard.typeFormat} • ${gameLeaderboard.totalParticipants} participants`,
        entries: gameLeaderboard.isTeamBased
          ? getFilteredTeamEntries(gameLeaderboard.entries as TeamLeaderboardUser[])
          : getFilteredGameEntries(gameLeaderboard.entries as LeaderboardUser[]),
        categoryName: gameLeaderboard.categoryName,
        gameInfo: {
          weightage: gameLeaderboard.weightage,
          contestType: gameLeaderboard.contestType,
          winners: gameLeaderboard.winners,
          isTeamBased: gameLeaderboard.isTeamBased
        }
      };
    }
  };

  // Filter functions
  const getFilteredUsers = () => {
    if (!leaderboardData?.users) return [];
    
    return leaderboardData.users.filter(user => {
      const departmentMatch = selectedDepartment === 'all' || user.department === selectedDepartment;
      const searchMatch = searchTerm === '' || 
        user.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (user.department && user.department.toLowerCase().includes(searchTerm.toLowerCase()));
      
      return departmentMatch && searchMatch;
    });
  };

  const getFilteredGameEntries = (entries: LeaderboardUser[]) => {
    return entries.filter(user => {
      const departmentMatch = selectedDepartment === 'all' || user.department === selectedDepartment;
      const searchMatch = searchTerm === '' || 
        user.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (user.department && user.department.toLowerCase().includes(searchTerm.toLowerCase()));
      
      return departmentMatch && searchMatch;
    });
  };

  const getFilteredTeamEntries = (entries: TeamLeaderboardUser[]) => {
    return entries.filter(team => {
      const searchMatch = searchTerm === '' ||
        team.teamName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        team.members.some(member =>
          member.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          member.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          member.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (member.department && member.department.toLowerCase().includes(searchTerm.toLowerCase()))
        );
      
      const departmentMatch = selectedDepartment === 'all' ||
        team.members.some(member => member.department === selectedDepartment);
      
      return departmentMatch && searchMatch;
    });
  };

  const getFilteredDepartments = () => {
    if (!leaderboardData?.departments) return [];
    
    return leaderboardData.departments.filter(dept => {
      return selectedDepartment === 'all' || dept.department === selectedDepartment;
    });
  };

  // Navigation functions
  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % getTotalSlides());
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + getTotalSlides()) % getTotalSlides());
  };

  const goToSlide = (index: number) => {
    setCurrentSlide(index);
  };

  // Handle game filter change
  const handleGameFilterChange = (gameId: string) => {
    setSelectedGame(gameId);
    setShowGameDropdown(false);
    
    if (gameId === 'all') {
      setCurrentSlide(0); // Go to global leaderboard
    } else {
      // Find the game index and go to that slide
      const gameIndex = leaderboardData?.gameLeaderboards.findIndex(game => game.gameId === gameId);
      if (gameIndex !== undefined && gameIndex >= 0) {
        setCurrentSlide(gameIndex + 1);
      }
    }
  };

  const scrollToCurrentUser = () => {
    if (currentUserRef.current) {
      currentUserRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    }
  };

  const getCurrentUserRank = () => {
    const currentLeaderboard = getCurrentLeaderboard();
    if (!currentUser || !currentLeaderboard) return null;
    
    // For team-based games, find the team that contains the current user
    if (currentLeaderboard.gameInfo?.isTeamBased) {
      const team = currentLeaderboard.entries.find((entry: any) =>
        entry.members?.some((member: any) => String(member.userId) === String(currentUser.id))
      );
      return team?.rank || null;
    } else {
      // For individual games, find the user directly
      const user = currentLeaderboard.entries.find((u: any) =>
        String(u.id || u.userId) === String(currentUser.id)
      );
      return user?.rank || null;
    }
  };

  const getCurrentLeaderboardContext = () => {
    if (currentSlide === 0) {
      return 'Global';
    } else {
      const gameIndex = currentSlide - 1;
      const gameLeaderboard = leaderboardData?.gameLeaderboards[gameIndex];
      return gameLeaderboard?.gameName || 'Game';
    }
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-white">Redirecting to login...</div>
      </div>
    );
  }

  const currentLeaderboard = getCurrentLeaderboard();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <Navigation currentPage="leaderboard" />

      {/* Main Content */}
      <main className="container mx-auto px-3 sm:px-4 py-6 sm:py-8">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-3 sm:mb-4">Leaderboard</h1>
          <p className="text-lg sm:text-xl text-slate-300 max-w-3xl">
            Track the competition! Points are awarded based on game difficulty (weightage) and wins. 
            See who's leading the pack and which departments are dominating.
          </p>
        </div>

        {/* Enhanced Filters */}
        <Card className="mb-6 sm:mb-8 bg-slate-800/50 border-slate-700">
          <CardContent className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 items-stretch sm:items-center">
              {/* Search */}
              <div className="flex-1 min-w-0">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
                  <Input
                    placeholder="Search players..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 bg-slate-700/50 border-slate-600 text-white placeholder-slate-400 h-9"
                  />
                </div>
              </div>
              
              {/* Filter Buttons Row */}
              <div className="flex gap-2 flex-wrap sm:flex-nowrap">
                {/* Department Dropdown */}
                <div className="relative flex-1 sm:flex-none">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowDepartmentDropdown(!showDepartmentDropdown)}
                    className="bg-slate-700/50 border-slate-600 text-white hover:bg-slate-600/50 h-9 px-3 text-xs w-full sm:w-auto"
                  >
                    <Filter className="h-3 w-3 mr-1" />
                    <span className="hidden sm:inline">{selectedDepartment === 'all' ? 'All Departments' : selectedDepartment}</span>
                    <span className="sm:hidden">{selectedDepartment === 'all' ? 'All Depts' : selectedDepartment}</span>
                  </Button>
                  {showDepartmentDropdown && (
                    <div className="absolute top-full mt-2 w-48 bg-slate-800 border border-slate-600 rounded-lg shadow-lg z-10">
                      <div className="p-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedDepartment('all');
                            setShowDepartmentDropdown(false);
                          }}
                          className="w-full justify-start text-white hover:bg-slate-700"
                        >
                          All Departments
                        </Button>
                        {leaderboardData?.availableDepartments.map(dept => (
                          <Button
                            key={dept.id}
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedDepartment(dept.name);
                              setShowDepartmentDropdown(false);
                            }}
                            className="w-full justify-start text-white hover:bg-slate-700"
                          >
                            {dept.name}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Game Filter Dropdown */}
                <div className="relative flex-1 sm:flex-none">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowGameDropdown(!showGameDropdown)}
                    className="bg-slate-700/50 border-slate-600 text-white hover:bg-slate-600/50 h-9 px-3 text-xs w-full sm:w-auto"
                  >
                    <Gamepad2 className="h-3 w-3 mr-1" />
                    <span className="hidden sm:inline">{selectedGame === 'all' ? 'All Games' : leaderboardData?.availableGames.find(g => g.id === selectedGame)?.name || 'Select Game'}</span>
                    <span className="sm:hidden">{selectedGame === 'all' ? 'All Games' : 'Game'}</span>
                  </Button>
                  {showGameDropdown && (
                    <div className="absolute top-full mt-2 w-64 bg-slate-800 border border-slate-600 rounded-lg shadow-lg z-10 max-h-64 overflow-y-auto">
                      <div className="p-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleGameFilterChange('all')}
                          className="w-full justify-start text-white hover:bg-slate-700"
                        >
                          <Trophy className="h-4 w-4 mr-2" />
                          Global Leaderboard
                        </Button>
                        {leaderboardData?.availableGames.map(game => (
                          <Button
                            key={game.id}
                            variant="ghost"
                            size="sm"
                            onClick={() => handleGameFilterChange(game.id)}
                            className="w-full justify-start text-white hover:bg-slate-700"
                          >
                            <div className="flex flex-col items-start">
                              <span className="text-sm">{game.name}</span>
                              <span className="text-xs text-slate-400">{game.categoryName} • {game.typeFormat}</span>
                            </div>
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Find Me Button */}
                {currentUser && currentLeaderboard && (
                  (currentLeaderboard.gameInfo?.isTeamBased
                    ? currentLeaderboard.entries.some((entry: any) =>
                        entry.members?.some((member: any) => String(member.userId) === String(currentUser.id))
                      )
                    : currentLeaderboard.entries.some((u: any) => String(u.id || u.userId) === String(currentUser.id))
                  )
                ) && (
                  <div className="w-full sm:w-auto">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={scrollToCurrentUser}
                      className="bg-blue-500/10 border-blue-400/50 text-blue-300 hover:bg-blue-500/20 h-9 px-3 text-xs w-full sm:w-auto"
                    >
                      <MapPin className="h-3 w-3 mr-1" />
                      <span className="hidden sm:inline">{currentLeaderboard?.gameInfo?.isTeamBased ? 'Find My Team' : 'Find Me'} {getCurrentUserRank() ? `(#${getCurrentUserRank()} in ${getCurrentLeaderboardContext()})` : `in ${getCurrentLeaderboardContext()}`}</span>
                      <span className="sm:hidden">{currentLeaderboard?.gameInfo?.isTeamBased ? 'My Team' : 'Find Me'}</span>
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Overall Progress Bar */}
        {leaderboardData && (
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white text-xl flex items-center">
                <TrendingUp className="h-5 w-5 mr-2 text-green-400" />
                Overall Tournament Progress
              </CardTitle>
              <CardDescription className="text-slate-300">
                Progress across all active games and categories
              </CardDescription>
            </CardHeader>
            <CardContent>
              {(() => {
                // Calculate overall progress
                const activeGames = leaderboardData.gameLeaderboards || [];
                const totalGames = activeGames.length;
                const completedGames = activeGames.filter(game => game.isCompleted).length;
                const progressPercentage = totalGames > 0 ? (completedGames / totalGames) * 100 : 0;
                
                // Find overall leader
                const globalLeader = leaderboardData.users && leaderboardData.users.length > 0
                  ? leaderboardData.users[0]
                  : null;

                return (
                  <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 lg:gap-6">
                    {/* Progress Section */}
                    <div className="flex-1 w-full lg:w-auto space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-300">Games Completed</span>
                        <span className="text-white font-medium">{completedGames} / {totalGames}</span>
                      </div>
                      <div className="w-full bg-slate-700 rounded-full h-4">
                        <div
                          className="bg-gradient-to-r from-green-500 to-blue-500 h-4 rounded-full transition-all duration-500 ease-out"
                          style={{ width: `${progressPercentage}%` }}
                        />
                      </div>
                      <div className="text-center">
                        <span className="text-xl font-bold text-white">{Math.round(progressPercentage)}%</span>
                        <span className="text-slate-400 text-sm ml-1">Complete</span>
                      </div>
                    </div>

                    {/* Current Leader */}
                    {globalLeader && globalLeader.totalPoints > 0 && (
                      <div className="w-full lg:w-auto lg:min-w-0">
                        <div className="flex items-center space-x-3 lg:space-x-4 p-3 lg:p-4 bg-gradient-to-r from-yellow-500/10 to-orange-500/10 rounded-lg border border-yellow-500/20">
                          <div className="relative flex-shrink-0">
                            {globalLeader.avatarUrl ? (
                              <img
                                src={globalLeader.avatarUrl}
                                alt={`${globalLeader.firstName} ${globalLeader.lastName}`}
                                className="w-12 h-12 lg:w-16 lg:h-16 rounded-full object-cover border-2 border-yellow-400"
                              />
                            ) : (
                              <div className="w-12 h-12 lg:w-16 lg:h-16 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-black font-bold text-lg lg:text-xl border-2 border-yellow-400">
                                {globalLeader.firstName?.charAt(0) || '?'}{globalLeader.lastName?.charAt(0) || '?'}
                              </div>
                            )}
                            <div className="absolute -top-1 -right-1">
                              <Crown className="h-5 w-5 lg:h-7 lg:w-7 text-yellow-400" />
                            </div>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold text-yellow-400 flex items-center text-xs lg:text-sm">
                              <span className="mr-1">🏆</span>
                              <span>{Math.round(progressPercentage) === 100 ? 'Tournament Winner' : 'Current Leader'}</span>
                            </div>
                            <div className="text-white font-bold text-base lg:text-lg truncate">
                              {globalLeader.firstName} {globalLeader.lastName}
                            </div>
                            {globalLeader.jobTitle && (
                              <div className="text-xs lg:text-sm text-blue-300 font-medium truncate">
                                {globalLeader.jobTitle}
                              </div>
                            )}
                            <div className="text-xs lg:text-sm text-slate-300 truncate">
                              {globalLeader.department || 'No Department'}
                            </div>
                            <div className="flex items-center space-x-2 lg:space-x-3 mt-1">
                              <span className="text-yellow-400 font-bold text-sm lg:text-lg">{globalLeader.totalPoints} pts</span>
                              <span className="text-slate-300 text-xs lg:text-sm">{globalLeader.totalWins} wins</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 lg:gap-6 xl:gap-8">
          {/* Main Slideshow Leaderboard */}
          <div className="xl:col-span-2">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-white text-xl sm:text-2xl flex items-center">
                      {currentLeaderboard?.type === 'global' ? (
                        <Trophy className="h-5 w-5 sm:h-6 sm:w-6 mr-2 text-yellow-400 flex-shrink-0" />
                      ) : (
                        <Gamepad2 className="h-5 w-5 sm:h-6 sm:w-6 mr-2 text-blue-400 flex-shrink-0" />
                      )}
                      <span className="truncate">{currentLeaderboard?.title || 'Loading...'}</span>
                    </CardTitle>
                    <CardDescription className="text-slate-300 text-sm">
                      {currentLeaderboard?.subtitle || 'Loading leaderboard data...'}
                    </CardDescription>
                    {currentLeaderboard?.gameInfo && (
                      <div className="mt-2 space-y-2">
                        <div className="flex flex-wrap gap-1 sm:gap-2">
                          <span className="px-2 py-1 bg-blue-500/20 text-blue-300 rounded text-xs">
                            Weightage: {currentLeaderboard.gameInfo.weightage}
                          </span>
                          <span className="px-2 py-1 bg-purple-500/20 text-purple-300 rounded text-xs">
                            {getContestTypeDisplayName(currentLeaderboard.gameInfo.contestType)}
                          </span>
                        </div>
                        {/* Game Progress Indicator */}
                        {(() => {
                          const gameIndex = currentSlide - 1;
                          const gameData = leaderboardData?.gameLeaderboards[gameIndex];
                          if (!gameData) return null;
                          
                          const gameProgressPercentage = gameData.totalMatches > 0
                            ? (gameData.completedMatches / gameData.totalMatches) * 100
                            : 0;
                          
                          return (
                            <div className="space-y-1">
                              <div className="flex justify-between text-xs">
                                <span className="text-slate-400">Game Progress</span>
                                <span className="text-slate-300">
                                  {gameData.completedMatches} / {gameData.totalMatches} matches
                                </span>
                              </div>
                              <div className="w-full bg-slate-700 rounded-full h-2">
                                <div
                                  className={`h-2 rounded-full transition-all duration-500 ease-out ${
                                    gameData.isCompleted
                                      ? 'bg-gradient-to-r from-green-500 to-emerald-500'
                                      : 'bg-gradient-to-r from-yellow-500 to-orange-500'
                                  }`}
                                  style={{ width: `${gameProgressPercentage}%` }}
                                />
                              </div>
                              <div className="flex justify-between items-center">
                                <span className={`text-xs font-medium ${
                                  gameData.isCompleted ? 'text-green-400' : 'text-yellow-400'
                                }`}>
                                  {Math.round(gameProgressPercentage)}% Complete
                                </span>
                                {gameData.isCompleted && (
                                  <span className="text-xs bg-green-500/20 text-green-300 px-2 py-0.5 rounded border border-green-500/30">
                                    ✓ Completed
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                  
                  {/* Navigation Controls */}
                  <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={prevSlide}
                      disabled={getTotalSlides() <= 1}
                      className="bg-slate-700/50 border-slate-600 text-white hover:bg-slate-600/50 h-8 w-8 p-0"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-slate-300 text-xs sm:text-sm px-1 sm:px-2 whitespace-nowrap">
                      {currentSlide + 1} / {getTotalSlides()}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={nextSlide}
                      disabled={getTotalSlides() <= 1}
                      className="bg-slate-700/50 border-slate-600 text-white hover:bg-slate-600/50 h-8 w-8 p-0"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                
                {/* Slide Indicators */}
                {getTotalSlides() > 1 && (
                  <div className="flex justify-center mt-4 gap-2">
                    {(() => {
                      const totalSlides = getTotalSlides();
                      const maxDotsOnMobile = 5;
                      
                      // For desktop or when slides <= 5, show all dots
                      const shouldShowAllDots = totalSlides <= maxDotsOnMobile;
                      
                      if (shouldShowAllDots) {
                        return Array.from({ length: totalSlides }, (_, index) => (
                          <button
                            key={index}
                            onClick={() => goToSlide(index)}
                            className={`w-2 h-2 rounded-full transition-colors ${
                              index === currentSlide
                                ? 'bg-blue-400'
                                : 'bg-slate-600 hover:bg-slate-500'
                            }`}
                          />
                        ));
                      }
                      
                      // For mobile with more than 5 slides, show subset of 5 dots
                      const startIndex = Math.max(0, Math.min(currentSlide - 2, totalSlides - maxDotsOnMobile));
                      const endIndex = Math.min(startIndex + maxDotsOnMobile, totalSlides);
                      
                      return (
                        <>
                          {/* Show first dot and ellipsis if we're not at the beginning */}
                          <div className="hidden sm:contents">
                            {Array.from({ length: totalSlides }, (_, index) => (
                              <button
                                key={index}
                                onClick={() => goToSlide(index)}
                                className={`w-2 h-2 rounded-full transition-colors ${
                                  index === currentSlide
                                    ? 'bg-blue-400'
                                    : 'bg-slate-600 hover:bg-slate-500'
                                }`}
                              />
                            ))}
                          </div>
                          
                          {/* Mobile view with max 5 dots */}
                          <div className="flex sm:hidden gap-2">
                            {startIndex > 0 && (
                              <>
                                <button
                                  onClick={() => goToSlide(0)}
                                  className="w-2 h-2 rounded-full bg-slate-600 hover:bg-slate-500 transition-colors"
                                />
                                {startIndex > 1 && (
                                  <span className="text-slate-400 text-xs self-center">...</span>
                                )}
                              </>
                            )}
                            
                            {Array.from({ length: endIndex - startIndex }, (_, i) => {
                              const index = startIndex + i;
                              return (
                                <button
                                  key={index}
                                  onClick={() => goToSlide(index)}
                                  className={`w-2 h-2 rounded-full transition-colors ${
                                    index === currentSlide
                                      ? 'bg-blue-400'
                                      : 'bg-slate-600 hover:bg-slate-500'
                                  }`}
                                />
                              );
                            })}
                            
                            {endIndex < totalSlides && (
                              <>
                                {endIndex < totalSlides - 1 && (
                                  <span className="text-slate-400 text-xs self-center">...</span>
                                )}
                                <button
                                  onClick={() => goToSlide(totalSlides - 1)}
                                  className="w-2 h-2 rounded-full bg-slate-600 hover:bg-slate-500 transition-colors"
                                />
                              </>
                            )}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                )}
              </CardHeader>
              
              <CardContent>
                {/* Winners Section for Game Leaderboards - Only show when game is complete */}
                {currentLeaderboard?.gameInfo?.winners && currentLeaderboard.gameInfo.winners.filter(w => w.totalPoints > 0).length > 0 && (() => {
                  const gameIndex = currentSlide - 1;
                  const gameData = leaderboardData?.gameLeaderboards[gameIndex];
                  return gameData?.isCompleted || false;
                })() && (
                  <div className="mb-6 p-4 bg-gradient-to-r from-yellow-500/10 to-orange-500/10 rounded-lg border border-yellow-500/20">
                    <h3 className="text-lg font-semibold text-yellow-400 mb-3 flex items-center">
                      <Trophy className="h-5 w-5 mr-2" />
                      Winners
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {currentLeaderboard.gameInfo.winners.filter((w: any) => w.totalPoints > 0).slice(0, 3).map((winner: any, index: number) => (
                        <div
                          key={winner.userId || winner.teamName}
                          className={`p-3 rounded-lg text-center ${
                            index === 0
                              ? 'bg-gradient-to-b from-yellow-400/20 to-yellow-600/20 border border-yellow-400/30'
                              : index === 1
                              ? 'bg-gradient-to-b from-gray-300/20 to-gray-500/20 border border-gray-400/30'
                              : 'bg-gradient-to-b from-amber-400/20 to-amber-600/20 border border-amber-400/30'
                          }`}
                        >
                          <div className="flex justify-center mb-2">
                            {getRankIcon(index + 1)}
                          </div>
                          <div className="font-semibold text-white text-sm">
                            {winner.teamName ? (
                              <>
                                {winner.teamName}
                                <div className="text-xs text-slate-400 mt-1">
                                  {winner.members?.map((member: any, idx: number) => (
                                    <span key={member.userId}>
                                      {member.firstName} {member.lastName}
                                      {idx < winner.members.length - 1 ? ', ' : ''}
                                    </span>
                                  ))}
                                </div>
                              </>
                            ) : (
                              `${winner.firstName} ${winner.lastName}`
                            )}
                          </div>
                          {!winner.teamName && winner.jobTitle && (
                            <div className="text-xs text-blue-300 font-medium">{winner.jobTitle}</div>
                          )}
                          {!winner.teamName && (
                            <div className="text-xs text-slate-400">{winner.department}</div>
                          )}
                          <div className="text-sm font-bold text-white mt-1">
                            {winner.totalPoints} pts
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  {dataLoading ? (
                    <div className="text-center py-8">
                      <div className="text-slate-400">Loading leaderboard...</div>
                    </div>
                  ) : currentLeaderboard && currentLeaderboard.entries.length > 0 ? (
                    (() => {
                      // Calculate progress for styling logic
                      const activeGames = leaderboardData?.gameLeaderboards || [];
                      const totalGames = activeGames.length;
                      const completedGames = activeGames.filter(game => game.isCompleted).length;
                      const progressPercentage = totalGames > 0 ? (completedGames / totalGames) * 100 : 0;
                      const isProgressComplete = Math.round(progressPercentage) === 100;
                      
                      // Show all entries regardless of progress
                      const entriesToShow = currentLeaderboard.entries;
                      
                      return entriesToShow.map((player: any) => {
                      const isCurrentUser = currentUser && (
                        currentLeaderboard.gameInfo?.isTeamBased
                          ? player.members?.some((member: any) => String(member.userId) === String(currentUser.id))
                          : String(player.id || player.userId) === String(currentUser.id)
                      );
                      return (
                      <div
                        key={player.id || player.userId || player.teamName}
                        ref={isCurrentUser ? currentUserRef : null}
                        className={`relative flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 rounded-lg transition-colors gap-3 sm:gap-0 ${
                          isCurrentUser
                            ? 'bg-gradient-to-r from-blue-500/20 to-purple-500/20 border-2 border-blue-400/50 shadow-lg'
                            : player.rank <= 3 && player.totalPoints > 0 && isProgressComplete && currentLeaderboard.type === 'global'
                            ? 'bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/20'
                            : 'bg-slate-700/50 hover:bg-slate-700/70'
                        }`}
                      >
                        {/* Current User/Team Badge */}
                        {isCurrentUser && (
                          <div className="absolute -top-2 -left-2 z-10">
                            <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-2 py-1 rounded-full text-xs font-bold">
                              {currentLeaderboard.gameInfo?.isTeamBased ? 'YOUR TEAM' : 'YOU'}
                            </div>
                          </div>
                        )}
                        {/* Top 3 Badge - Only show if user has points and is in top 3 */}
                        {player.rank <= 3 && player.totalPoints > 0 && isProgressComplete && currentLeaderboard.type === 'global' && (
                          <div className="absolute -top-2 -right-2 z-10">
                            <div className={`px-2 py-1 rounded-full text-xs font-bold ${
                              player.rank === 1
                                ? 'bg-gradient-to-r from-yellow-400 to-yellow-600 text-black'
                                : player.rank === 2
                                ? 'bg-gradient-to-r from-gray-300 to-gray-500 text-black'
                                : 'bg-gradient-to-r from-amber-500 to-amber-700 text-white'
                            }`}>
                              {player.rank === 1 ? '🥇 1st' : player.rank === 2 ? '🥈 2nd' : '🥉 3rd'}
                            </div>
                          </div>
                        )}
                        
                        <div className="flex items-center space-x-2 sm:space-x-4 flex-1 min-w-0 w-full sm:w-auto">
                          <div className="flex items-center space-x-2 sm:space-x-3">
                            {/* Avatar */}
                            <div className="relative">
                              {player.avatarUrl ? (
                                <img
                                  src={player.avatarUrl}
                                  alt={`${player.firstName} ${player.lastName}`}
                                  className="w-10 h-10 sm:w-12 sm:h-12 rounded-full object-cover border-2 border-slate-600"
                                />
                              ) : (
                                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm sm:text-lg border-2 border-slate-600">
                                  {player.firstName?.charAt(0) || '?'}{player.lastName?.charAt(0) || '?'}
                                </div>
                              )}
                              {/* Rank badge overlay */}
                              <div className="absolute -bottom-1 -right-1 flex items-center justify-center w-5 h-5 sm:w-6 sm:h-6">
                                {player.totalPoints > 0 ? getRankIcon(player.rank, true) : getRankIcon(player.rank, false)}
                              </div>
                            </div>
                          </div>
                          <div>
                            <div className="font-semibold text-white flex items-center space-x-1 sm:space-x-2 min-w-0">
                              <span className="truncate">
                                {player.teamName ? (
                                  <>
                                    <span className="block truncate">{player.teamName}</span>
                                    <div className="text-xs text-slate-400 mt-1 truncate">
                                      {player.members?.map((member: any, idx: number) => (
                                        <span key={member.userId}>
                                          {member.firstName} {member.lastName}
                                          {idx < player.members.length - 1 ? ', ' : ''}
                                        </span>
                                      ))}
                                    </div>
                                  </>
                                ) : (
                                  <span className="truncate">{`${player.firstName} ${player.lastName}`}</span>
                                )}
                              </span>
                              {player.rank <= 3 && player.totalPoints > 0 && isProgressComplete && currentLeaderboard.type === 'global' && (
                                <span className={`hidden sm:inline-block text-xs px-2 py-0.5 rounded-full ${
                                  player.rank === 1
                                    ? 'bg-yellow-500/20 text-yellow-300'
                                    : player.rank === 2
                                    ? 'bg-gray-400/20 text-gray-300'
                                    : 'bg-amber-500/20 text-amber-300'
                                }`}>
                                  TOP {player.rank}
                                </span>
                              )}
                            </div>
                            {!player.teamName && player.jobTitle && (
                              <div className="mt-1">
                                <span className="text-sm text-blue-300 font-medium">{player.jobTitle}</span>
                              </div>
                            )}
                            {!player.teamName && (
                              <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
                                {/* Department */}
                                <span className="inline-flex items-center px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-md bg-blue-500/20 text-blue-300 text-xs sm:text-sm font-medium border border-blue-400/30">
                                  <span className="hidden sm:inline">🏢 </span>{player.department || 'No Department'}
                                </span>
                                
                                {/* Gender */}
                                {player.gender && player.gender !== 'PREFER_NOT_TO_SAY' && (
                                  <span className="inline-flex items-center px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-md bg-purple-500/20 text-purple-300 text-xs sm:text-sm font-medium border border-purple-400/30">
                                    {player.gender === 'MALE' ? '♂️' : player.gender === 'FEMALE' ? '♀️' : player.gender}
                                    <span className="hidden sm:inline ml-1">{player.gender === 'MALE' ? 'Male' : player.gender === 'FEMALE' ? 'Female' : ''}</span>
                                  </span>
                                )}
                                
                                {/* Age */}
                                {player.age && (
                                  <span className="inline-flex items-center px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-md bg-green-500/20 text-green-300 text-xs sm:text-sm font-medium border border-green-400/30">
                                    <span className="hidden sm:inline">🎂 </span>{player.age}<span className="hidden sm:inline"> years</span>
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex sm:flex-col sm:text-right flex-shrink-0 justify-between sm:justify-start items-center sm:items-end w-full sm:w-auto mt-2 sm:mt-0">
                          <div className="text-lg sm:text-xl lg:text-2xl font-bold text-white">{player.totalPoints}</div>
                          <div className="text-xs sm:text-sm text-slate-400">
                            {player.totalWins}/{player.gamesPlayed} wins
                          </div>
                          <div className="text-xs text-slate-500 hidden sm:block">
                            {(player.winRate || 0).toFixed(1)}% rate
                          </div>
                        </div>
                      </div>
                      );
                    });
                    })()
                  ) : (
                    <div className="text-center py-8">
                      <div className="text-slate-400">No leaderboard data available</div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Department Stats & Quick Stats */}
          <div className="space-y-4 lg:space-y-6">
            {/* Match Feed */}
            <MatchFeed />
            
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white text-xl flex items-center">
                  <Users className="h-5 w-5 mr-2 text-blue-400" />
                  Department Rankings
                </CardTitle>
                <CardDescription className="text-slate-300">
                  Average points per member
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {dataLoading ? (
                    <div className="text-center py-4">
                      <div className="text-slate-400">Loading departments...</div>
                    </div>
                  ) : getFilteredDepartments().length > 0 ? (
                    getFilteredDepartments()
                      .sort((a, b) => (b.avgPoints || 0) - (a.avgPoints || 0))
                      .map((dept, index) => (
                        <div key={dept.department} className="flex items-center justify-between">
                          <div>
                            <div className="font-medium text-white">{dept.department}</div>
                            <div className="text-sm text-slate-400">{dept.members} members</div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-white">{(dept.avgPoints || 0).toFixed(1)}</div>
                            <div className="text-sm text-slate-400">avg points</div>
                          </div>
                        </div>
                      ))
                  ) : (
                    <div className="text-center py-4">
                      <div className="text-slate-400">No department data available</div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white text-xl flex items-center">
                  <Target className="h-5 w-5 mr-2 text-green-400" />
                  Quick Stats
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Participation Overview */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:gap-4">
                    <div className="bg-slate-700/30 p-3 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Users className="h-4 w-4 text-blue-400" />
                          <span className="text-slate-300 text-sm">Total Players</span>
                        </div>
                        <span className="font-bold text-white text-lg">
                          {dataLoading ? '...' : leaderboardData?.stats?.totalUsers || 0}
                        </span>
                      </div>
                    </div>
                    <div className="bg-slate-700/30 p-3 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <UserCheck className="h-4 w-4 text-green-400" />
                          <span className="text-slate-300 text-sm">Active Players</span>
                        </div>
                        <span className="font-bold text-white text-lg">
                          {dataLoading ? '...' : leaderboardData?.stats?.activeUsers || 0}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Participation Rate */}
                  <div className="bg-gradient-to-r from-green-500/10 to-blue-500/10 p-3 rounded-lg border border-green-500/20">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <TrendingUp className="h-4 w-4 text-green-400" />
                        <span className="text-slate-300">Participation Rate</span>
                      </div>
                      <span className="font-bold text-green-400 text-lg">
                        {dataLoading ? '...' : `${leaderboardData?.stats?.participationRate || 0}%`}
                      </span>
                    </div>
                  </div>

                  {/* Gender Distribution */}
                  {!dataLoading && leaderboardData?.users && (
                    <div className="space-y-3">
                      <h4 className="text-slate-300 font-medium text-sm">Gender Distribution</h4>
                      {(() => {
                        const genderCounts = leaderboardData.users.reduce((acc: Record<string, number>, user: any) => {
                          if (user.gender && user.gender !== 'PREFER_NOT_TO_SAY') {
                            acc[user.gender] = (acc[user.gender] || 0) + 1;
                          } else {
                            acc['NOT_SPECIFIED'] = (acc['NOT_SPECIFIED'] || 0) + 1;
                          }
                          return acc;
                        }, {} as Record<string, number>);

                        const totalWithGender = Object.values(genderCounts).reduce((sum: number, count: number) => sum + count, 0);

                        return (
                          <div className="grid grid-cols-2 gap-3">
                            {/* Male Count */}
                            <div className="bg-slate-700/30 p-3 rounded-lg">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-2">
                                  <span className="text-blue-400 text-sm">♂️</span>
                                  <span className="text-slate-300 text-sm">Male</span>
                                </div>
                                <div className="text-right">
                                  <span className="font-bold text-white text-lg">
                                    {genderCounts.MALE || 0}
                                  </span>
                                  <div className="text-xs text-slate-400">
                                    {totalWithGender > 0 ? Math.round(((genderCounts.MALE || 0) / totalWithGender) * 100) : 0}%
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Female Count */}
                            <div className="bg-slate-700/30 p-3 rounded-lg">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-2">
                                  <span className="text-pink-400 text-sm">♀️</span>
                                  <span className="text-slate-300 text-sm">Female</span>
                                </div>
                                <div className="text-right">
                                  <span className="font-bold text-white text-lg">
                                    {genderCounts.FEMALE || 0}
                                  </span>
                                  <div className="text-xs text-slate-400">
                                    {totalWithGender > 0 ? Math.round(((genderCounts.FEMALE || 0) / totalWithGender) * 100) : 0}%
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Not Specified Count */}
                            {genderCounts.NOT_SPECIFIED > 0 && (
                              <div className="bg-slate-700/30 p-3 rounded-lg col-span-2">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center space-x-2">
                                    <span className="text-slate-400 text-sm">👤</span>
                                    <span className="text-slate-300 text-sm">Not Specified</span>
                                  </div>
                                  <div className="text-right">
                                    <span className="font-bold text-white text-lg">
                                      {genderCounts.NOT_SPECIFIED}
                                    </span>
                                    <div className="text-xs text-slate-400">
                                      {totalWithGender > 0 ? Math.round((genderCounts.NOT_SPECIFIED / totalWithGender) * 100) : 0}%
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* Games & Matches */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-700/30 p-3 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Gamepad2 className="h-4 w-4 text-purple-400" />
                          <span className="text-slate-300 text-sm">Active Games</span>
                        </div>
                        <span className="font-bold text-white text-lg">
                          {dataLoading ? '...' : leaderboardData?.stats?.activeGames || 0}
                        </span>
                      </div>
                    </div>
                    <div className="bg-slate-700/30 p-3 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Calendar className="h-4 w-4 text-orange-400" />
                          <span className="text-slate-300 text-sm">Categories</span>
                        </div>
                        <span className="font-bold text-white text-lg">
                          {dataLoading ? '...' : leaderboardData?.stats?.activeCategories || 0}
                        </span>
                      </div>
                    </div>
                  </div>
                  {/* Match Statistics */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-300 text-sm">Total Matches Played</span>
                      <span className="font-bold text-white">
                        {dataLoading ? '...' : leaderboardData?.stats?.totalMatches || 0}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-300 text-sm">Individual Wins</span>
                      <span className="font-bold text-blue-400">
                        {dataLoading ? '...' : leaderboardData?.stats?.totalIndividualWins || 0}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-300 text-sm">Team Wins</span>
                      <span className="font-bold text-purple-400">
                        {dataLoading ? '...' : leaderboardData?.stats?.totalTeamWins || 0}
                      </span>
                    </div>
                  </div>

                  {/* Top Performer Highlight */}
                  {!dataLoading && leaderboardData?.stats?.topPerformer && (
                    <div className="bg-gradient-to-r from-yellow-500/10 to-orange-500/10 p-3 rounded-lg border border-yellow-500/20">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Star className="h-4 w-4 text-yellow-400" />
                          <span className="text-slate-300 text-sm">Top Performer</span>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-yellow-400 text-sm">
                            {leaderboardData.stats.topPerformer.firstName} {leaderboardData.stats.topPerformer.lastName}
                          </div>
                          {leaderboardData.stats.topPerformer.jobTitle && (
                            <div className="text-xs text-blue-300 font-medium">
                              {leaderboardData.stats.topPerformer.jobTitle}
                            </div>
                          )}
                          <div className="text-xs text-slate-400">
                            {leaderboardData.stats.topPerformer.totalPoints} points
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Average Performance */}
                  <div className="bg-slate-700/30 p-3 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Zap className="h-4 w-4 text-cyan-400" />
                        <span className="text-slate-300 text-sm">Avg Points/Player</span>
                      </div>
                      <span className="font-bold text-cyan-400 text-lg">
                        {dataLoading ? '...' : leaderboardData?.stats?.avgPointsPerUser || 0}
                      </span>
                    </div>
                  </div>

                  {/* Total Teams */}
                  <div className="flex justify-between items-center">
                    <span className="text-slate-300 text-sm">Total Teams</span>
                    <span className="font-bold text-white">
                      {dataLoading ? '...' : leaderboardData?.stats?.totalTeams || 0}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
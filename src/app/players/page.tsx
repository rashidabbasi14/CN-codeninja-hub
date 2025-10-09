"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Users, Trophy, Target, Search, User, UserCheck, Medal, Award, MapPin, Gamepad2, TrendingUp, Filter, X } from "lucide-react";
import { useUser } from "@/contexts/UserContext";
import Navigation from "@/components/Navigation";
import { useEffect, useState } from "react";
import Image from "next/image";

// TypeScript interfaces
interface PlayerGame {
  id: string;
  name: string;
  category: string;
  level: string;
  mode: string;
}

interface Player {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  gender?: string;
  age?: number;
  avatarUrl?: string;
  jobTitle?: string;
  department?: string;
  registeredGames: PlayerGame[];
  totalGames: number;
  totalPoints: number;
  totalWins: number;
  totalLosses: number;
  totalMatches: number;
  winRate: number;
}

interface PlayersResponse {
  players: Player[];
  totalPlayers: number;
}

// Gender icon component
const GenderIcon = ({ gender }: { gender?: string }) => {
  if (!gender || gender === 'PREFER_NOT_TO_SAY') return null;
  
  return (
    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
      gender === 'MALE' ? 'bg-blue-100 text-blue-600' : 'bg-pink-100 text-pink-600'
    }`}>
      {gender === 'MALE' ? 'M' : 'F'}
    </div>
  );
};

export default function PlayersPage() {
  const { user: currentUser, apiCall, loading: userLoading } = useUser();
  const [players, setPlayers] = useState<Player[]>([]);
  const [filteredPlayers, setFilteredPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [totalPlayers, setTotalPlayers] = useState(0);
  
  // Filter states
  const [selectedGender, setSelectedGender] = useState<string>('all');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [selectedGame, setSelectedGame] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  
  // Available filter options
  const [availableDepartments, setAvailableDepartments] = useState<string[]>([]);
  const [availableGames, setAvailableGames] = useState<string[]>([]);

  // Fetch players data
  useEffect(() => {
    const fetchPlayers = async () => {
      try {
        console.log('Starting to fetch players...');
        
        const response = await apiCall('/api/players');
        console.log('Players API response status:', response.status);

        if (response.ok) {
          const data: PlayersResponse = await response.json();
          console.log('Players data received:', data);
          setPlayers(data.players);
          setFilteredPlayers(data.players);
          setTotalPlayers(data.totalPlayers);
          
          // Extract unique departments and games for filters
          const departments = [...new Set(data.players.map(p => p.department).filter((dept): dept is string => Boolean(dept)))];
          const games = [...new Set(data.players.flatMap(p => p.registeredGames.map(g => g.name)))];
          setAvailableDepartments(departments);
          setAvailableGames(games);
        } else {
          console.error('Failed to fetch players:', response.status, response.statusText);
          const errorText = await response.text();
          console.error('Error response:', errorText);
          
          // Try fallback to basic users API
          console.log('Trying fallback to /api/users...');
          const fallbackResponse = await apiCall('/api/users');
          
          if (fallbackResponse.ok) {
            const fallbackData = await fallbackResponse.json();
            console.log('Fallback users data:', fallbackData);
            
            // Transform basic user data to player format
            const transformedPlayers = fallbackData.map((user: any) => ({
              id: user.id,
              firstName: user.firstName,
              lastName: user.lastName,
              email: user.email,
              department: user.department,
              registeredGames: [],
              totalGames: 0,
              totalPoints: 0,
              totalWins: 0,
              totalLosses: 0,
              totalMatches: 0,
              winRate: 0
            }));
            
            setPlayers(transformedPlayers);
            setFilteredPlayers(transformedPlayers);
            setTotalPlayers(transformedPlayers.length);
            
            // Extract unique departments for filters
            const departments: string[] = [];
            transformedPlayers.forEach((p: any) => {
              if (p.department && typeof p.department === 'string') {
                departments.push(p.department);
              }
            });
            setAvailableDepartments([...new Set(departments)]);
            setAvailableGames([]);
          }
        }
      } catch (error) {
        console.error('Error fetching players:', error);
      } finally {
        setLoading(false);
      }
    };

    // Only fetch if user context is loaded and user exists
    if (!userLoading && currentUser) {
      console.log('User context loaded, current user:', currentUser);
      fetchPlayers();
    } else if (!userLoading && !currentUser) {
      console.log('No current user, stopping fetch');
      setLoading(false);
    }
  }, [userLoading, currentUser, apiCall]);

  // Filter players based on search term and filters
  useEffect(() => {
    let filtered = players;

    // Apply search filter
    if (searchTerm.trim()) {
      filtered = filtered.filter(player =>
        `${player.firstName} ${player.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
        player.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        player.department?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        player.registeredGames.some(game =>
          game.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          game.category.toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    }

    // Apply gender filter
    if (selectedGender !== 'all') {
      filtered = filtered.filter(player => {
        if (selectedGender === 'not_specified') {
          return !player.gender || player.gender === 'PREFER_NOT_TO_SAY';
        }
        return player.gender === selectedGender;
      });
    }

    // Apply department filter
    if (selectedDepartment !== 'all') {
      filtered = filtered.filter(player => player.department === selectedDepartment);
    }

    // Apply game filter
    if (selectedGame !== 'all') {
      filtered = filtered.filter(player =>
        player.registeredGames.some(game => game.name === selectedGame)
      );
    }

    setFilteredPlayers(filtered);
  }, [searchTerm, players, selectedGender, selectedDepartment, selectedGame]);

  // Clear all filters
  const clearFilters = () => {
    setSelectedGender('all');
    setSelectedDepartment('all');
    setSelectedGame('all');
    setSearchTerm('');
  };

  // Check if any filters are active
  const hasActiveFilters = selectedGender !== 'all' || selectedDepartment !== 'all' || selectedGame !== 'all' || searchTerm.trim();

  if (loading || userLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <Navigation currentPage="players" />
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-white text-lg">Loading players...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <Navigation currentPage="players" />
      
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-3 mb-4">
            <Users className="h-8 w-8 text-blue-500" />
            <h1 className="text-3xl font-bold text-white">Players</h1>
          </div>
          <p className="text-slate-400 text-lg">
            Discover all registered players and their gaming achievements
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-6">
              <div className="flex items-center space-x-3">
                <div className="p-3 bg-blue-500/20 rounded-lg">
                  <Users className="h-6 w-6 text-blue-400" />
                </div>
                <div>
                  <p className="text-slate-400 text-sm">Total Players</p>
                  <p className="text-2xl font-bold text-white">{totalPlayers}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-6">
              <div className="flex items-center space-x-3">
                <div className="p-3 bg-green-500/20 rounded-lg">
                  <Trophy className="h-6 w-6 text-green-400" />
                </div>
                <div>
                  <p className="text-slate-400 text-sm">Active Players</p>
                  <p className="text-2xl font-bold text-white">{filteredPlayers.filter(p => p.totalGames > 0).length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-6">
              <div className="flex items-center space-x-3">
                <div className="p-3 bg-purple-500/20 rounded-lg">
                  <Target className="h-6 w-6 text-purple-400" />
                </div>
                <div>
                  <p className="text-slate-400 text-sm">Avg Win Rate</p>
                  <p className="text-2xl font-bold text-white">
                    {players.filter(p => p.totalGames > 0).length > 0 ? Math.round(players.filter(p => p.totalGames > 0).reduce((sum, p) => sum + p.winRate, 0) / players.filter(p => p.totalGames > 0).length) : 0}%
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Filters */}
        <div className="mb-8 space-y-4">
          {/* Search Bar */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                type="text"
                placeholder="Search players, games, or departments..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-slate-800/50 border-slate-700 text-white placeholder-slate-400"
              />
            </div>
            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center space-x-2 bg-slate-800/50 border-slate-700 text-white hover:bg-slate-700"
            >
              <Filter className="h-4 w-4" />
              <span>Filters</span>
              {hasActiveFilters && (
                <span className="bg-blue-500 text-white text-xs px-2 py-1 rounded-full">
                  {[selectedGender !== 'all', selectedDepartment !== 'all', selectedGame !== 'all'].filter(Boolean).length}
                </span>
              )}
            </Button>
          </div>

          {/* Filter Panel */}
          {showFilters && (
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white">Filters</h3>
                  {hasActiveFilters && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearFilters}
                      className="text-slate-400 hover:text-white"
                    >
                      <X className="h-4 w-4 mr-1" />
                      Clear All
                    </Button>
                  )}
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Gender Filter */}
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Gender</label>
                    <select
                      value={selectedGender}
                      onChange={(e) => setSelectedGender(e.target.value)}
                      className="w-full bg-slate-700 border-slate-600 text-white rounded-md px-3 py-2 text-sm"
                    >
                      <option value="all">All Genders</option>
                      <option value="MALE">Male</option>
                      <option value="FEMALE">Female</option>
                      <option value="not_specified">Not Specified</option>
                    </select>
                  </div>

                  {/* Department Filter */}
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Department</label>
                    <select
                      value={selectedDepartment}
                      onChange={(e) => setSelectedDepartment(e.target.value)}
                      className="w-full bg-slate-700 border-slate-600 text-white rounded-md px-3 py-2 text-sm"
                    >
                      <option value="all">All Departments</option>
                      {availableDepartments.map(dept => (
                        <option key={dept} value={dept}>{dept}</option>
                      ))}
                    </select>
                  </div>

                  {/* Game Filter */}
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Game</label>
                    <select
                      value={selectedGame}
                      onChange={(e) => setSelectedGame(e.target.value)}
                      className="w-full bg-slate-700 border-slate-600 text-white rounded-md px-3 py-2 text-sm"
                    >
                      <option value="all">All Games</option>
                      {availableGames.map(game => (
                        <option key={game} value={game}>{game}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Active Filters Display */}
                {hasActiveFilters && (
                  <div className="mt-4 pt-4 border-t border-slate-700">
                    <div className="flex flex-wrap gap-2">
                      {selectedGender !== 'all' && (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs bg-blue-500/20 text-blue-300 border border-blue-500/30">
                          Gender: {selectedGender === 'not_specified' ? 'Not Specified' : selectedGender.toLowerCase()}
                          <button
                            onClick={() => setSelectedGender('all')}
                            className="ml-2 hover:text-white"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      )}
                      {selectedDepartment !== 'all' && (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs bg-green-500/20 text-green-300 border border-green-500/30">
                          Department: {selectedDepartment}
                          <button
                            onClick={() => setSelectedDepartment('all')}
                            className="ml-2 hover:text-white"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      )}
                      {selectedGame !== 'all' && (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs bg-purple-500/20 text-purple-300 border border-purple-500/30">
                          Game: {selectedGame}
                          <button
                            onClick={() => setSelectedGame('all')}
                            className="ml-2 hover:text-white"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Players Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredPlayers.map((player) => (
            <Card key={player.id} className="bg-slate-800/50 border-slate-700 hover:bg-slate-800/70 transition-colors">
              {/* Player Avatar - Full Width Row */}
              <div className="w-full flex justify-center pt-6 pb-4">
                {player.avatarUrl ? (
                  <Image
                    src={player.avatarUrl}
                    alt={`${player.firstName} ${player.lastName}`}
                    width={80}
                    height={80}
                    className="w-20 h-20 rounded-full object-cover border-2 border-slate-600"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-slate-700 flex items-center justify-center border-2 border-slate-600">
                    <User className="h-10 w-10 text-slate-300" />
                  </div>
                )}
              </div>

              <CardHeader className="pt-0 pb-3">
                <div className="text-center">
                  <div className="flex items-center justify-center space-x-2 mb-2">
                    <h3 className="font-semibold text-white text-lg">
                      {player.firstName} {player.lastName}
                    </h3>
                    <GenderIcon gender={player.gender} />
                  </div>
                  {player.jobTitle && (
                    <div className="text-center mb-2">
                      <span className="text-sm text-blue-300 font-medium">{player.jobTitle}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-center space-x-2 text-sm text-slate-400">
                    {player.age && <span>Age {player.age}</span>}
                    {player.department && (
                      <>
                        {player.age && <span>•</span>}
                        <span>{player.department}</span>
                      </>
                    )}
                  </div>
                </div>
              </CardHeader>

              <CardContent className="pt-0">
                {/* Games Registered */}
                <div className="mb-4">
                  <div className="flex items-center space-x-2 mb-2">
                    <Gamepad2 className="h-4 w-4 text-blue-400" />
                    <span className="text-sm font-medium text-slate-300">
                      Games ({player.totalGames})
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {player.totalGames > 0 ? (
                      <>
                        {player.registeredGames.slice(0, 3).map((game, index) => (
                          <span
                            key={index}
                            className="px-2 py-1 bg-slate-700/50 text-xs text-slate-300 rounded"
                            title={`${game.name} (${game.category})`}
                          >
                            {game.name.length > 8 ? `${game.name.substring(0, 8)}...` : game.name}
                          </span>
                        ))}
                        {player.registeredGames.length > 3 && (
                          <span className="px-2 py-1 bg-slate-700/50 text-xs text-slate-400 rounded">
                            +{player.registeredGames.length - 3}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="px-2 py-1 bg-slate-600/30 text-xs text-slate-500 rounded italic">
                        No games registered
                      </span>
                    )}
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className="flex items-center justify-center space-x-1 mb-1">
                      <Trophy className="h-4 w-4 text-yellow-400" />
                      <span className="text-lg font-bold text-white">{player.totalPoints}</span>
                    </div>
                    <p className="text-xs text-slate-400">Total Score</p>
                  </div>
                  
                  <div className="text-center">
                    <div className="flex items-center justify-center space-x-1 mb-1">
                      <TrendingUp className="h-4 w-4 text-green-400" />
                      <span className="text-lg font-bold text-white">{player.winRate}%</span>
                    </div>
                    <p className="text-xs text-slate-400">Win Rate</p>
                  </div>
                </div>

                {/* Win/Loss Record */}
                <div className="mt-4 pt-4 border-t border-slate-700">
                  <div className="flex justify-between text-sm">
                    <span className="text-green-400">
                      <Medal className="h-3 w-3 inline mr-1" />
                      {player.totalWins}W
                    </span>
                    <span className="text-red-400">
                      {player.totalLosses}L
                    </span>
                    <span className="text-slate-400">
                      {player.totalMatches} Total
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* No Results */}
        {filteredPlayers.length === 0 && !loading && (
          <div className="text-center py-12">
            <Users className="h-16 w-16 text-slate-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-slate-400 mb-2">No players found</h3>
            <p className="text-slate-500 mb-4">
              {hasActiveFilters ? 'No players match your current filters' : 'No players have registered for any games yet'}
            </p>
            {hasActiveFilters && (
              <Button
                variant="outline"
                onClick={clearFilters}
                className="bg-slate-800/50 border-slate-700 text-white hover:bg-slate-700"
              >
                Clear All Filters
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
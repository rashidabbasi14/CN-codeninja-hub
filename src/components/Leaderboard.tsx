
"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUser } from "@/contexts/UserContext";
import {
  Trophy,
  Medal,
  Crown,
  Target,
  TrendingUp,
  Users,
  Filter,
  Download,
  RefreshCw,
  MapPin
} from "lucide-react";

interface LeaderboardEntry {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  jobTitle?: string;
  department?: string;
  totalPoints: number;
  totalWins: number;
  gamesPlayed: number;
  winRate: number;
  lastWin?: Date;
  rank: number;
}

interface LeaderboardProps {
  type: 'global' | 'category' | 'game';
  categoryId?: string;
  gameId?: string;
  title?: string;
  showFilters?: boolean;
}

export default function Leaderboard({
  type,
  categoryId,
  gameId,
  title,
  showFilters = true
}: LeaderboardProps) {
  const { apiCall, user: currentUser } = useUser();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [departments, setDepartments] = useState<string[]>([]);
  
  // Ref for scrolling to current user
  const currentUserRef = useRef<HTMLTableRowElement>(null);

  useEffect(() => {
    loadLeaderboard();
  }, [type, categoryId, gameId, departmentFilter, levelFilter]);

  // Auto-refresh leaderboard data every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      // Load data silently without showing loading state
      loadLeaderboardSilently();
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [type, categoryId, gameId, departmentFilter, levelFilter]);

  const loadLeaderboardSilently = async () => {
    try {
      const params = new URLSearchParams();
      if (departmentFilter !== 'all') params.append('department', departmentFilter);
      if (levelFilter !== 'all') params.append('level', levelFilter);
      if (categoryId) params.append('categoryId', categoryId);
      if (gameId) params.append('gameId', gameId);

      const response = await apiCall(`/api/leaderboard/${type}?${params}`);
      if (response.ok) {
        const data = await response.json();
        setEntries(data.entries || []);
        
        // Extract unique departments for filter
        const uniqueDepts = [...new Set(data.entries?.map((e: LeaderboardEntry) => e.department).filter(Boolean))];
        setDepartments(uniqueDepts as string[]);
      }
    } catch (error) {
      console.error('Failed to load leaderboard silently:', error);
    }
    // Note: No setLoading(false) here to avoid showing loading state
  };

  const loadLeaderboard = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (departmentFilter !== 'all') params.append('department', departmentFilter);
      if (levelFilter !== 'all') params.append('level', levelFilter);
      if (categoryId) params.append('categoryId', categoryId);
      if (gameId) params.append('gameId', gameId);

      const response = await apiCall(`/api/leaderboard/${type}?${params}`);
      if (response.ok) {
        const data = await response.json();
        setEntries(data.entries || []);
        
        // Extract unique departments for filter
        const uniqueDepts = [...new Set(data.entries?.map((e: LeaderboardEntry) => e.department).filter(Boolean))];
        setDepartments(uniqueDepts as string[]);
      }
    } catch (error) {
      console.error('Failed to load leaderboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredEntries = entries.filter(entry => {
    const matchesSearch = searchTerm === '' || 
      `${entry.firstName} ${entry.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.department?.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesSearch;
  });

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Crown className="h-6 w-6 text-yellow-400" />;
      case 2:
        return <Medal className="h-6 w-6 text-gray-400" />;
      case 3:
        return <Medal className="h-6 w-6 text-amber-600" />;
      default:
        return <div className="h-6 w-6 flex items-center justify-center text-slate-400 font-bold">{rank}</div>;
    }
  };

  const getRankColor = (rank: number) => {
    switch (rank) {
      case 1:
        return 'border-yellow-500/50 bg-yellow-500/10';
      case 2:
        return 'border-gray-400/50 bg-gray-400/10';
      case 3:
        return 'border-amber-600/50 bg-amber-600/10';
      default:
        return 'border-slate-600 bg-slate-700/50';
    }
  };

  const formatWinRate = (winRate: number) => {
    return `${winRate.toFixed(1)}%`;
  };

  const exportLeaderboard = () => {
    const csvContent = [
      ['Rank', 'Name', 'Department', 'Points', 'Wins', 'Games Played', 'Win Rate'],
      ...filteredEntries.map(entry => [
        entry.rank,
        `${entry.firstName} ${entry.lastName}`,
        entry.department || 'N/A',
        entry.totalPoints,
        entry.totalWins,
        entry.gamesPlayed,
        formatWinRate(entry.winRate)
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leaderboard-${type}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
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
    if (!currentUser) return null;
    const user = filteredEntries.find(entry => entry.userId === currentUser.id);
    return user?.rank || null;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center space-x-2">
            <Trophy className="h-8 w-8 text-orange-400" />
            <span>{title || `${type.charAt(0).toUpperCase() + type.slice(1)} Leaderboard`}</span>
          </h2>
          <p className="text-slate-400">Current standings and rankings</p>
        </div>
        
        <div className="flex items-center space-x-2">
          {currentUser && getCurrentUserRank() && (
            <Button
              variant="outline"
              onClick={scrollToCurrentUser}
              className="bg-blue-500/10 border-blue-400/50 text-blue-300 hover:bg-blue-500/20"
            >
              <MapPin className="h-4 w-4 mr-2" />
              Find Me (#{getCurrentUserRank()})
            </Button>
          )}
          <Button
            variant="outline"
            onClick={loadLeaderboard}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            variant="outline"
            onClick={exportLeaderboard}
            disabled={filteredEntries.length === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center space-x-2">
              <Filter className="h-5 w-5" />
              <span>Filters</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Search</label>
                <Input
                  placeholder="Search by name or department..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-slate-700 border-slate-600 text-white"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Department</label>
                <select
                  value={departmentFilter}
                  onChange={(e) => setDepartmentFilter(e.target.value)}
                  className="w-full p-2 bg-slate-700 border border-slate-600 rounded text-white"
                >
                  <option value="all">All Departments</option>
                  {departments.map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Level</label>
                <select
                  value={levelFilter}
                  onChange={(e) => setLevelFilter(e.target.value)}
                  className="w-full p-2 bg-slate-700 border border-slate-600 rounded text-white"
                >
                  <option value="all">All Levels</option>
                  <option value="Beginner">Beginner</option>
                  <option value="Intermediate">Intermediate</option>
                  <option value="Advanced">Advanced</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Leaderboard */}
      {loading ? (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="text-center py-12">
            <RefreshCw className="h-8 w-8 mx-auto mb-4 text-slate-400 animate-spin" />
            <p className="text-slate-400">Loading leaderboard...</p>
          </CardContent>
        </Card>
      ) : filteredEntries.length === 0 ? (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="text-center py-12">
            <Trophy className="h-12 w-12 mx-auto mb-4 text-slate-400" />
            <h3 className="text-lg font-medium text-white mb-2">No entries found</h3>
            <p className="text-slate-400">
              {searchTerm ? 'Try adjusting your search terms.' : 'No participants have scored points yet.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Top 3 Podium */}
          {filteredEntries.length >= 3 && (
            <div className="grid grid-cols-3 gap-4 mb-8">
              {/* 2nd Place */}
              <Card className={`${getRankColor(2)} transform hover:scale-105 transition-transform`}>
                <CardContent className="text-center py-6">
                  <div className="flex justify-center mb-3">
                    {getRankIcon(2)}
                  </div>
                  <h3 className="font-bold text-white text-lg">
                    {filteredEntries[1].firstName} {filteredEntries[1].lastName}
                  </h3>
                  {filteredEntries[1].jobTitle && (
                    <p className="text-blue-300 text-sm font-medium">{filteredEntries[1].jobTitle}</p>
                  )}
                  <p className="text-slate-400 text-sm">{filteredEntries[1].department}</p>
                  <div className="mt-3">
                    <div className="text-2xl font-bold text-white">{filteredEntries[1].totalPoints}</div>
                    <div className="text-sm text-slate-400">points</div>
                  </div>
                  <div className="flex justify-center space-x-4 mt-3 text-xs text-slate-400">
                    <span>{filteredEntries[1].totalWins} wins</span>
                    <span>{formatWinRate(filteredEntries[1].winRate)}</span>
                  </div>
                </CardContent>
              </Card>

              {/* 1st Place */}
              <Card className={`${getRankColor(1)} transform hover:scale-105 transition-transform relative`}>
                <div className="absolute -top-2 left-1/2 transform -translate-x-1/2">
                  <div className="bg-yellow-500 text-black px-3 py-1 rounded-full text-xs font-bold">
                    CHAMPION
                  </div>
                </div>
                <CardContent className="text-center py-8">
                  <div className="flex justify-center mb-3">
                    {getRankIcon(1)}
                  </div>
                  <h3 className="font-bold text-white text-xl">
                    {filteredEntries[0].firstName} {filteredEntries[0].lastName}
                  </h3>
                  {filteredEntries[0].jobTitle && (
                    <p className="text-blue-300 text-base font-medium">{filteredEntries[0].jobTitle}</p>
                  )}
                  <p className="text-slate-400">{filteredEntries[0].department}</p>
                  <div className="mt-4">
                    <div className="text-3xl font-bold text-yellow-400">{filteredEntries[0].totalPoints}</div>
                    <div className="text-sm text-slate-400">points</div>
                  </div>
                  <div className="flex justify-center space-x-4 mt-4 text-sm text-slate-400">
                    <span>{filteredEntries[0].totalWins} wins</span>
                    <span>{formatWinRate(filteredEntries[0].winRate)}</span>
                  </div>
                </CardContent>
              </Card>

              {/* 3rd Place */}
              <Card className={`${getRankColor(3)} transform hover:scale-105 transition-transform`}>
                <CardContent className="text-center py-6">
                  <div className="flex justify-center mb-3">
                    {getRankIcon(3)}
                  </div>
                  <h3 className="font-bold text-white text-lg">
                    {filteredEntries[2].firstName} {filteredEntries[2].lastName}
                  </h3>
                  {filteredEntries[2].jobTitle && (
                    <p className="text-blue-300 text-sm font-medium">{filteredEntries[2].jobTitle}</p>
                  )}
                  <p className="text-slate-400 text-sm">{filteredEntries[2].department}</p>
                  <div className="mt-3">
                    <div className="text-2xl font-bold text-white">{filteredEntries[2].totalPoints}</div>
                    <div className="text-sm text-slate-400">points</div>
                  </div>
                  <div className="flex justify-center space-x-4 mt-3 text-xs text-slate-400">
                    <span>{filteredEntries[2].totalWins} wins</span>
                    <span>{formatWinRate(filteredEntries[2].winRate)}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Full Rankings Table */}
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">Full Rankings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-600">
                      <th className="text-left py-3 px-4 text-slate-300 font-medium">Rank</th>
                      <th className="text-left py-3 px-4 text-slate-300 font-medium">Player</th>
                      <th className="text-left py-3 px-4 text-slate-300 font-medium">Department</th>
                      <th className="text-center py-3 px-4 text-slate-300 font-medium">Points</th>
                      <th className="text-center py-3 px-4 text-slate-300 font-medium">Wins</th>
                      <th className="text-center py-3 px-4 text-slate-300 font-medium">Games</th>
                      <th className="text-center py-3 px-4 text-slate-300 font-medium">Win Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEntries.map((entry, index) => (
                      <tr
                        key={entry.userId}
                        ref={currentUser && entry.userId === currentUser.id ? currentUserRef : null}
                        className={`border-b border-slate-700 hover:bg-slate-700/30 transition-colors ${
                          currentUser && entry.userId === currentUser.id
                            ? 'bg-gradient-to-r from-blue-500/20 to-purple-500/20 border-l-4 border-l-blue-400'
                            : getRankColor(entry.rank)
                        }`}
                      >
                        <td className="py-4 px-4">
                          <div className="flex items-center space-x-2">
                            {getRankIcon(entry.rank)}
                            {entry.rank <= 3 && (
                              <span className={`hidden sm:inline-block text-xs px-2 py-0.5 rounded-full ${
                                entry.rank === 1
                                  ? 'bg-yellow-500/20 text-yellow-300'
                                  : entry.rank === 2
                                  ? 'bg-gray-400/20 text-gray-300'
                                  : 'bg-amber-500/20 text-amber-300'
                              }`}>
                                TOP {entry.rank}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <div>
                            <div className="font-medium text-white flex items-center space-x-2">
                              <span>{entry.firstName} {entry.lastName}</span>
                              {currentUser && entry.userId === currentUser.id && (
                                <span className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-2 py-0.5 rounded-full text-xs font-bold">
                                  YOU
                                </span>
                              )}
                              {entry.rank <= 3 && (
                                <span className="text-xs">
                                  {entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : '🥉'}
                                </span>
                              )}
                            </div>
                            {entry.jobTitle && (
                              <div className="text-sm text-blue-300 font-medium">{entry.jobTitle}</div>
                            )}
                            <div className="text-sm text-slate-400">{entry.email}</div>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <span className="text-slate-300">{entry.department || 'N/A'}</span>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <div className="flex items-center justify-center space-x-1">
                            <Target className="h-4 w-4 text-orange-400" />
                            <span className="font-bold text-white">{entry.totalPoints}</span>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <div className="flex items-center justify-center space-x-1">
                            <Trophy className="h-4 w-4 text-green-400" />
                            <span className="text-white">{entry.totalWins}</span>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <div className="flex items-center justify-center space-x-1">
                            <Users className="h-4 w-4 text-blue-400" />
                            <span className="text-white">{entry.gamesPlayed}</span>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <div className="flex items-center justify-center space-x-1">
                            <TrendingUp className="h-4 w-4 text-purple-400" />
                            <span className="text-white">{formatWinRate(entry.winRate)}</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
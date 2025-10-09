"use client";

import { useState, useEffect } from 'react';
import { Clock, Trophy, Users, Target, Calendar, Zap, X } from 'lucide-react';
import { useUser } from '@/contexts/UserContext';

interface MatchInfo {
  gameId: string;
  gameName: string;
  contestType: string;
  typeFormat: string;
  registrationMode: string;
  summary: {
    totalMatches: number;
    completedMatches: number;
    wonMatches: number;
    lostMatches: number;
    upcomingMatches: number;
  };
  nextMatch: {
    id: string;
    opponent: string;
    startTime: string;
    endTime: string;
  } | null;
  matches: {
    id: string;
    isCompleted: boolean;
    isWinner: boolean | null;
    opponent: string;
    userSide: string;
    scoreNotes: string | null;
    slot: {
      startTime: string;
      endTime: string;
      published: boolean;
    } | null;
  }[];
}

interface CompactMatchInfoProps {
  gameId: string;
  contestType: string;
  className?: string;
  preloadedMatchData?: MatchInfo | null;
}

export default function CompactMatchInfo({ gameId, contestType, className = "", preloadedMatchData }: CompactMatchInfoProps) {
  const { apiCall } = useUser();
  const [matchInfo, setMatchInfo] = useState<MatchInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // If preloaded data is provided, use it instead of fetching
    if (preloadedMatchData !== undefined) {
      setMatchInfo(preloadedMatchData);
      setLoading(false);
      return;
    }

    // Fallback to fetching if no preloaded data
    const fetchMatchInfo = async () => {
      try {
        const response = await apiCall(`/api/games/${gameId}/user-match-info`);
        
        if (response.ok) {
          const data = await response.json();
          setMatchInfo(data);
        } else if (response.status === 403) {
          // User not registered - this is expected, don't show error
          setMatchInfo(null);
        } else {
          throw new Error('Failed to fetch match info');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchMatchInfo();
  }, [gameId, apiCall, preloadedMatchData]);

  if (loading) {
    return (
      <div className={`bg-slate-700/30 rounded-lg p-3 ${className}`}>
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 bg-slate-600 rounded animate-pulse"></div>
          <div className="h-3 bg-slate-600 rounded w-20 animate-pulse"></div>
        </div>
        <div className="text-xs text-slate-400 mt-1">Loading match info...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-red-900/20 border border-red-500/30 rounded-lg p-3 ${className}`}>
        <div className="text-xs text-red-400">Error: {error}</div>
      </div>
    );
  }

  if (!matchInfo) {
    return (
      <div className={`bg-slate-700/30 rounded-lg p-3 ${className}`}>
        <div className="text-xs text-slate-400">No match data available</div>
      </div>
    );
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    if (isToday) {
      return `Today ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    }
  };

  const renderScoringContestInfo = () => {
    const scheduledMatches = matchInfo.matches.filter(m => m.slot && !m.isCompleted);
    const completedMatches = matchInfo.matches.filter(m => m.isCompleted);
    
    // Get the best score from completed matches
    const scores = completedMatches
      .map(m => m.scoreNotes ? parseInt(m.scoreNotes) : 0)
      .filter(score => !isNaN(score));
    const bestScore = scores.length > 0 ? Math.max(...scores) : null;
    
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Target className="h-3 w-3 text-purple-400" />
            <span className="text-xs text-slate-300">Individual Contest</span>
          </div>
          {completedMatches.length > 0 && (
            <div className="flex items-center space-x-2">
              {bestScore !== null && (
                <span className="text-xs text-yellow-400 bg-yellow-400/10 px-2 py-0.5 rounded font-medium">
                  Best: {bestScore}
                </span>
              )}
              <span className="text-xs text-purple-400 bg-purple-400/10 px-2 py-0.5 rounded">
                {completedMatches.length} attempt{completedMatches.length !== 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>
        
        {/* Show completed matches with scores */}
        {completedMatches.map((match, index) => {
          const score = match.scoreNotes ? parseInt(match.scoreNotes) : null;
          return (
            <div key={match.id} className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="h-3 w-3 text-green-400">✓</div>
                <span className="text-xs text-green-400">
                  Completed{match.slot ? `: ${formatTime(match.slot.startTime)}` : ''}
                </span>
              </div>
              {score !== null && !isNaN(score) && (
                <span className="text-xs text-yellow-400 font-medium">
                  {score} pts
                </span>
              )}
            </div>
          );
        })}
        
        {/* Show scheduled matches */}
        {scheduledMatches.map((match, index) => (
          <div key={match.id} className="flex items-center space-x-2">
            <Calendar className="h-3 w-3 text-cyan-400" />
            <span className="text-xs text-cyan-400">
              {index === 0 ? 'Next: ' : 'Later: '}{formatTime(match.slot!.startTime)}
            </span>
          </div>
        ))}
        
        {scheduledMatches.length === 0 && matchInfo.summary.upcomingMatches > 0 && (
          <div className="flex items-center space-x-2">
            <Clock className="h-3 w-3 text-orange-400" />
            <span className="text-xs text-orange-400">
              {matchInfo.summary.upcomingMatches} upcoming (not scheduled)
            </span>
          </div>
        )}
      </div>
    );
  };

  const renderSingleEliminationInfo = () => {
    const isMultiPlayer = contestType === 'SINGLE_ELIMINATION_1V1V1V1';
    const upcomingMatches = matchInfo.matches.filter(m => !m.isCompleted);
    const completedMatches = matchInfo.matches.filter(m => m.isCompleted);
    
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Trophy className="h-3 w-3 text-yellow-400" />
            <span className="text-xs text-slate-300">
              {isMultiPlayer ? '4-Player Elimination' : 'Single Elimination'}
            </span>
          </div>
          {matchInfo.summary.completedMatches > 0 && (
            <span className="text-xs text-green-400 bg-green-400/10 px-2 py-0.5 rounded">
              {matchInfo.summary.wonMatches}W-{matchInfo.summary.lostMatches}L
            </span>
          )}
        </div>
        
        {/* Show upcoming matches */}
        {upcomingMatches.map((match, index) => (
          <div key={match.id} className="flex items-center space-x-2">
            <Calendar className="h-3 w-3 text-cyan-400" />
            <span className="text-xs text-cyan-400">
              {index === 0 ? 'Next: ' : 'Later: '}
              {match.slot ? formatTime(match.slot.startTime) : 'TBD'}
              {match.opponent !== 'TBD' && match.opponent !== 'Multi-player match' && (
                <span className="text-slate-400 ml-1">vs {match.opponent}</span>
              )}
            </span>
          </div>
        ))}
        
        {/* Show completed matches */}
        {completedMatches.map((match, index) => (
          <div key={match.id} className="flex items-center space-x-2">
            <div className={`h-3 w-3 ${match.isWinner ? 'text-yellow-400' : 'text-red-400'}`}>
              {match.isWinner ? <Trophy className="h-3 w-3" /> : <X className="h-3 w-3" />}
            </div>
            <span className={`text-xs ${match.isWinner ? 'text-yellow-400' : 'text-red-400'}`}>
              {match.slot ? formatTime(match.slot.startTime) : 'Completed'}
              {match.opponent !== 'TBD' && match.opponent !== 'Multi-player match' && (
                <span className="ml-1">vs {match.opponent}</span>
              )}
            </span>
          </div>
        ))}
        
        {matchInfo.summary.totalMatches > 0 && (
          <div className="flex items-center space-x-2">
            <Zap className="h-3 w-3 text-indigo-400" />
            <span className="text-xs text-indigo-400">
              {matchInfo.summary.completedMatches}/{matchInfo.summary.totalMatches} matches
            </span>
          </div>
        )}
      </div>
    );
  };

  const renderRoundRobinInfo = () => {
    const scheduledMatches = matchInfo.matches.filter(m => m.slot && !m.isCompleted);
    const completedMatches = matchInfo.matches.filter(m => m.isCompleted);
    
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Users className="h-3 w-3 text-blue-400" />
            <span className="text-xs text-slate-300">Round Robin</span>
          </div>
          {matchInfo.summary.completedMatches > 0 && (
            <span className="text-xs text-green-400 bg-green-400/10 px-2 py-0.5 rounded">
              {matchInfo.summary.wonMatches}W-{matchInfo.summary.lostMatches}L
            </span>
          )}
        </div>
        
        {/* Show scheduled matches */}
        {scheduledMatches.map((match, index) => (
          <div key={match.id} className="flex items-center space-x-2">
            <Calendar className="h-3 w-3 text-cyan-400" />
            <span className="text-xs text-cyan-400">
              {index === 0 ? 'Next: ' : 'Later: '}{formatTime(match.slot!.startTime)}
              {match.opponent !== 'TBD' && (
                <span className="text-slate-400 ml-1">vs {match.opponent}</span>
              )}
            </span>
          </div>
        ))}
        
        {/* Show completed matches */}
        {completedMatches.map((match, index) => (
          <div key={match.id} className="flex items-center space-x-2">
            <div className={`h-3 w-3 ${match.isWinner ? 'text-yellow-400' : 'text-red-400'}`}>
              {match.isWinner ? <Trophy className="h-3 w-3" /> : <X className="h-3 w-3" />}
            </div>
            <span className={`text-xs ${match.isWinner ? 'text-yellow-400' : 'text-red-400'}`}>
              {match.slot ? formatTime(match.slot.startTime) : 'Completed'}
              {match.opponent !== 'TBD' && (
                <span className="ml-1">vs {match.opponent}</span>
              )}
            </span>
          </div>
        ))}
        
        {scheduledMatches.length === 0 && matchInfo.summary.upcomingMatches > 0 && (
          <div className="flex items-center space-x-2">
            <Clock className="h-3 w-3 text-orange-400" />
            <span className="text-xs text-orange-400">
              {matchInfo.summary.upcomingMatches} upcoming (not scheduled)
            </span>
          </div>
        )}
        
        {matchInfo.summary.totalMatches > 0 && (
          <div className="flex items-center space-x-2">
            <Zap className="h-3 w-3 text-indigo-400" />
            <span className="text-xs text-indigo-400">
              {matchInfo.summary.completedMatches}/{matchInfo.summary.totalMatches} matches
            </span>
          </div>
        )}
      </div>
    );
  };

  const renderMatchInfo = () => {
    switch (contestType) {
      case 'SCORING':
        return renderScoringContestInfo();
      case 'SINGLE_ELIMINATION':
      case 'SINGLE_ELIMINATION_1V1V1V1':
        return renderSingleEliminationInfo();
      case 'ROUND_ROBIN':
        return renderRoundRobinInfo();
      default:
        return renderSingleEliminationInfo(); // Default fallback
    }
  };

  return (
    <div className={`bg-slate-700/30 border border-slate-600/50 rounded-lg p-3 ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <h5 className="text-xs font-medium text-slate-200">Match Info</h5>
        {matchInfo.registrationMode === 'TEAM' && (
          <span className="text-xs text-blue-400 bg-blue-400/10 px-1.5 py-0.5 rounded">
            Team
          </span>
        )}
      </div>
      {renderMatchInfo()}
    </div>
  );
}
"use client";

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Clock, Trophy, Users, ArrowLeft, MapPin, Star, Target, Medal, TrendingUp, CheckCircle, Timer, Award, Info, X, ChevronLeft, ChevronRight } from "lucide-react";
import Navigation from "@/components/Navigation";
import { useUser } from "@/contexts/UserContext";
import ScoringContestView from "@/components/ScoringContestView";
import { FormattedText } from "@/components/RichTextEditor";

interface Participant {
  id: string;
  type: 'USER' | 'TEAM';
  name: string;
  email?: string;
  avatarUrl?: string;
  members?: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string;
  }[];
}

interface Match {
  id: string;
  participantA: Participant;
  participantB: Participant;
  participantC?: Participant;
  participantD?: Participant;
  winner?: Participant;
  scoreNotes?: string;
  timeSlot?: {
    startTime: string;
    endTime: string;
  };
  flags?: any;
}

interface TimeSlot {
  id: string;
  startTime: string;
  endTime: string;
  timelineId: number;
  published: boolean;
  matches: Match[];
  assignments: {
    id: string;
    participant: Participant;
  }[];
}

interface Game {
  id: string;
  name: string;
  description?: string;
  contestType: string;
  typeFormat: string;
  oneLoserMode?: boolean;
  participants: Participant[];
  matches: Match[];
  slots: TimeSlot[];
}

interface ScheduleData {
  categoryId: string;
  categoryName: string;
  startDate: string;
  endDate: string;
  location: string;
  games: Game[];
}

const formatContestType = (contestType: string): string => {
  switch (contestType) {
    case 'SINGLE_ELIMINATION':
      return 'Single Elimination';
    case 'SINGLE_ELIMINATION_1V1V1V1':
      return 'Single Elimination (4 Participants)';
    case 'ROUND_ROBIN':
      return 'Round Robin (League)';
    case 'SCORING':
      return 'Scoring Contest';
    default:
      return contestType;
  }
};

// Function to get contest rules
const getContestRules = (contestType: string) => {
  switch (contestType) {
    case 'SINGLE_ELIMINATION':
      return {
        title: 'Single Elimination Rules',
        description: 'Traditional knockout tournament format',
        rules: [
          'Win or go home - lose once and you\'re eliminated',
          'The more games you win, the more points you earn',
          'Winners advance to the next round until a champion is crowned',
          'Perfect for competitive tournaments with clear winners'
        ]
      };
    case 'SINGLE_ELIMINATION_1V1V1V1':
      return {
        title: 'Single Elimination (4 Participants) Rules',
        description: 'Four-participant knockout tournament format',
        rules: [
          'Four participants compete in each match simultaneously',
          'Standard mode: Win or go home - lose once and you\'re eliminated',
          '1 Loser mode: One participant is eliminated per match, three advance',
          'The more games you win, the more points you earn',
          'Winners advance to the next round until a champion is crowned',
          'Perfect for competitive tournaments with multiple participants per match'
        ]
      };
    case 'ROUND_ROBIN':
      return {
        title: 'Round Robin Rules',
        description: 'League format where everyone plays everyone',
        rules: [
          'Play against every other participant in the group',
          'The more games you win, the more points you earn',
          'All participants get multiple chances to compete',
          'Final ranking based on total wins and performance'
        ]
      };
    case 'SCORING':
      return {
        title: 'Scoring Contest Rules',
        description: 'Individual performance-based competition',
        rules: [
          'Individual scoring competition - no eliminations',
          'Participants compete for the highest score',
          'Top 3 performers earn bonus leaderboard points',
          'Everyone gets to participate regardless of performance'
        ]
      };
    default:
      return {
        title: 'Contest Rules',
        description: 'Competition format',
        rules: ['Rules will be announced before the competition']
      };
  }
};

const formatTime = (dateString: string) => {
  return new Date(dateString).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
};

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

const formatDateShort = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
  });
};

const formatDateTime = (dateString: string) => {
  const date = new Date(dateString);
  const dateStr = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
  });
  const timeStr = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
  return `${dateStr} • ${timeStr}`;
};

export default function EventSchedulePage() {
  const params = useParams();
  const router = useRouter();
  const { user, apiCall } = useUser();
  const [scheduleData, setScheduleData] = useState<ScheduleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  interface ContestRules {
    title: string;
    description: string;
    rules: string[];
    gameDescription?: string;
  }
  
  const [selectedContestRules, setSelectedContestRules] = useState<ContestRules | null>(null);
  const matchesSectionRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  useEffect(() => {
    const fetchSchedule = async () => {
      try {
        const response = await fetch(`/api/categories/${params.id}/schedule`);
        if (!response.ok) {
          throw new Error('Failed to fetch schedule');
        }
        const data = await response.json();
        setScheduleData(data);
        
        // Auto-select first game if available
        if (data.games.length > 0) {
          setSelectedGame(data.games[0]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    if (params.id) {
      fetchSchedule();
    }
  }, [params.id]);

  // Helper function to check if a match involves the current user
  const isUserMatch = (match: Match): boolean => {
    if (!user) return false;
    
    const userId = user.id;
    const userFullName = `${user.firstName} ${user.lastName}`;
    
    // Check if user is directly participating in any of the 4 positions
    if (match.participantA.id === userId ||
        match.participantB.id === userId ||
        (match.participantC && match.participantC.id === userId) ||
        (match.participantD && match.participantD.id === userId)) {
      return true;
    }
    
    // Check if user is in a team for any of the 4 positions
    const participants = [match.participantA, match.participantB, match.participantC, match.participantD].filter((p): p is Participant => p !== undefined);
    
    for (const participant of participants) {
      if (participant.type === 'TEAM' && participant.members) {
        if (participant.members.some(member => member.id === userId)) {
          return true;
        }
      }
    }
    
    return false;
  };

  // Helper function to check if a participant is a winner in the match
  const isParticipantWinner = (match: Match, participantId: string, game: Game): boolean => {
    if (!match.winner) return false;
    
    const isOneLoserMode = game.contestType === 'SINGLE_ELIMINATION_1V1V1V1' && game.oneLoserMode;
    
    if (isOneLoserMode) {
      // In 1 Loser mode, everyone EXCEPT the winnerId is a winner
      return match.winner.id !== participantId;
    } else {
      // Normal mode: winnerId is the winner
      return match.winner.id === participantId;
    }
  };

  const showRules = (contestType: string, gameDescription?: string) => {
      const rules = getContestRules(contestType);
      setSelectedContestRules({
        ...rules,
        gameDescription
      });
      setShowRulesModal(true);
    };

  const closeRulesModal = () => {
    setShowRulesModal(false);
    setSelectedContestRules(null);
  };

  // Function to handle game selection with smooth scroll
  const handleGameSelection = (game: Game, gameIndex?: number) => {
    setSelectedGame(game);
    if (gameIndex !== undefined) {
      setCurrentSlideIndex(gameIndex);
    }
    
    // Smooth scroll to matches section on mobile/tablet
    if (matchesSectionRef.current && window.innerWidth < 1024) {
      setTimeout(() => {
        matchesSectionRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
          inline: 'nearest'
        });
      }, 100); // Small delay to ensure state update
    }
  };

  // Slideshow navigation functions
  const goToNextSlide = () => {
    if (scheduleData && scheduleData.games.length > 0) {
      const nextIndex = (currentSlideIndex + 1) % scheduleData.games.length;
      setCurrentSlideIndex(nextIndex);
      setSelectedGame(scheduleData.games[nextIndex]);
    }
  };

  const goToPrevSlide = () => {
    if (scheduleData && scheduleData.games.length > 0) {
      const prevIndex = currentSlideIndex === 0 ? scheduleData.games.length - 1 : currentSlideIndex - 1;
      setCurrentSlideIndex(prevIndex);
      setSelectedGame(scheduleData.games[prevIndex]);
    }
  };

  const goToSlide = (index: number) => {
    if (scheduleData && scheduleData.games.length > 0 && index >= 0 && index < scheduleData.games.length) {
      setCurrentSlideIndex(index);
      setSelectedGame(scheduleData.games[index]);
    }
  };

  const renderSingleEliminationBracket = (game: Game) => {
    const matches = game.matches;
    if (matches.length === 0) {
      return (
        <div className="text-center text-slate-400 py-8">
          No matches scheduled yet
        </div>
      );
    }

    // Simple round organization based on participant appearance count
    const organizeMatchesIntoRounds = (matches: Match[]): Match[][] => {
      if (matches.length === 0) return [];
      
      // Filter out matches where ALL participants are TBD
      const validMatches = matches.filter(match => {
        if (game.contestType === 'SINGLE_ELIMINATION_1V1V1V1') {
          // For 1v1v1v1 format, show match if ANY participant is not TBD
          return !(match.participantA.id === 'TBD' &&
                   match.participantB.id === 'TBD' &&
                   (!match.participantC || match.participantC.id === 'TBD') &&
                   (!match.participantD || match.participantD.id === 'TBD'));
        } else {
          // For regular format, filter out TBD vs TBD matches
          return !(match.participantA.id === 'TBD' && match.participantB.id === 'TBD');
        }
      });
      
      if (validMatches.length === 0) return [];
      
      // Sort matches by time to maintain chronological order
      const sortedMatches = [...validMatches].sort((a, b) => {
        if (a.timeSlot && b.timeSlot) {
          return new Date(a.timeSlot.startTime).getTime() - new Date(b.timeSlot.startTime).getTime();
        }
        return 0;
      });
      
      // Calculate round number for each match
      const matchRounds: { match: Match; round: number }[] = [];
      
      for (let i = 0; i < sortedMatches.length; i++) {
        const currentMatch = sortedMatches[i];
        
        // Count how many times participant A and B appear in previous matches
        let aCount = 0;
        let bCount = 0;
        
        // Iterate backwards through previous matches
        for (let j = i - 1; j >= 0; j--) {
          const prevMatch = sortedMatches[j];
          
          // Count appearances of participant A
          if (currentMatch.participantA.id !== 'TBD') {
            if (prevMatch.participantA.id === currentMatch.participantA.id ||
                prevMatch.participantB.id === currentMatch.participantA.id) {
              aCount++;
            }
          }
          
          // Count appearances of participant B
          if (currentMatch.participantB.id !== 'TBD') {
            if (prevMatch.participantA.id === currentMatch.participantB.id ||
                prevMatch.participantB.id === currentMatch.participantB.id) {
              bCount++;
            }
          }
        }
        
        // Round number is the greater count + 1
        const roundNumber = Math.max(aCount, bCount) + 1;
        matchRounds.push({ match: currentMatch, round: roundNumber });
      }
      
      // Group matches by round number
      const rounds: Match[][] = [];
      const roundMap = new Map<number, Match[]>();
      
      matchRounds.forEach(({ match, round }) => {
        if (!roundMap.has(round)) {
          roundMap.set(round, []);
        }
        roundMap.get(round)!.push(match);
      });
      
      // Convert to array and sort by round number
      const sortedRoundNumbers = Array.from(roundMap.keys()).sort((a, b) => a - b);
      sortedRoundNumbers.forEach(roundNum => {
        rounds.push(roundMap.get(roundNum)!);
      });
      
      return rounds;
    };

    const rounds = organizeMatchesIntoRounds(matches);

    // Calculate tournament progress - only count matches with real participants
    const totalMatches = matches.filter(m => {
      if (game.contestType === 'SINGLE_ELIMINATION_1V1V1V1') {
        // For 1v1v1v1 format, count match if ANY participant is not TBD
        return !(m.participantA.id === 'TBD' &&
                 m.participantB.id === 'TBD' &&
                 (!m.participantC || m.participantC.id === 'TBD') &&
                 (!m.participantD || m.participantD.id === 'TBD'));
      } else {
        return m.participantA.id !== 'TBD' && m.participantB.id !== 'TBD';
      }
    }).length;
    const completedMatches = matches.filter(m => {
      if (!m.winner) return false;
      if (game.contestType === 'SINGLE_ELIMINATION_1V1V1V1') {
        // For 1v1v1v1 format, count completed match if ANY participant is not TBD
        return !(m.participantA.id === 'TBD' &&
                 m.participantB.id === 'TBD' &&
                 (!m.participantC || m.participantC.id === 'TBD') &&
                 (!m.participantD || m.participantD.id === 'TBD'));
      } else {
        return m.participantA.id !== 'TBD' && m.participantB.id !== 'TBD';
      }
    }).length;
    const tournamentProgress = totalMatches > 0 ? (completedMatches / totalMatches) * 100 : 0;
    
    // Find tournament champion (winner of the final match)
    const finalRound = rounds[rounds.length - 1];
    const champion = finalRound && finalRound.length > 0 ? finalRound[0]?.winner : null;

    return (
      <div className="space-y-8">
        {/* Tournament Progress Header */}
        <div className="bg-gradient-to-r from-slate-800/80 to-slate-700/80 rounded-xl p-4 sm:p-6 border border-slate-600/50">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-purple-600/20 rounded-full">
                <Trophy className="w-6 h-6 text-purple-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Single Elimination Tournament</h3>
                <p className="text-slate-300 text-sm">
                  {game.participants.length} participants • {totalMatches} total matches
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-6">
              {/* Progress */}
              <div className="text-center">
                <div className="text-2xl font-bold text-white">{Math.round(tournamentProgress)}%</div>
                <div className="text-xs text-slate-400">Complete</div>
              </div>
              
              {/* Current Champion */}
              {champion && (
                <div className="text-center">
                  <div className="flex items-center justify-center space-x-3 mb-2">
                    <Medal className="w-5 h-5 text-yellow-400" />
                    
                    {/* Champion Avatar */}
                    {champion.type === 'USER' && (
                      <div className="flex-shrink-0">
                        {champion.avatarUrl ? (
                          <img
                            src={champion.avatarUrl}
                            alt={champion.name}
                            className="w-8 h-8 sm:w-10 sm:h-10 rounded-full object-cover border-2 border-yellow-400"
                          />
                        ) : (
                          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center border-2 border-yellow-400">
                            <span className="text-white text-xs sm:text-sm font-medium">
                              {champion.name?.[0] || 'U'}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Team Champion Avatars */}
                    {champion.type === 'TEAM' && champion.members && (
                      <div className="flex -space-x-1 flex-shrink-0">
                        {champion.members.slice(0, 2).map((member, index) => (
                          <div key={member.id} className="relative">
                            {member.avatarUrl ? (
                              <img
                                src={member.avatarUrl}
                                alt={member.name}
                                className="w-6 h-6 sm:w-8 sm:h-8 rounded-full object-cover border-2 border-yellow-400 bg-slate-800"
                              />
                            ) : (
                              <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center border-2 border-yellow-400">
                                <span className="text-white text-xs font-medium">
                                  {member.name?.[0] || member.email?.[0] || 'U'}
                                </span>
                              </div>
                            )}
                          </div>
                        ))}
                        {champion.members.length > 2 && (
                          <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-slate-600 border-2 border-yellow-400 flex items-center justify-center">
                            <span className="text-white text-xs font-medium">
                              +{champion.members.length - 2}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                    
                    <span className="text-white font-semibold">{champion.name}</span>
                  </div>
                  <div className="text-xs text-slate-400">Tournament Winner</div>
                </div>
              )}
            </div>
          </div>
          
          {/* Progress Bar */}
          <div className="mt-4">
            <div className="w-full bg-slate-700 rounded-full h-2">
              <div
                className="bg-gradient-to-r from-purple-500 to-blue-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${tournamentProgress}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Tournament Complete - Champion */}
        {tournamentProgress === 100 && champion && (
          <div className="bg-gradient-to-r from-yellow-600/20 to-amber-600/20 border border-yellow-500/30 rounded-xl p-6 text-center">
            <div className="flex items-center justify-center space-x-3 mb-4">
              <Trophy className="w-8 h-8 text-yellow-400" />
              <h3 className="text-2xl font-bold text-yellow-300">Tournament Champion!</h3>
              <Trophy className="w-8 h-8 text-yellow-400" />
            </div>
            
            {/* Champion Avatar Section */}
            <div className="flex items-center justify-center space-x-4 mb-4">
              {/* Individual Champion Avatar */}
              {champion.type === 'USER' && (
                <div className="flex-shrink-0">
                  {champion.avatarUrl ? (
                    <img
                      src={champion.avatarUrl}
                      alt={champion.name}
                      className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover border-4 border-yellow-400 shadow-lg"
                    />
                  ) : (
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center border-4 border-yellow-400 shadow-lg">
                      <span className="text-white text-xl sm:text-2xl font-bold">
                        {champion.name?.[0] || 'U'}
                      </span>
                    </div>
                  )}
                </div>
              )}
              
              {/* Team Champion Avatars */}
              {champion.type === 'TEAM' && champion.members && (
                <div className="flex justify-center -space-x-3">
                  {champion.members.slice(0, 4).map((member, index) => (
                    <div key={member.id} className="relative">
                      {member.avatarUrl ? (
                        <img
                          src={member.avatarUrl}
                          alt={member.name}
                          className="w-12 h-12 sm:w-16 sm:h-16 rounded-full object-cover border-4 border-yellow-400 bg-slate-800 shadow-lg"
                        />
                      ) : (
                        <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center border-4 border-yellow-400 shadow-lg">
                          <span className="text-white text-sm sm:text-lg font-bold">
                            {member.name?.[0] || member.email?.[0] || 'U'}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                  {champion.members.length > 4 && (
                    <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-slate-600 border-4 border-yellow-400 flex items-center justify-center shadow-lg">
                      <span className="text-white text-sm sm:text-base font-bold">
                        +{champion.members.length - 4}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            <div className="text-3xl font-bold text-white mb-2">{champion.name}</div>
            {champion.type === 'TEAM' && champion.members && (
              <div className="text-slate-300 mb-4">
                {champion.members.map((member: any) => member.name).join(', ')}
              </div>
            )}
            <div className="text-yellow-300 font-semibold">
              🏆 Single Elimination Champion 🏆
            </div>
          </div>
        )}

        {rounds.map((round, roundIndex) => (
          <div key={roundIndex} className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <h4 className="text-lg font-semibold text-white">
                  {(() => {
                    const totalRounds = rounds.length;
                    const roundsFromEnd = totalRounds - roundIndex;
                    
                    // Very strict naming logic: only show special names when tournament has actually reached that stage
                    // This means ALL previous rounds must be 100% completed AND the current round structure must match
                    
                    const isRoundFullyCompleted = (roundToCheck: Match[]) => {
                      return roundToCheck.every(match => match.winner !== null && match.winner !== undefined);
                    };
                    
                    const canUseSpecialName = () => {
                      // Check if ALL previous rounds are fully completed
                      for (let i = 0; i < roundIndex; i++) {
                        if (!isRoundFullyCompleted(rounds[i])) {
                          return false;
                        }
                      }
                      
                      // Additional check: if this is not the last round, the current round should also be completed
                      // to use special naming (except for the actual final round)
                      if (roundIndex < totalRounds - 1 && !isRoundFullyCompleted(round)) {
                        return false;
                      }
                      
                      return true;
                    };
                    
                    // Only use special names if tournament has legitimately progressed AND structure matches
                    if (canUseSpecialName()) {
                      switch (roundsFromEnd) {
                        case 1:
                          // Final: exactly 1 match, all previous rounds completed
                          if (round.length === 1) {
                            return 'Final';
                          }
                          break;
                        case 2:
                          // Semi-Finals: exactly 2 matches, all previous rounds completed
                          if (round.length === 2) {
                            return 'Semi-Finals';
                          }
                          break;
                        case 3:
                          // Quarter-Finals: exactly 4 matches, all previous rounds completed
                          if (round.length === 4) {
                            return 'Quarter-Finals';
                          }
                          break;
                        case 4:
                          // Round of 16: exactly 8 matches, all previous rounds completed
                          if (round.length === 8) {
                            return 'Round of 16';
                          }
                          break;
                        case 5:
                          // Round of 32: exactly 16 matches, all previous rounds completed
                          if (round.length === 16) {
                            return 'Round of 32';
                          }
                          break;
                      }
                    }
                    
                    // Default to numbered rounds if conditions aren't met
                    return `Round ${roundIndex + 1}`;
                  })()}
                </h4>
                <div className={`px-2 py-1 rounded-full text-xs font-bold ${
                  round.every(m => m.winner)
                    ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                    : round.some(m => m.winner)
                      ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
                      : 'bg-slate-600/20 text-slate-400 border border-slate-600/30'
                }`}>
                  {round.every(m => m.winner) ? 'Completed' : round.some(m => m.winner) ? 'In Progress' : 'Pending'}
                </div>
              </div>
              <div className="text-sm text-slate-400">
                {round.filter(m => m.winner).length} of {round.length} matches completed
              </div>
            </div>
            <div className="grid gap-4">
              {round.map((match) => {
                const userMatch = isUserMatch(match);
                const hasWinner = match.winner !== undefined && match.winner !== null;
                return (
                  <Card
                    key={match.id}
                    className={`relative overflow-hidden transition-all duration-300 ${
                      userMatch
                        ? 'bg-gradient-to-r from-purple-900/30 to-blue-900/30 border-purple-500/50 shadow-lg shadow-purple-500/20'
                        : 'bg-slate-700/50 border-slate-600 hover:bg-slate-700/70'
                    }`}
                  >
                    {userMatch && hasWinner && (
                      <div className="absolute top-0 right-0 bg-gradient-to-l from-purple-500 to-green-500 text-white text-xs font-bold px-3 py-1 rounded-bl-lg">
                        YOUR MATCH • CONCLUDED
                      </div>
                    )}
                    {userMatch && !hasWinner && (
                      <div className="absolute top-0 right-0 bg-gradient-to-l from-purple-500 to-blue-500 text-white text-xs font-bold px-3 py-1 rounded-bl-lg">
                        YOUR MATCH
                      </div>
                    )}
                    {!userMatch && hasWinner && (
                      <div className="absolute top-0 right-0 bg-gradient-to-l from-green-500 to-emerald-500 text-white text-xs font-bold px-3 py-1 rounded-bl-lg">
                        CONCLUDED
                      </div>
                    )}
                    
                    <CardContent className="p-4 sm:p-6">
                      {/* Time Display at Top Center */}
                      {match.timeSlot && (
                        <div className={`flex items-center justify-center space-x-2 mb-4 ${
                          userMatch ? 'text-purple-300' : 'text-slate-400'
                        }`}>
                          <Clock className="w-4 h-4" />
                          <span className="font-medium">{formatDateTime(match.timeSlot.startTime)}</span>
                        </div>
                      )}
                      
                      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4 lg:space-x-6 flex-1 space-y-3 sm:space-y-0">
                          {/* Participant A */}
                          <div className={`relative flex items-center space-x-3 px-3 sm:px-4 py-2 sm:py-3 rounded-xl border-2 w-full sm:min-w-[120px] lg:min-w-[140px] transition-all duration-200 overflow-hidden ${
                            isParticipantWinner(match, match.participantA.id, game)
                              ? 'bg-gradient-to-r from-green-500/20 to-emerald-500/20 border-green-500/60 text-green-300 font-semibold shadow-lg shadow-green-500/20'
                              : match.winner && !isParticipantWinner(match, match.participantA.id, game) && match.participantA.id !== 'TBD'
                                ? 'bg-gradient-to-r from-red-500/20 to-red-600/20 border-red-500/60 text-red-300 shadow-lg shadow-red-500/20'
                                : userMatch
                                  ? 'bg-slate-600/70 border-slate-400/70 text-slate-200'
                                  : 'bg-slate-600/50 border-slate-500/50 text-slate-300'
                          }`}>
                            {/* Eliminated Badge */}
                            {match.winner && !isParticipantWinner(match, match.participantA.id, game) && match.participantA.id !== 'TBD' && (
                              <div className="absolute -top-1 -left-1 bg-red-600 text-white text-xs font-bold px-2 py-1 transform -rotate-45 origin-top-left shadow-lg">
                                ELIMINATED
                              </div>
                            )}
                            <div className="flex flex-col flex-1 min-w-0">
                              <span className="font-medium text-sm sm:text-base truncate">{match.participantA.name || 'TBD'}</span>
                              {match.participantA.type === 'TEAM' && match.participantA.members && (
                                <span className="text-xs opacity-75 mt-1">
                                  {match.participantA.members.map(member => member.name).join(', ')}
                                </span>
                              )}
                            </div>
                            {isParticipantWinner(match, match.participantA.id, game) && (
                              <Trophy className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-400 flex-shrink-0" />
                            )}
                          </div>
                          
                          {/* VS Tag */}
                          <div className={`px-3 py-2 rounded-lg text-xs sm:text-sm font-bold self-center ${
                            userMatch
                              ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg'
                              : 'bg-slate-600 text-slate-300'
                          }`}>
                            VS
                          </div>
                          
                          {/* Participant B */}
                          <div className={`relative flex items-center space-x-3 px-3 sm:px-4 py-2 sm:py-3 rounded-xl border-2 w-full sm:min-w-[120px] lg:min-w-[140px] transition-all duration-200 overflow-hidden ${
                            isParticipantWinner(match, match.participantB.id, game)
                              ? 'bg-gradient-to-r from-green-500/20 to-emerald-500/20 border-green-500/60 text-green-300 font-semibold shadow-lg shadow-green-500/20'
                              : match.winner && !isParticipantWinner(match, match.participantB.id, game) && match.participantB.id !== 'TBD'
                                ? 'bg-gradient-to-r from-red-500/20 to-red-600/20 border-red-500/60 text-red-300 shadow-lg shadow-red-500/20'
                                : userMatch
                                  ? 'bg-slate-600/70 border-slate-400/70 text-slate-200'
                                  : 'bg-slate-600/50 border-slate-500/50 text-slate-300'
                          }`}>
                            {/* Eliminated Badge */}
                            {match.winner && !isParticipantWinner(match, match.participantB.id, game) && match.participantB.id !== 'TBD' && (
                              <div className="absolute -top-1 -left-1 bg-red-600 text-white text-xs font-bold px-2 py-1 transform -rotate-45 origin-top-left shadow-lg">
                                ELIMINATED
                              </div>
                            )}
                            <div className="flex flex-col flex-1 min-w-0">
                              <span className="font-medium text-sm sm:text-base truncate">{match.participantB.name || 'TBD'}</span>
                              {match.participantB.type === 'TEAM' && match.participantB.members && (
                                <span className="text-xs opacity-75 mt-1">
                                  {match.participantB.members.map(member => member.name).join(', ')}
                                </span>
                              )}
                            </div>
                            {isParticipantWinner(match, match.participantB.id, game) && (
                              <Trophy className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-400 flex-shrink-0" />
                            )}
                          </div>

                          {/* VS Tag before Participant C */}
                          {(match.participantC || game.contestType === 'SINGLE_ELIMINATION_1V1V1V1') && (
                            <div className={`px-3 py-2 rounded-lg text-xs sm:text-sm font-bold self-center ${
                              userMatch
                                ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg'
                                : 'bg-slate-600 text-slate-300'
                            }`}>
                              VS
                            </div>
                          )}

                          {/* Participant C (always show for 1v1v1v1 format) */}
                          {(match.participantC || game.contestType === 'SINGLE_ELIMINATION_1V1V1V1') && (
                            <div className={`relative flex items-center space-x-3 px-3 sm:px-4 py-2 sm:py-3 rounded-xl border-2 w-full sm:min-w-[120px] lg:min-w-[140px] transition-all duration-200 overflow-hidden ${
                              match.participantC && isParticipantWinner(match, match.participantC.id, game)
                                ? 'bg-gradient-to-r from-green-500/20 to-emerald-500/20 border-green-500/60 text-green-300 font-semibold shadow-lg shadow-green-500/20'
                                : match.participantC && match.winner && !isParticipantWinner(match, match.participantC.id, game) && match.participantC.id !== 'TBD'
                                  ? 'bg-gradient-to-r from-red-500/20 to-red-600/20 border-red-500/60 text-red-300 shadow-lg shadow-red-500/20'
                                  : userMatch
                                    ? 'bg-slate-600/70 border-slate-400/70 text-slate-200'
                                    : 'bg-slate-600/50 border-slate-500/50 text-slate-300'
                            }`}>
                              {/* Eliminated Badge */}
                              {match.participantC && match.winner && !isParticipantWinner(match, match.participantC.id, game) && match.participantC.id !== 'TBD' && (
                                <div className="absolute -top-1 -left-1 bg-red-600 text-white text-xs font-bold px-2 py-1 transform -rotate-45 origin-top-left shadow-lg">
                                  ELIMINATED
                                </div>
                              )}
                              <div className="flex flex-col flex-1 min-w-0">
                                <span className="font-medium text-sm sm:text-base truncate">{match.participantC?.name || 'TBD'}</span>
                                {match.participantC?.type === 'TEAM' && match.participantC.members && (
                                  <span className="text-xs opacity-75 mt-1">
                                    {match.participantC.members.map(member => member.name).join(', ')}
                                  </span>
                                )}
                              </div>
                              {match.participantC && isParticipantWinner(match, match.participantC.id, game) && (
                                <Trophy className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-400 flex-shrink-0" />
                              )}
                            </div>
                          )}

                          {/* VS Tag before Participant D */}
                          {(match.participantD || game.contestType === 'SINGLE_ELIMINATION_1V1V1V1') && (
                            <div className={`px-3 py-2 rounded-lg text-xs sm:text-sm font-bold self-center ${
                              userMatch
                                ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg'
                                : 'bg-slate-600 text-slate-300'
                            }`}>
                              VS
                            </div>
                          )}

                          {/* Participant D (always show for 1v1v1v1 format) */}
                          {(match.participantD || game.contestType === 'SINGLE_ELIMINATION_1V1V1V1') && (
                            <div className={`relative flex items-center space-x-3 px-3 sm:px-4 py-2 sm:py-3 rounded-xl border-2 w-full sm:min-w-[120px] lg:min-w-[140px] transition-all duration-200 overflow-hidden ${
                              match.participantD && isParticipantWinner(match, match.participantD.id, game)
                                ? 'bg-gradient-to-r from-green-500/20 to-emerald-500/20 border-green-500/60 text-green-300 font-semibold shadow-lg shadow-green-500/20'
                                : match.participantD && match.winner && !isParticipantWinner(match, match.participantD.id, game) && match.participantD.id !== 'TBD'
                                  ? 'bg-gradient-to-r from-red-500/20 to-red-600/20 border-red-500/60 text-red-300 shadow-lg shadow-red-500/20'
                                  : userMatch
                                    ? 'bg-slate-600/70 border-slate-400/70 text-slate-200'
                                    : 'bg-slate-600/50 border-slate-500/50 text-slate-300'
                            }`}>
                              {/* Eliminated Badge */}
                              {match.participantD && match.winner && !isParticipantWinner(match, match.participantD.id, game) && match.participantD.id !== 'TBD' && (
                                <div className="absolute -top-1 -left-1 bg-red-600 text-white text-xs font-bold px-2 py-1 transform -rotate-45 origin-top-left shadow-lg">
                                  ELIMINATED
                                </div>
                              )}
                              <div className="flex flex-col flex-1 min-w-0">
                                <span className="font-medium text-sm sm:text-base truncate">{match.participantD?.name || 'TBD'}</span>
                                {match.participantD?.type === 'TEAM' && match.participantD.members && (
                                  <span className="text-xs opacity-75 mt-1">
                                    {match.participantD.members.map(member => member.name).join(', ')}
                                  </span>
                                )}
                              </div>
                              {match.participantD && isParticipantWinner(match, match.participantD.id, game) && (
                                <Trophy className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-400 flex-shrink-0" />
                              )}
                            </div>
                          )}
                        </div>
                        
                        {/* Score Notes (if any) */}
                        {match.scoreNotes && (
                          <div className="text-center sm:text-right text-sm lg:ml-6">
                            <div className={`text-xs px-2 py-1 rounded inline-block ${
                              userMatch
                                ? 'bg-purple-500/20 text-purple-300'
                                : 'bg-slate-600/50 text-slate-400'
                            }`}>
                              Score: {match.scoreNotes}
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderRoundRobinSchedule = (game: Game) => {
    const matches = game.matches;
    if (matches.length === 0) {
      return (
        <div className="text-center text-slate-400 py-8">
          No matches scheduled yet
        </div>
      );
    }

    // Use the same round organization logic as Single Elimination
    const organizeMatchesIntoRounds = (matches: Match[]): Match[][] => {
      if (matches.length === 0) return [];
      
      // Filter out TBD vs TBD matches
      const validMatches = matches.filter(match =>
        !(match.participantA.id === 'TBD' && match.participantB.id === 'TBD')
      );
      
      if (validMatches.length === 0) return [];
      
      // Sort matches by time to maintain chronological order
      const sortedMatches = [...validMatches].sort((a, b) => {
        if (a.timeSlot && b.timeSlot) {
          return new Date(a.timeSlot.startTime).getTime() - new Date(b.timeSlot.startTime).getTime();
        }
        return 0;
      });
      
      // Calculate round number for each match
      const matchRounds: { match: Match; round: number }[] = [];
      
      for (let i = 0; i < sortedMatches.length; i++) {
        const currentMatch = sortedMatches[i];
        
        // Count how many times participant A and B appear in previous matches
        let aCount = 0;
        let bCount = 0;
        
        // Iterate backwards through previous matches
        for (let j = i - 1; j >= 0; j--) {
          const prevMatch = sortedMatches[j];
          
          // Count appearances of participant A
          if (currentMatch.participantA.id !== 'TBD') {
            if (prevMatch.participantA.id === currentMatch.participantA.id ||
                prevMatch.participantB.id === currentMatch.participantA.id) {
              aCount++;
            }
          }
          
          // Count appearances of participant B
          if (currentMatch.participantB.id !== 'TBD') {
            if (prevMatch.participantA.id === currentMatch.participantB.id ||
                prevMatch.participantB.id === currentMatch.participantB.id) {
              bCount++;
            }
          }
        }
        
        // Round number is the greater count + 1
        const roundNumber = Math.max(aCount, bCount) + 1;
        matchRounds.push({ match: currentMatch, round: roundNumber });
      }
      
      // Group matches by round number
      const rounds: Match[][] = [];
      const roundMap = new Map<number, Match[]>();
      
      matchRounds.forEach(({ match, round }) => {
        if (!roundMap.has(round)) {
          roundMap.set(round, []);
        }
        roundMap.get(round)!.push(match);
      });
      
      // Convert to array and sort by round number
      const sortedRoundNumbers = Array.from(roundMap.keys()).sort((a, b) => a - b);
      sortedRoundNumbers.forEach(roundNum => {
        rounds.push(roundMap.get(roundNum)!);
      });
      
      return rounds;
    };

    const rounds = organizeMatchesIntoRounds(matches);

    // Calculate tournament progress - only count matches with real participants
    const totalMatches = matches.filter(m => {
      if (game.contestType === 'SINGLE_ELIMINATION_1V1V1V1') {
        // For 1v1v1v1 format, count match if ANY participant is not TBD
        return !(m.participantA.id === 'TBD' &&
                 m.participantB.id === 'TBD' &&
                 (!m.participantC || m.participantC.id === 'TBD') &&
                 (!m.participantD || m.participantD.id === 'TBD'));
      } else {
        return m.participantA.id !== 'TBD' && m.participantB.id !== 'TBD';
      }
    }).length;
    const completedMatches = matches.filter(m => {
      if (!m.winner) return false;
      if (game.contestType === 'SINGLE_ELIMINATION_1V1V1V1') {
        // For 1v1v1v1 format, count completed match if ANY participant is not TBD
        return !(m.participantA.id === 'TBD' &&
                 m.participantB.id === 'TBD' &&
                 (!m.participantC || m.participantC.id === 'TBD') &&
                 (!m.participantD || m.participantD.id === 'TBD'));
      } else {
        return m.participantA.id !== 'TBD' && m.participantB.id !== 'TBD';
      }
    }).length;
    const tournamentProgress = totalMatches > 0 ? (completedMatches / totalMatches) * 100 : 0;
    
    // For Round Robin, determine leader based on wins
    const participantWins = new Map<string, number>();
    const isOneLoserMode = game.contestType === 'SINGLE_ELIMINATION_1V1V1V1' && game.oneLoserMode;
    
    matches.forEach(match => {
      if (match.winner) {
        if (isOneLoserMode) {
          // In 1 Loser mode, count wins for all participants except the winnerId (who is the loser)
          const allParticipants = [match.participantA, match.participantB, match.participantC, match.participantD]
            .filter((p): p is Participant => p !== undefined && p.id !== 'TBD');
          
          allParticipants.forEach(participant => {
            if (participant.id !== match.winner!.id) {
              const currentWins = participantWins.get(participant.id) || 0;
              participantWins.set(participant.id, currentWins + 1);
            }
          });
        } else {
          // Normal mode: winnerId is the winner
          const currentWins = participantWins.get(match.winner.id) || 0;
          participantWins.set(match.winner.id, currentWins + 1);
        }
      }
    });
    
    // Find current leader (participant with most wins)
    let leader = null;
    let maxWins = 0;
    for (const [participantId, wins] of participantWins.entries()) {
      if (wins > maxWins) {
        maxWins = wins;
        // Find the participant object
        const participant = matches.find(m =>
          m.participantA.id === participantId || m.participantB.id === participantId
        );
        if (participant) {
          leader = participant.participantA.id === participantId ? participant.participantA : participant.participantB;
        }
      }
    }

    return (
      <div className="space-y-8">
        {/* Tournament Progress Header */}
        <div className="bg-gradient-to-r from-slate-800/80 to-slate-700/80 rounded-xl p-4 sm:p-6 border border-slate-600/50">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-blue-600/20 rounded-full">
                <Trophy className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Round Robin Tournament</h3>
                <p className="text-slate-300 text-sm">
                  {game.participants.length} participants • {totalMatches} total matches
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-6">
              {/* Progress */}
              <div className="text-center">
                <div className="text-2xl font-bold text-white">{Math.round(tournamentProgress)}%</div>
                <div className="text-xs text-slate-400">Complete</div>
              </div>
              
              {/* Current Leader */}
              {leader && (
                <div className="text-center">
                  <div className="flex items-center justify-center space-x-3 mb-2">
                    <Medal className="w-5 h-5 text-yellow-400" />
                    
                    {/* Leader Avatar */}
                    {leader.type === 'USER' && (
                      <div className="flex-shrink-0">
                        {leader.avatarUrl ? (
                          <img
                            src={leader.avatarUrl}
                            alt={leader.name}
                            className="w-8 h-8 sm:w-10 sm:h-10 rounded-full object-cover border-2 border-yellow-400"
                          />
                        ) : (
                          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center border-2 border-yellow-400">
                            <span className="text-white text-xs sm:text-sm font-medium">
                              {leader.name?.[0] || 'U'}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Team Leader Avatars */}
                    {leader.type === 'TEAM' && leader.members && (
                      <div className="flex -space-x-1 flex-shrink-0">
                        {leader.members.slice(0, 2).map((member, index) => (
                          <div key={member.id} className="relative">
                            {member.avatarUrl ? (
                              <img
                                src={member.avatarUrl}
                                alt={member.name}
                                className="w-6 h-6 sm:w-8 sm:h-8 rounded-full object-cover border-2 border-yellow-400 bg-slate-800"
                              />
                            ) : (
                              <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center border-2 border-yellow-400">
                                <span className="text-white text-xs font-medium">
                                  {member.name?.[0] || member.email?.[0] || 'U'}
                                </span>
                              </div>
                            )}
                          </div>
                        ))}
                        {leader.members.length > 2 && (
                          <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-slate-600 border-2 border-yellow-400 flex items-center justify-center">
                            <span className="text-white text-xs font-medium">
                              +{leader.members.length - 2}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                    
                    <span className="text-white font-semibold">{leader.name}</span>
                  </div>
                  <div className="text-xs text-slate-400">Current Leader ({maxWins} wins)</div>
                </div>
              )}
            </div>
          </div>
          
          {/* Progress Bar */}
          <div className="mt-4">
            <div className="w-full bg-slate-700 rounded-full h-2">
              <div
                className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${tournamentProgress}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Tournament Complete - Champion */}
        {tournamentProgress === 100 && leader && (
          <div className="bg-gradient-to-r from-yellow-600/20 to-amber-600/20 border border-yellow-500/30 rounded-xl p-6 text-center">
            <div className="flex items-center justify-center space-x-3 mb-4">
              <Trophy className="w-8 h-8 text-yellow-400" />
              <h3 className="text-2xl font-bold text-yellow-300">Tournament Champion!</h3>
              <Trophy className="w-8 h-8 text-yellow-400" />
            </div>
            
            {/* Champion Avatar Section */}
            <div className="flex items-center justify-center space-x-4 mb-4">
              {/* Individual Champion Avatar */}
              {leader.type === 'USER' && (
                <div className="flex-shrink-0">
                  {leader.avatarUrl ? (
                    <img
                      src={leader.avatarUrl}
                      alt={leader.name}
                      className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover border-4 border-yellow-400 shadow-lg"
                    />
                  ) : (
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center border-4 border-yellow-400 shadow-lg">
                      <span className="text-white text-xl sm:text-2xl font-bold">
                        {leader.name?.[0] || 'U'}
                      </span>
                    </div>
                  )}
                </div>
              )}
              
              {/* Team Champion Avatars */}
              {leader.type === 'TEAM' && leader.members && (
                <div className="flex justify-center -space-x-3">
                  {leader.members.slice(0, 4).map((member, index) => (
                    <div key={member.id} className="relative">
                      {member.avatarUrl ? (
                        <img
                          src={member.avatarUrl}
                          alt={member.name}
                          className="w-12 h-12 sm:w-16 sm:h-16 rounded-full object-cover border-4 border-yellow-400 bg-slate-800 shadow-lg"
                        />
                      ) : (
                        <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center border-4 border-yellow-400 shadow-lg">
                          <span className="text-white text-sm sm:text-lg font-bold">
                            {member.name?.[0] || member.email?.[0] || 'U'}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                  {leader.members.length > 4 && (
                    <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-slate-600 border-4 border-yellow-400 flex items-center justify-center shadow-lg">
                      <span className="text-white text-sm sm:text-base font-bold">
                        +{leader.members.length - 4}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            <div className="text-3xl font-bold text-white mb-2">{leader.name}</div>
            {leader.type === 'TEAM' && leader.members && (
              <div className="text-slate-300 mb-4">
                {leader.members.map((member: any) => member.name).join(', ')}
              </div>
            )}
            <div className="text-yellow-300 font-semibold">
              🏆 {maxWins} Wins • Round Robin Champion 🏆
            </div>
          </div>
        )}

        {/* Rounds Display */}
        {rounds.map((round, roundIndex) => (
          <div key={roundIndex} className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <h4 className="text-lg font-semibold text-white">
                  Round {roundIndex + 1}
                </h4>
                <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                  round.every((m: Match) => m.winner)
                    ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                    : round.some((m: Match) => m.winner)
                      ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                      : 'bg-slate-600/50 text-slate-400 border border-slate-600/50'
                }`}>
                  {round.every((m: Match) => m.winner) ? 'Completed' : round.some((m: Match) => m.winner) ? 'In Progress' : 'Pending'}
                </div>
              </div>
              <div className="text-sm text-slate-400">
                {round.filter((m: Match) => m.winner).length} of {round.length} matches completed
              </div>
            </div>
            
            <div className="grid gap-4">
              {round.map((match) => {
                const userMatch = isUserMatch(match);
                return (
                  <Card
                    key={match.id}
                    className={`relative overflow-hidden transition-all duration-300 ${
                      userMatch
                        ? 'bg-gradient-to-r from-purple-900/30 to-blue-900/30 border-purple-500/50 shadow-lg shadow-purple-500/20'
                        : 'bg-slate-700/50 border-slate-600 hover:bg-slate-700/70'
                    }`}
                  >
                    {userMatch && match.winner && (
                      <div className="absolute top-0 right-0 bg-gradient-to-l from-purple-500 to-green-500 text-white text-xs font-bold px-3 py-1 rounded-bl-lg">
                        YOUR MATCH • CONCLUDED
                      </div>
                    )}
                    {userMatch && !match.winner && (
                      <div className="absolute top-0 right-0 bg-gradient-to-l from-purple-500 to-blue-500 text-white text-xs font-bold px-3 py-1 rounded-bl-lg">
                        YOUR MATCH
                      </div>
                    )}
                    {!userMatch && match.winner && (
                      <div className="absolute top-0 right-0 bg-gradient-to-l from-green-500 to-emerald-500 text-white text-xs font-bold px-3 py-1 rounded-bl-lg">
                        CONCLUDED
                      </div>
                    )}
                    
                    <CardContent className="p-4 sm:p-6">
                      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4 lg:space-x-6 flex-1 space-y-3 sm:space-y-0">
                          {/* Participant A */}
                          <div className={`relative flex items-center space-x-3 px-3 sm:px-4 py-2 sm:py-3 rounded-xl border-2 w-full sm:min-w-[120px] lg:min-w-[140px] transition-all duration-200 overflow-hidden ${
                            isParticipantWinner(match, match.participantA.id, game)
                              ? 'bg-gradient-to-r from-green-500/20 to-emerald-500/20 border-green-500/60 text-green-300 font-semibold shadow-lg shadow-green-500/20'
                              : match.winner && !isParticipantWinner(match, match.participantA.id, game) && match.participantA.id !== 'TBD'
                                ? 'bg-gradient-to-r from-red-500/20 to-red-600/20 border-red-500/60 text-red-300 shadow-lg shadow-red-500/20'
                                : userMatch
                                  ? 'bg-slate-600/70 border-slate-400/70 text-slate-200'
                                  : 'bg-slate-600/50 border-slate-500/50 text-slate-300'
                          }`}>
                            <div className="flex flex-col flex-1 min-w-0">
                              <span className="font-medium text-sm sm:text-base truncate">{match.participantA.name || 'TBD'}</span>
                              {match.participantA.type === 'TEAM' && match.participantA.members && (
                                <span className="text-xs opacity-75 mt-1">
                                  {match.participantA.members.map((member: any) => member.name).join(', ')}
                                </span>
                              )}
                            </div>
                            {isParticipantWinner(match, match.participantA.id, game) && (
                              <Trophy className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-400 flex-shrink-0" />
                            )}
                          </div>
                          
                          {/* VS Tag */}
                          <div className={`px-3 py-2 rounded-lg text-xs sm:text-sm font-bold self-center ${
                            userMatch
                              ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg'
                              : 'bg-slate-600 text-slate-300'
                          }`}>
                            VS
                          </div>
                          
                          {/* Participant B */}
                          <div className={`relative flex items-center space-x-3 px-3 sm:px-4 py-2 sm:py-3 rounded-xl border-2 w-full sm:min-w-[120px] lg:min-w-[140px] transition-all duration-200 overflow-hidden ${
                            isParticipantWinner(match, match.participantB.id, game)
                              ? 'bg-gradient-to-r from-green-500/20 to-emerald-500/20 border-green-500/60 text-green-300 font-semibold shadow-lg shadow-green-500/20'
                              : match.winner && !isParticipantWinner(match, match.participantB.id, game) && match.participantB.id !== 'TBD'
                                ? 'bg-gradient-to-r from-red-500/20 to-red-600/20 border-red-500/60 text-red-300 shadow-lg shadow-red-500/20'
                                : userMatch
                                  ? 'bg-slate-600/70 border-slate-400/70 text-slate-200'
                                  : 'bg-slate-600/50 border-slate-500/50 text-slate-300'
                          }`}>
                            <div className="flex flex-col flex-1 min-w-0">
                              <span className="font-medium text-sm sm:text-base truncate">{match.participantB.name || 'TBD'}</span>
                              {match.participantB.type === 'TEAM' && match.participantB.members && (
                                <span className="text-xs opacity-75 mt-1">
                                  {match.participantB.members.map((member: any) => member.name).join(', ')}
                                </span>
                              )}
                            </div>
                            {isParticipantWinner(match, match.participantB.id, game) && (
                              <Trophy className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-400 flex-shrink-0" />
                            )}
                          </div>
                        </div>
                        
                        <div className="text-center sm:text-right text-sm lg:ml-6">
                          {match.timeSlot && (
                            <div className={`flex items-center justify-center sm:justify-end space-x-2 mb-2 ${
                              userMatch ? 'text-purple-300' : 'text-slate-400'
                            }`}>
                              <Clock className="w-4 h-4" />
                              <span className="font-medium">{formatDateTime(match.timeSlot.startTime)}</span>
                            </div>
                          )}
                          {match.scoreNotes && (
                            <div className={`text-xs px-2 py-1 rounded inline-block ${
                              userMatch
                                ? 'bg-purple-500/20 text-purple-300'
                                : 'bg-slate-600/50 text-slate-400'
                            }`}>
                              Score: {match.scoreNotes}
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderScoringContest = (game: Game) => {
    const matches = game.matches;
    
    // Calculate progress and champion for scoring contest
    const participantScores: { [key: string]: { score: number; completedAt?: string; winner?: boolean } } = {};
    matches.forEach(match => {
      if (match.winner && match.scoreNotes) {
        const score = parseInt(match.scoreNotes) || 0;
        const winnerId = match.winner.id;
        participantScores[winnerId] = {
          score,
          completedAt: match.timeSlot?.startTime,
          winner: true
        };
      }
    });
    
    const completedCount = Object.keys(participantScores).length;
    const totalParticipants = game.participants.length;
    const tournamentProgress = totalParticipants > 0 ? (completedCount / totalParticipants) * 100 : 0;
    
    // Find champion based on highest score
    let champion = null;
    let highestScore = 0;
    
    for (const [participantId, scoreData] of Object.entries(participantScores)) {
      if (scoreData.score > highestScore) {
        highestScore = scoreData.score;
        const participant = game.participants.find((p: Participant) => p.id === participantId);
        champion = participant;
      }
    }

    return (
      <div className="space-y-8">
        {/* Tournament Progress Header */}
        <div className="bg-gradient-to-r from-slate-800/80 to-slate-700/80 rounded-xl p-4 sm:p-6 border border-slate-600/50">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-green-600/20 rounded-full">
                <Trophy className="w-6 h-6 text-green-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Scoring Contest</h3>
                <p className="text-slate-300 text-sm">
                  {game.participants.length} participants • Individual scoring competition
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-6">
              {/* Progress */}
              <div className="text-center">
                <div className="text-2xl font-bold text-white">{Math.round(tournamentProgress)}%</div>
                <div className="text-xs text-slate-400">Complete</div>
              </div>
              
              {/* Current Leader */}
              {champion && (
                <div className="text-center">
                  <div className="flex items-center justify-center space-x-3 mb-2">
                    <Medal className="w-5 h-5 text-yellow-400" />
                    
                    {/* Leader Avatar */}
                    {champion.type === 'USER' && (
                      <div className="flex-shrink-0">
                        {champion.avatarUrl ? (
                          <img
                            src={champion.avatarUrl}
                            alt={champion.name}
                            className="w-8 h-8 sm:w-10 sm:h-10 rounded-full object-cover border-2 border-yellow-400"
                          />
                        ) : (
                          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center border-2 border-yellow-400">
                            <span className="text-white text-xs sm:text-sm font-medium">
                              {champion.name?.[0] || 'U'}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Team Leader Avatars */}
                    {champion.type === 'TEAM' && champion.members && (
                      <div className="flex -space-x-1 flex-shrink-0">
                        {champion.members.slice(0, 2).map((member, index) => (
                          <div key={member.id} className="relative">
                            {member.avatarUrl ? (
                              <img
                                src={member.avatarUrl}
                                alt={member.name}
                                className="w-6 h-6 sm:w-8 sm:h-8 rounded-full object-cover border-2 border-yellow-400 bg-slate-800"
                              />
                            ) : (
                              <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center border-2 border-yellow-400">
                                <span className="text-white text-xs font-medium">
                                  {member.name?.[0] || member.email?.[0] || 'U'}
                                </span>
                              </div>
                            )}
                          </div>
                        ))}
                        {champion.members.length > 2 && (
                          <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-slate-600 border-2 border-yellow-400 flex items-center justify-center">
                            <span className="text-white text-xs font-medium">
                              +{champion.members.length - 2}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                    
                    <span className="text-white font-semibold">{champion.name}</span>
                  </div>
                  <div className="text-xs text-slate-400">Leading ({highestScore} points)</div>
                </div>
              )}
            </div>
          </div>
          
          {/* Progress Bar */}
          <div className="mt-4">
            <div className="w-full bg-slate-700 rounded-full h-2">
              <div
                className="bg-gradient-to-r from-blue-500 to-green-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${tournamentProgress}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Tournament Complete - Champion */}
        {tournamentProgress === 100 && champion && (
          <div className="bg-gradient-to-r from-yellow-600/20 to-amber-600/20 border border-yellow-500/30 rounded-xl p-6 text-center">
            <div className="flex items-center justify-center space-x-3 mb-4">
              <Trophy className="w-8 h-8 text-yellow-400" />
              <h3 className="text-2xl font-bold text-yellow-300">Contest Champion!</h3>
              <Trophy className="w-8 h-8 text-yellow-400" />
            </div>
            
            {/* Champion Avatar Section */}
            <div className="flex items-center justify-center space-x-4 mb-4">
              {/* Individual Champion Avatar */}
              {champion.type === 'USER' && (
                <div className="flex-shrink-0">
                  {champion.avatarUrl ? (
                    <img
                      src={champion.avatarUrl}
                      alt={champion.name}
                      className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover border-4 border-yellow-400 shadow-lg"
                    />
                  ) : (
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center border-4 border-yellow-400 shadow-lg">
                      <span className="text-white text-xl sm:text-2xl font-bold">
                        {champion.name?.[0] || 'U'}
                      </span>
                    </div>
                  )}
                </div>
              )}
              
              {/* Team Champion Avatars */}
              {champion.type === 'TEAM' && champion.members && (
                <div className="flex justify-center -space-x-3">
                  {champion.members.slice(0, 4).map((member, index) => (
                    <div key={member.id} className="relative">
                      {member.avatarUrl ? (
                        <img
                          src={member.avatarUrl}
                          alt={member.name}
                          className="w-12 h-12 sm:w-16 sm:h-16 rounded-full object-cover border-4 border-yellow-400 bg-slate-800 shadow-lg"
                        />
                      ) : (
                        <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center border-4 border-yellow-400 shadow-lg">
                          <span className="text-white text-sm sm:text-lg font-bold">
                            {member.name?.[0] || member.email?.[0] || 'U'}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                  {champion.members.length > 4 && (
                    <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-slate-600 border-4 border-yellow-400 flex items-center justify-center shadow-lg">
                      <span className="text-white text-sm sm:text-base font-bold">
                        +{champion.members.length - 4}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            <div className="text-3xl font-bold text-white mb-2">{champion.name}</div>
            {champion.type === 'TEAM' && champion.members && (
              <div className="text-slate-300 mb-4">
                {champion.members.map((member: any) => member.name).join(', ')}
              </div>
            )}
            <div className="text-yellow-300 font-semibold">
              🏆 {highestScore} Points • Scoring Contest Champion 🏆
            </div>
          </div>
        )}

        {/* Scoring Contest View */}
        <ScoringContestView key={game.id} game={game} user={user} formatTime={formatTime} showTimeSlots={false} />
      </div>
    );
  };

  const renderGameSchedule = (game: Game) => {
    switch (game.contestType) {
      case 'SINGLE_ELIMINATION':
      case 'SINGLE_ELIMINATION_1V1V1V1':
        return renderSingleEliminationBracket(game);
      case 'ROUND_ROBIN':
        return renderRoundRobinSchedule(game);
      case 'SCORING':
        return renderScoringContest(game);
      default:
        return renderRoundRobinSchedule(game); // Default fallback
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <Navigation currentPage="events" />
        <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-white text-xl">Loading schedule...</div>
          </div>
        </main>
      </div>
    );
  }

  if (error || !scheduleData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <Navigation currentPage="events" />
        <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-red-400 text-xl">{error || 'Schedule not found'}</div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <Navigation currentPage="events" />
      <main className="container mx-auto px-4 sm:px-6 md:px-8 py-4 sm:py-6 md:py-8">
        {/* Header */}
        <div className="mb-4 sm:mb-6 md:mb-8">
          <Button
                      variant="outline"
                      onClick={() => router.back()}
                      className="mb-4 border-slate-600 text-slate-300 hover:bg-slate-700 text-sm sm:text-base px-3 py-2 sm:px-4 sm:py-2"
                    >
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Back
                    </Button>
          
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="p-4 sm:p-6">
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <CardTitle className="text-white text-xl sm:text-2xl md:text-3xl truncate">{scheduleData.categoryName}</CardTitle>
                            <CardDescription className="text-slate-300 flex flex-col sm:flex-row sm:items-center sm:space-x-4 space-y-2 sm:space-y-0 mt-2 text-sm sm:text-base">
                              <span className="flex items-center space-x-1">
                                <Calendar className="w-4 h-4 sm:w-5 sm:h-5" />
                                <span>{formatDate(scheduleData.startDate)} - {formatDate(scheduleData.endDate)}</span>
                              </span>
                              <span className="flex items-center space-x-1">
                                <MapPin className="w-4 h-4 sm:w-5 sm:h-5" />
                                <span>{scheduleData.location}</span>
                              </span>
                            </CardDescription>
                          </div>
                        </div>
                      </CardHeader>
          </Card>
        </div>

        {scheduleData.games.length === 0 ? (
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-8 text-center">
              <div className="text-slate-400 text-lg">No games scheduled for this event yet</div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4 sm:space-y-6 md:space-y-8">
            {/* Mobile Slideshow / Desktop Grid */}
            <div className="lg:hidden space-y-6">
                          {/* Mobile Slideshow */}
                          <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader className="pb-4 sm:pb-6">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-2 sm:space-x-3">
                                      <Trophy className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-400" />
                                      <CardTitle className="text-white text-lg sm:text-xl">Games</CardTitle>
                                    </div>
                                    <div className="text-sm sm:text-base text-slate-400">
                                      {currentSlideIndex + 1} of {scheduleData.games.length}
                                    </div>
                                  </div>
                                </CardHeader>
                <CardContent className="space-y-4 sm:space-y-6">
                  {/* Current Game Card */}
                  <div className="relative">
                    {scheduleData.games.length > 0 && (
                      <div
                        className="relative rounded-lg border-2 border-blue-500 bg-blue-500/10 shadow-lg shadow-blue-500/20 cursor-pointer transition-all duration-200"
                        onClick={() => handleGameSelection(scheduleData.games[currentSlideIndex], currentSlideIndex)}
                        onTouchStart={(e) => {
                          touchStartX.current = e.touches[0].clientX;
                        }}
                        onTouchMove={(e) => {
                          touchEndX.current = e.touches[0].clientX;
                        }}
                        onTouchEnd={() => {
                          // Swipe left - next slide
                          if (touchStartX.current - touchEndX.current > 50) {
                            goToNextSlide();
                          }
                          // Swipe right - previous slide
                          else if (touchEndX.current - touchStartX.current > 50) {
                            goToPrevSlide();
                          }
                        }}
                      >
                        <div className="p-4 sm:p-6">
                                                  <div className="flex items-start justify-between mb-3 sm:mb-4">
                                                    <div className="flex-1 min-w-0">
                                                      <h3 className="font-bold text-lg sm:text-xl text-blue-300 truncate">
                                                        {scheduleData.games[currentSlideIndex].name}
                                                      </h3>
                                                      <div className="flex items-center space-x-2 mt-2">
                                                        <p className="text-sm sm:text-base text-slate-400 truncate">
                                                          {formatContestType(scheduleData.games[currentSlideIndex].contestType)}
                                                        </p>
                                                        <button
                                                          onClick={(e) => {
                                                            e.stopPropagation();
                                                            showRules(scheduleData.games[currentSlideIndex].contestType, scheduleData.games[currentSlideIndex].description);
                                                          }}
                                                          className="p-2 rounded-full bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 hover:text-blue-300 transition-all duration-200 hover:scale-110"
                                                          title="View contest rules"
                                                        >
                                                          <Info className="h-4 w-4" />
                                                        </button>
                                                      </div>
                                                    </div>
                                                    <div className="w-3 h-3 bg-blue-400 rounded-full animate-pulse flex-shrink-0 ml-2 sm:ml-3"></div>
                                                  </div>
                                                  
                                                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between text-sm sm:text-base space-y-2 sm:space-y-0">
                                                    <div className="flex items-center space-x-2 text-slate-400">
                                                      <Users className="w-4 h-4 flex-shrink-0" />
                                                      <span className="truncate">{scheduleData.games[currentSlideIndex].typeFormat}</span>
                                                    </div>
                                                    <div className="flex items-center space-x-2 text-slate-400">
                                                      <span className="w-3 h-3 bg-green-400 rounded-full flex-shrink-0"></span>
                                                      <span>{scheduleData.games[currentSlideIndex].participants.length} players</span>
                                                    </div>
                                                  </div>
                          
                          {scheduleData.games[currentSlideIndex].matches.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-slate-600">
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-slate-400">Matches</span>
                                <span className="font-medium text-blue-300">
                                  {scheduleData.games[currentSlideIndex].matches.length}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                        
                        {/* Selection indicator */}
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-400 rounded-l-lg"></div>
                      </div>
                    )}
                  </div>

                  {/* Navigation Controls */}
                  {scheduleData.games.length > 1 && (
                                      <div className="flex flex-col space-y-4">
                                                            {/* Navigation Controls */}
                                                            <div className="flex items-center justify-between px-2 sm:px-4">
                        {/* Previous Button */}
                        <Button
                                                  variant="outline"
                                                  size="icon"
                                                  onClick={goToPrevSlide}
                                                  className="border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white rounded-full w-10 h-10 flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95"
                                                >
                                                  <ChevronLeft className="w-5 h-5" />
                                                </Button>
                        
                                                {/* Dots Indicator */}
                                                                        <div className="flex space-x-2 sm:space-x-3">
                                                                          {scheduleData.games.map((_, index) => (
                                                                            <button
                                                                              key={index}
                                                                              onClick={() => goToSlide(index)}
                                                                              className={`w-3 h-3 sm:w-4 sm:h-4 rounded-full transition-all duration-200 ${
                                                                                index === currentSlideIndex
                                                                                  ? 'bg-blue-400 scale-125'
                                                                                  : 'bg-slate-600 hover:bg-slate-500'
                                                                              }`}
                                                                              aria-label={`Go to slide ${index + 1}`}
                                                                            />
                                                                          ))}
                                                                        </div>
                        
                                                {/* Next Button */}
                                                <Button
                                                  variant="outline"
                                                  size="icon"
                                                  onClick={goToNextSlide}
                                                  className="border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white rounded-full w-10 h-10 flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95"
                                                >
                                                  <ChevronRight className="w-5 h-5" />
                                                </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Schedule Display for Mobile */}
            <div className="lg:hidden space-y-6" ref={matchesSectionRef}>
                          {selectedGame && (
                <Card className="bg-slate-800/50 border-slate-700">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-white text-xl flex items-center space-x-2">
                          <Trophy className="w-6 h-6" />
                          <span>{selectedGame.name}</span>
                        </CardTitle>
                        <CardDescription className="text-slate-300 text-sm sm:text-base mt-2">
                                                  <span className="flex flex-wrap items-center gap-2">
                                                    <span>{formatContestType(selectedGame.contestType)}</span>
                                                    <span>•</span>
                                                    <span>{selectedGame.typeFormat}</span>
                                                    <span>•</span>
                                                    <span>{selectedGame.participants.length} participants</span>
                                                  </span>
                                                </CardDescription>
                      </div>
                      <button
                        onClick={() => showRules(selectedGame.contestType)}
                        className="p-2 rounded-full bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 hover:text-blue-300 transition-all duration-200 hover:scale-110 flex-shrink-0 ml-4"
                        title="View contest rules"
                      >
                        <Info className="h-5 w-5" />
                      </button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {renderGameSchedule(selectedGame)}
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Desktop Grid Layout */}
            <div className="hidden lg:grid lg:grid-cols-4 gap-6">
              {/* Game Selection Sidebar */}
              <div className="lg:col-span-1">
                <Card className="bg-slate-800/50 border-slate-700 lg:sticky lg:top-4">
                  <CardHeader className="pb-4 sm:pb-6">
                                      <CardTitle className="text-white text-lg sm:text-xl flex items-center space-x-2 sm:space-x-3">
                                        <Trophy className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-400" />
                                        <span>Games</span>
                                      </CardTitle>
                                      <CardDescription className="text-slate-400 text-sm sm:text-base">
                                        Select a game to view its schedule
                                      </CardDescription>
                                    </CardHeader>
                  <CardContent className="space-y-3">
                    {scheduleData.games.map((game, index) => (
                      <div
                        key={game.id}
                        className={`relative rounded-lg border-2 transition-all duration-200 cursor-pointer ${
                          selectedGame?.id === game.id
                            ? "border-blue-500 bg-blue-500/10 shadow-lg shadow-blue-500/20"
                            : "border-slate-600 bg-slate-700/30 hover:border-slate-500 hover:bg-slate-700/50"
                        }`}
                        onClick={() => handleGameSelection(game, index)}
                      >
                        <div className="p-3 sm:p-4 md:p-5">
                                                <div className="flex items-start justify-between mb-2 sm:mb-3">
                                                  <div className="flex-1 min-w-0">
                                                    <h3 className={`font-semibold text-sm sm:text-base md:text-lg truncate ${
                                                      selectedGame?.id === game.id ? "text-blue-300" : "text-white"
                                                    }`}>
                                                      {game.name}
                                                    </h3>
                                                    <div className="flex items-center space-x-2 mt-1">
                                                      <p className="text-xs sm:text-sm text-slate-400 truncate">
                                                        {formatContestType(game.contestType)}
                                                      </p>
                                                      <button
                                                        onClick={(e) => {
                                                          e.stopPropagation();
                                                          showRules(game.contestType, game.description);
                                                        }}
                                                        className="p-1 sm:p-2 rounded-full bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 hover:text-blue-300 transition-all duration-200 hover:scale-110"
                                                        title="View contest rules"
                                                      >
                                                        <Info className="h-3 w-3 sm:h-4 sm:w-4" />
                                                      </button>
                                                    </div>
                                                  </div>
                                                  {selectedGame?.id === game.id && (
                                                    <div className="w-2 h-2 sm:w-3 sm:h-3 bg-blue-400 rounded-full animate-pulse flex-shrink-0 ml-2"></div>
                                                  )}
                                                </div>
                                                
                                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between text-xs sm:text-sm space-y-1 sm:space-y-0">
                                                  <div className="flex items-center space-x-1 text-slate-400">
                                                    <Users className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                                                    <span className="truncate">{game.typeFormat}</span>
                                                  </div>
                                                  <div className="flex items-center space-x-1 text-slate-400">
                                                    <span className="w-2 h-2 sm:w-3 sm:h-3 bg-green-400 rounded-full flex-shrink-0"></span>
                                                    <span>{game.participants.length} players</span>
                                                  </div>
                                                </div>
                          
                          {game.matches.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-slate-600">
                                                        <div className="flex items-center justify-between text-xs sm:text-sm">
                                                          <span className="text-slate-400">Matches</span>
                                                          <span className={`font-medium ${
                                                            selectedGame?.id === game.id ? "text-blue-300" : "text-slate-300"
                                                          }`}>
                                                            {game.matches.length}
                                                          </span>
                                                        </div>
                                                      </div>
                          )}
                        </div>
                        
                        {/* Selection indicator */}
                        {selectedGame?.id === game.id && (
                          <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-400 rounded-l-lg"></div>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>

              {/* Schedule Display */}
              <div className="lg:col-span-3" ref={matchesSectionRef}>
                {selectedGame && (
                  <Card className="bg-slate-800/50 border-slate-700">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-white text-xl flex items-center space-x-2">
                            <Trophy className="w-6 h-6" />
                            <span>{selectedGame.name}</span>
                          </CardTitle>
                          <CardDescription className="text-slate-300 flex items-center space-x-2 mt-2">
                            <span>{formatContestType(selectedGame.contestType)} • {selectedGame.typeFormat} • {selectedGame.participants.length} participants</span>
                          </CardDescription>
                        </div>
                        <button
                          onClick={() => showRules(selectedGame.contestType)}
                          className="p-2 rounded-full bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 hover:text-blue-300 transition-all duration-200 hover:scale-110 flex-shrink-0 ml-4"
                          title="View contest rules"
                        >
                          <Info className="h-5 w-5" />
                        </button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {renderGameSchedule(selectedGame)}
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Rules Modal */}
        {showRulesModal && selectedContestRules && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <Card className="w-full max-w-2xl bg-slate-800 border-slate-700 max-h-[90vh] overflow-y-auto shadow-2xl">
              <CardHeader className="border-b border-slate-700 relative">
                <div className="absolute top-4 right-4 flex items-center space-x-2">
                  <div className="p-2 bg-blue-600/20 rounded-full">
                    <Info className="h-5 w-5 text-blue-400" />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={closeRulesModal}
                    className="hover:bg-slate-700 p-2"
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>
                <div className="pr-20">
                  <CardTitle className="text-white text-xl flex items-center">
                    {selectedContestRules.title}
                  </CardTitle>
                  <CardDescription className="text-slate-300 mt-2 text-base">
                    {selectedContestRules.description}
                  </CardDescription>
                  {selectedContestRules.gameDescription && (
                    <div className="mt-4 p-3 bg-slate-700/50 rounded-lg border border-slate-600">
                      <h4 className="text-sm font-semibold text-slate-300 mb-2">Game Description:</h4>
                      <div className="text-slate-200 text-sm">
                        <FormattedText text={selectedContestRules.gameDescription} />
                      </div>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-6">
                  <div className="bg-gradient-to-r from-blue-600/10 to-purple-600/10 p-4 rounded-lg border border-blue-500/20">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                      <Target className="h-5 w-5 mr-2 text-blue-400" />
                      How It Works:
                    </h3>
                    <ul className="space-y-4">
                      {selectedContestRules.rules.map((rule, index) => (
                        <li key={index} className="flex items-start space-x-4">
                          <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-full flex items-center justify-center text-sm font-bold shadow-lg">
                            {index + 1}
                          </div>
                          <span className="text-slate-200 leading-relaxed text-base pt-1">{rule}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="flex justify-center pt-2">
                    <Button
                      onClick={closeRulesModal}
                      className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-2 shadow-lg hover:shadow-xl transition-all duration-200"
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Got it!
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
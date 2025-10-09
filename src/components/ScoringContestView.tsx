
"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Users, Target, Medal, TrendingUp, CheckCircle, Timer, Award, Star, Trophy, Clock } from "lucide-react";

interface Participant {
  id: string;
  type: 'USER' | 'TEAM';
  name: string;
  email?: string;
  members?: {
    id: string;
    name: string;
    email: string;
  }[];
}

interface Match {
  id: string;
  participantA: Participant;
  participantB: Participant;
  winner?: Participant;
  scoreNotes?: string;
  timeSlot?: {
    startTime: string;
    endTime: string;
  };
  flags?: any;
}

interface Game {
  id: string;
  name: string;
  contestType: string;
  typeFormat: string;
  participants: Participant[];
  matches: Match[];
  slots: any[];
}

interface ScoringContestViewProps {
  game: Game;
  user?: any;
  formatTime: (dateString: string) => string;
  showTimeSlots?: boolean;
}

export default function ScoringContestView({ game, user, formatTime, showTimeSlots = true }: ScoringContestViewProps) {
  const participants = game.participants;
  const matches = game.matches;
  
  if (participants.length === 0) {
    return (
      <div className="text-center text-slate-400 py-12">
        <Target className="h-16 w-16 mx-auto mb-4 opacity-50" />
        <h3 className="text-lg font-medium text-white mb-2">No participants registered yet</h3>
        <p className="text-sm">Participants will appear here once they register for this scoring contest.</p>
      </div>
    );
  }

  // Create a map of participant scores from matches
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

  // Sort participants by score (highest first), then by name
  const sortedParticipants = [...participants].sort((a, b) => {
    const scoreA = participantScores[a.id]?.score || 0;
    const scoreB = participantScores[b.id]?.score || 0;
    
    if (scoreA !== scoreB) {
      return scoreB - scoreA; // Higher scores first
    }
    return a.name.localeCompare(b.name);
  });

  // Calculate statistics
  const completedCount = Object.keys(participantScores).length;
  const totalParticipants = participants.length;
  const completionRate = totalParticipants > 0 ? (completedCount / totalParticipants) * 100 : 0;
  const scores = Object.values(participantScores).map(p => p.score);
  const highestScore = scores.length > 0 ? Math.max(...scores) : 0;
  const averageScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;

  return (
    <div className="space-y-6">
      {/* Contest Statistics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-900/30 to-blue-800/20 border-blue-500/30">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <Users className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <div className="text-2xl font-bold text-white">{totalParticipants}</div>
                <div className="text-xs text-blue-300">Total Players</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-900/30 to-green-800/20 border-green-500/30">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-green-500/20 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-400" />
              </div>
              <div>
                <div className="text-2xl font-bold text-white">{completedCount}</div>
                <div className="text-xs text-green-300">Completed</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-yellow-900/30 to-yellow-800/20 border-yellow-500/30">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-yellow-500/20 rounded-lg">
                <Trophy className="h-5 w-5 text-yellow-400" />
              </div>
              <div>
                <div className="text-2xl font-bold text-white">{highestScore}</div>
                <div className="text-xs text-yellow-300">High Score</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-900/30 to-purple-800/20 border-purple-500/30">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <TrendingUp className="h-5 w-5 text-purple-400" />
              </div>
              <div>
                <div className="text-2xl font-bold text-white">{averageScore}</div>
                <div className="text-xs text-purple-300">Average</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>


      {/* Leaderboard */}
      <div>
        <div className="flex items-center space-x-2 mb-4">
          <Medal className="h-5 w-5 text-yellow-400" />
          <h4 className="text-lg font-semibold text-white">Leaderboard</h4>
        </div>
        
        <div className="space-y-3">
          {sortedParticipants.map((participant, index) => {
            const participantData = participantScores[participant.id];
            const hasScore = participantData !== undefined;
            const isCurrentUser = user && (
              participant.id === user.id || 
              (participant.type === 'TEAM' && participant.members?.some(member => member.id === user.id))
            );
            
            // Calculate position only for participants with scores
            let position: number | null = null;
            if (hasScore) {
              // Find the actual position by counting participants with higher scores
              const higherScores = sortedParticipants.slice(0, index).filter(p => participantScores[p.id]?.score > 0);
              position = higherScores.length + 1;
            }
            
            // Determine rank styling
            let rankStyling = '';
            let rankIcon = null;
            if (position === 1) {
              rankStyling = 'from-yellow-900/40 to-yellow-800/20 border-yellow-500/50';
              rankIcon = <Award className="h-5 w-5 text-yellow-400" />;
            } else if (position === 2) {
              rankStyling = 'from-gray-900/40 to-gray-800/20 border-gray-400/50';
              rankIcon = <Award className="h-5 w-5 text-gray-400" />;
            } else if (position === 3) {
              rankStyling = 'from-orange-900/40 to-orange-800/20 border-orange-600/50';
              rankIcon = <Award className="h-5 w-5 text-orange-500" />;
            }

            return (
              <Card 
                key={participant.id} 
                className={`relative overflow-hidden transition-all duration-300 ${
                  isCurrentUser
                    ? 'bg-gradient-to-r from-purple-900/40 to-blue-900/30 border-purple-500/50 shadow-lg shadow-purple-500/20'
                    : hasScore
                      ? `bg-gradient-to-r ${rankStyling || 'from-slate-800/50 to-slate-700/30'} border-slate-600`
                      : 'bg-slate-700/30 border-slate-600/50'
                }`}
              >
                {isCurrentUser && (
                  <div className="absolute top-0 right-0 bg-gradient-to-l from-purple-500 to-blue-500 text-white text-xs font-bold px-3 py-1 rounded-bl-lg">
                    YOU
                  </div>
                )}
                
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4 flex-1 min-w-0">
                      {/* Rank/Position */}
                      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-slate-600/50 flex-shrink-0">
                        {hasScore ? (
                          position && position <= 3 ? rankIcon : (
                            <span className="text-sm font-bold text-white">#{position}</span>
                          )
                        ) : (
                          <Timer className="h-4 w-4 text-slate-400" />
                        )}
                      </div>

                      {/* Participant Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className={`font-semibold text-base truncate ${
                            isCurrentUser ? 'text-purple-200' : 'text-white'
                          }`}>
                            {participant.name}
                          </span>
                          {position === 1 && (
                            <Star className="h-4 w-4 text-yellow-400 animate-pulse" />
                          )}
                        </div>
                        
                        {participant.type === 'TEAM' && participant.members && (
                          <div className="text-xs text-slate-400 truncate">
                            {participant.members.map(member => member.name).join(', ')}
                          </div>
                        )}
                        
                        {/* Status */}
                        <div className="flex items-center space-x-2 mt-1">
                          {hasScore ? (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-500/20 text-green-300 border border-green-500/30">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Completed
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-orange-500/20 text-orange-300 border border-orange-500/30">
                              <Timer className="h-3 w-3 mr-1" />
                              Pending
                            </span>
                          )}
                          
                          {participantData?.completedAt && (
                            <span className="text-xs text-slate-400">
                              {formatTime(participantData.completedAt)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Score Display */}
                    <div className="text-right">
                      {hasScore ? (
                        <div className="flex flex-col items-end">
                          <div className={`text-2xl font-bold ${
                            position === 1 ? 'text-yellow-400' : 
                            position === 2 ? 'text-gray-400' : 
                            position === 3 ? 'text-orange-500' : 'text-white'
                          }`}>
                            {participantData.score}
                          </div>
                          <div className="text-xs text-slate-400">points</div>
                        </div>
                      ) : (
                        <div className="text-slate-500">
                          <div className="text-lg">--</div>
                          <div className="text-xs">No score</div>
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

      {/* Time Slots (if any) */}
      {showTimeSlots && game.slots.length > 0 && (
        <div>
          <h4 className="text-lg font-semibold text-white mb-4 flex items-center space-x-2">
            <Clock className="h-5 w-5" />
            <span>Scheduled Time Slots</span>
          </h4>
          <div className="grid gap-3">
            {game.slots.map((slot: any) => (
              <Card key={slot.id} className="bg-slate-700/50 border-slate-600">
                <CardContent className="p-3 sm:p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                      <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-white font-medium text-sm sm:text-base">
                          {formatTime(slot.startTime)} - {formatTime(slot.endTime)}
                        </div>
                        <div className="text-xs text-slate-400">
                          Available for scoring
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
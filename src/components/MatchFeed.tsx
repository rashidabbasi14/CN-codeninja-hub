"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, Users, Clock, Gamepad2, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { useUser } from "@/contexts/UserContext";

interface Participant {
  id: string;
  name: string;
  type: 'USER' | 'TEAM';
  department?: string;
  members?: string[];
}

interface RecentMatch {
  id: string;
  gameId: string;
  gameName: string;
  categoryName: string;
  participantA: Participant;
  participantB: Participant;
  winner: Participant;
  scoreNotes?: string;
  completedAt: string;
  startTime?: string;
  endTime?: string;
}

interface MatchFeedData {
  matches: RecentMatch[];
  count: number;
  lastUpdated: string;
}

export default function MatchFeed() {
  const { apiCall } = useUser();
  const [matchFeedData, setMatchFeedData] = useState<MatchFeedData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadMatchFeed = async (showLoading = true) => {
    if (showLoading) {
      setLoading(true);
    }
    
    try {
      const response = await apiCall('/api/matches/recent');
      if (response.ok) {
        const data = await response.json();
        setMatchFeedData(data);
      }
    } catch (error) {
      console.error('Failed to load match feed:', error);
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  };

  // Initial load
  useEffect(() => {
    loadMatchFeed();
  }, []);

  // Auto-refresh every 15 seconds (15,000 ms)
  useEffect(() => {
    const interval = setInterval(() => {
      loadMatchFeed(false); // Silent refresh
    }, 15000); // 15 seconds

    return () => clearInterval(interval);
  }, []);

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays}d ago`;
  };

  const getParticipantDisplay = (participant: Participant) => {
    if (participant.type === 'TEAM') {
      return (
        <div>
          <div className="font-medium text-white">{participant.name}</div>
          {participant.members && participant.members.length > 0 && (
            <div className="text-xs text-slate-400">
              {participant.members.slice(0, 2).join(', ')}
              {participant.members.length > 2 && ` +${participant.members.length - 2} more`}
            </div>
          )}
        </div>
      );
    } else {
      return (
        <div>
          <div className="font-medium text-white">{participant.name}</div>
          {participant.department && (
            <div className="text-xs text-slate-400">{participant.department}</div>
          )}
        </div>
      );
    }
  };

  if (loading) {
    return (
      <Card className="bg-slate-800/50 border-slate-700 mb-6">
        <CardHeader>
          <CardTitle className="text-white text-xl flex items-center">
            <Trophy className="h-5 w-5 mr-2 text-orange-400" />
            Recent Match Results
          </CardTitle>
          <CardDescription className="text-slate-300">
            Loading latest concluded matches...
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <RefreshCw className="h-8 w-8 mx-auto mb-2 text-slate-400 animate-spin" />
            <div className="text-slate-400">Loading match feed...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!matchFeedData || matchFeedData.matches.length === 0) {
    return (
      <Card className="bg-slate-800/50 border-slate-700 mb-6">
        <CardHeader>
          <CardTitle className="text-white text-xl flex items-center">
            <Trophy className="h-5 w-5 mr-2 text-orange-400" />
            Recent Match Results
          </CardTitle>
          <CardDescription className="text-slate-300">
            No recent matches found
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Gamepad2 className="h-8 w-8 mx-auto mb-2 text-slate-400" />
            <div className="text-slate-400">No concluded matches yet</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-slate-800/50 border-slate-700 mb-6">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-white text-xl flex items-center">
              <Trophy className="h-5 w-5 mr-2 text-orange-400" />
              Recent Match Results
            </CardTitle>
            <CardDescription className="text-slate-300">
              Last {matchFeedData.count} concluded matches
            </CardDescription>
          </div>
          <div className="flex items-center">
            <div
              className="cursor-pointer"
              onClick={() => loadMatchFeed(false)}
              title="Refresh matches"
            >
              <RefreshCw
                className="h-4 w-4 text-slate-400 hover:text-slate-300 transition-colors duration-200"
              />
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 max-h-96 overflow-y-auto scrollbar-thin scrollbar-track-slate-800 scrollbar-thumb-slate-600 hover:scrollbar-thumb-slate-500 pr-2">
          {matchFeedData.matches.map((match) => (
            <div
              key={match.id}
              className="p-3 rounded-lg bg-slate-700/30 hover:bg-slate-700/50 transition-colors"
            >
              {/* Game Info Header */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2 min-w-0">
                  <Gamepad2 className="h-4 w-4 text-blue-400 flex-shrink-0" />
                  <span className="font-medium text-white text-sm truncate">
                    {match.gameName}
                  </span>
                  <span className="hidden sm:inline text-xs text-slate-400 px-2 py-0.5 bg-slate-600/50 rounded">
                    {match.categoryName}
                  </span>
                </div>
                <div className="flex items-center space-x-1 text-xs text-slate-400 flex-shrink-0">
                  <Clock className="h-3 w-3" />
                  <span>{formatTimeAgo(match.completedAt)}</span>
                </div>
              </div>
              
              {/* Participants with Winner Highlight */}
              {match.participantB ? (
                // Regular match with two participants
                <div className="flex items-center justify-center space-x-3">
                  {/* Participant A */}
                  <div className={`flex items-center space-x-2 px-3 py-2 rounded-lg flex-1 min-w-0 ${
                    match.winner.id === match.participantA.id
                      ? 'bg-green-500/20 border border-green-500/30'
                      : 'bg-slate-600/30'
                  }`}>
                    {match.participantA.type === 'TEAM' ? (
                      <Users className="h-4 w-4 text-purple-400 flex-shrink-0" />
                    ) : (
                      <div className="w-4 h-4 rounded-full bg-blue-400 flex-shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center space-x-1">
                        <span className="text-white text-sm font-medium truncate">
                          {match.participantA.name}
                        </span>
                        {match.winner.id === match.participantA.id && (
                          <Trophy className="h-3 w-3 text-yellow-400 flex-shrink-0" />
                        )}
                      </div>
                      {match.participantA.department && match.participantA.type === 'USER' && (
                        <div className="text-xs text-slate-400 truncate">
                          {match.participantA.department}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* VS Divider */}
                  <div className="text-slate-500 text-xs font-bold px-1">VS</div>
                  
                  {/* Participant B */}
                  <div className={`flex items-center space-x-2 px-3 py-2 rounded-lg flex-1 min-w-0 ${
                    match.winner.id === match.participantB.id
                      ? 'bg-green-500/20 border border-green-500/30'
                      : 'bg-slate-600/30'
                  }`}>
                    {match.participantB.type === 'TEAM' ? (
                      <Users className="h-4 w-4 text-purple-400 flex-shrink-0" />
                    ) : (
                      <div className="w-4 h-4 rounded-full bg-blue-400 flex-shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center space-x-1">
                        <span className="text-white text-sm font-medium truncate">
                          {match.participantB.name}
                        </span>
                        {match.winner.id === match.participantB.id && (
                          <Trophy className="h-3 w-3 text-yellow-400 flex-shrink-0" />
                        )}
                      </div>
                      {match.participantB.department && match.participantB.type === 'USER' && (
                        <div className="text-xs text-slate-400 truncate">
                          {match.participantB.department}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                // Scoring contest with single participant
                <div className="flex items-center justify-center">
                  <div className="flex items-center space-x-2 px-4 py-3 rounded-lg bg-green-500/20 border border-green-500/30 max-w-md">
                    <div className="flex items-center space-x-2">
                      {match.participantA.type === 'TEAM' ? (
                        <Users className="h-4 w-4 text-purple-400 flex-shrink-0" />
                      ) : (
                        <div className="w-4 h-4 rounded-full bg-blue-400 flex-shrink-0" />
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center space-x-2">
                          <span className="text-white text-sm font-medium">
                            {match.participantA.name}
                          </span>
                          <Trophy className="h-4 w-4 text-yellow-400 flex-shrink-0" />
                          {match.scoreNotes && (
                            <span className="text-xs text-green-300 bg-green-600/30 px-2 py-1 rounded font-mono">
                              {match.scoreNotes}
                            </span>
                          )}
                        </div>
                        {match.participantA.department && match.participantA.type === 'USER' && (
                          <div className="text-xs text-slate-400">
                            {match.participantA.department}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Category on mobile */}
              <div className="sm:hidden mt-2 text-center">
                <span className="text-xs text-slate-400 px-2 py-1 bg-slate-600/50 rounded">
                  {match.categoryName}
                </span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
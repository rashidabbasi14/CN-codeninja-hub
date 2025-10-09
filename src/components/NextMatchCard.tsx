"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, Users, Calendar, Trophy, User, MapPin } from "lucide-react";
import { useUser } from "@/contexts/UserContext";

interface NextMatchData {
  id: string;
  game: {
    id: string;
    name: string;
    contestType: string;
    category: {
      name: string;
      status: string;
    };
  };
  slot: {
    startTime: string;
    endTime: string;
  };
  opponent: {
    id?: string;
    firstName?: string;
    lastName?: string;
    avatarUrl?: string;
    type?: 'team' | 'multi';
    name?: string;
    members?: Array<{
      id: string;
      firstName: string;
      lastName: string;
      avatarUrl?: string;
    }>;
    opponents?: Array<{
      id: string;
      firstName: string;
      lastName: string;
      avatarUrl?: string;
    }>;
    count?: number;
  } | null;
  userSide: 'A' | 'B' | 'MULTI' | null;
}

const formatContestType = (contestType: string): string => {
  switch (contestType) {
    case 'SINGLE_ELIMINATION':
      return 'Single Elimination';
    case 'SINGLE_ELIMINATION_1V1V1V1':
      return 'Single Elimination (4 Players)';
    case 'ROUND_ROBIN':
      return 'Round Robin';
    case 'SCORING':
      return 'Scoring Contest';
    default:
      return contestType;
  }
};

const formatDateTime = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const isTomorrow = date.toDateString() === new Date(now.getTime() + 24 * 60 * 60 * 1000).toDateString();
  
  const timeString = date.toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: true 
  });
  
  if (isToday) {
    return `Today at ${timeString}`;
  } else if (isTomorrow) {
    return `Tomorrow at ${timeString}`;
  } else {
    return `${date.toLocaleDateString([], { 
      month: 'short', 
      day: 'numeric' 
    })} at ${timeString}`;
  }
};

const getTimeUntilMatch = (dateString: string) => {
  const matchTime = new Date(dateString);
  const now = new Date();
  const diffMs = matchTime.getTime() - now.getTime();
  
  if (diffMs <= 0) return 'Starting soon';
  
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffDays > 0) {
    return `in ${diffDays} day${diffDays > 1 ? 's' : ''}`;
  } else if (diffHours > 0) {
    return `in ${diffHours}h ${diffMinutes}m`;
  } else {
    return `in ${diffMinutes}m`;
  }
};

export default function NextMatchCard() {
  const { user, apiCall } = useUser();
  const [nextMatch, setNextMatch] = useState<NextMatchData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNextMatch = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const response = await apiCall('/api/user/next-match');
        if (response.ok) {
          const data = await response.json();
          setNextMatch(data.nextMatch);
        }
      } catch (error) {
        console.error('Failed to fetch next match:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchNextMatch();
  }, [user, apiCall]);

  // Don't render anything if user is not logged in or no match found
  if (!user || loading || !nextMatch) {
    return null;
  }

  const renderOpponent = () => {
    if (!nextMatch.opponent) {
      return (
        <div className="flex items-center space-x-2 text-slate-400">
          <User className="h-4 w-4" />
          <span className="text-sm">Waiting for opponent</span>
        </div>
      );
    }

    if (nextMatch.opponent.type === 'multi') {
      return (
        <div className="flex items-center space-x-2">
          <Users className="h-4 w-4 text-purple-400" />
          <div className="flex flex-col">
            <span className="text-sm font-medium text-white">
              {nextMatch.opponent.count || 0} Players
            </span>
            <div className="text-xs text-slate-400">
              {nextMatch.opponent.opponents?.slice(0, 2).map((opp, idx) => (
                <span key={opp.id}>
                  {opp.firstName} {opp.lastName}
                  {idx < Math.min(1, (nextMatch.opponent?.opponents?.length || 1) - 1) ? ', ' : ''}
                </span>
              ))}
              {(nextMatch.opponent.opponents?.length || 0) > 2 && (
                <span> +{(nextMatch.opponent.opponents?.length || 0) - 2} more</span>
              )}
            </div>
          </div>
        </div>
      );
    }

    if (nextMatch.opponent.type === 'team') {
      return (
        <div className="flex items-center space-x-2">
          <Users className="h-4 w-4 text-blue-400" />
          <div className="flex flex-col">
            <span className="text-sm font-medium text-white">
              {nextMatch.opponent.name}
            </span>
            <span className="text-xs text-slate-400">
              {nextMatch.opponent.members?.length || 0} members
            </span>
          </div>
        </div>
      );
    }

    return (
      <div className="flex items-center space-x-2">
        <User className="h-4 w-4 text-green-400" />
        <span className="text-sm font-medium text-white">
          {nextMatch.opponent.firstName} {nextMatch.opponent.lastName}
        </span>
      </div>
    );
  };

  return (
    <Card className="bg-gradient-to-r from-blue-900/50 to-purple-900/50 border-blue-500/30 mb-6 shadow-lg">
      <CardHeader className="pb-3">
        <CardTitle className="text-white text-lg flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Trophy className="h-5 w-5 text-yellow-400" />
            <span>Your Next Match</span>
          </div>
          <div className="text-xs bg-blue-500/20 text-blue-300 px-2 py-1 rounded-full">
            {getTimeUntilMatch(nextMatch.slot.startTime)}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Game Info */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
          <div>
            <h3 className="text-white font-semibold text-base">
              {nextMatch.game.name}
            </h3>
            <p className="text-slate-300 text-sm">
              {nextMatch.game.category.name} • {formatContestType(nextMatch.game.contestType)}
            </p>
          </div>
        </div>

        {/* Time and Opponent */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Time */}
          <div className="flex items-center space-x-2">
            <Clock className="h-4 w-4 text-orange-400" />
            <div className="flex flex-col">
              <span className="text-sm font-medium text-white">
                {formatDateTime(nextMatch.slot.startTime)}
              </span>
              <span className="text-xs text-slate-400">
                Duration: {Math.round((new Date(nextMatch.slot.endTime).getTime() - new Date(nextMatch.slot.startTime).getTime()) / (1000 * 60))} min
              </span>
            </div>
          </div>

          {/* Opponent */}
          <div>
            <div className="text-xs text-slate-400 mb-1">VS</div>
            {renderOpponent()}
          </div>
        </div>

        {/* Mobile-friendly action hint */}
        <div className="pt-2 border-t border-slate-600/30">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">
              Match scheduled and ready
            </span>
            <div className="flex items-center space-x-1 text-xs text-blue-300">
              <Calendar className="h-3 w-3" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
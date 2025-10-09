"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Calendar, MapPin, Clock, Target, X, CheckCircle, UserCheck, CalendarCheck, Info, Hand, MousePointer2, ChevronDown, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useUser } from "@/contexts/UserContext";
import { useAlert } from "@/contexts/AlertContext";
import Navigation from "@/components/Navigation";
import UserRestrictedGameSchedulingInterface from "@/components/UserRestrictedGameSchedulingInterface";
import RegistrationDeadlineCountdown from "@/components/RegistrationDeadlineCountdown";
import NextMatchCard from "@/components/NextMatchCard";
import { FormattedText } from "@/components/RichTextEditor";
import CompactMatchInfo from "@/components/CompactMatchInfo";
import { useState, useEffect } from "react";

// Helper function to format contest type for display
const formatContestType = (contestType: string): string => {
  switch (contestType) {
    case 'SINGLE_ELIMINATION':
      return 'Single Elimination';
    case 'SINGLE_ELIMINATION_1V1V1V1':
      return 'Single Elimination (4 Players)';
    case 'ROUND_ROBIN':
      return 'Round Robin (League)';
    case 'SCORING':
      return 'Scoring Contest';
    default:
      return contestType;
  }
};

// Function to get level color scheme
const getLevelColor = (level: string) => {
  const levelLower = level.toLowerCase();
  if (levelLower.includes('beginner') || levelLower.includes('basic')) {
    return {
      text: 'text-green-400',
      bg: 'bg-green-400/10',
      ring: 'ring-green-400/30'
    };
  } else if (levelLower.includes('intermediate') || levelLower.includes('medium')) {
    return {
      text: 'text-yellow-400',
      bg: 'bg-yellow-400/10',
      ring: 'ring-yellow-400/30'
    };
  } else if (levelLower.includes('advanced') || levelLower.includes('expert') || levelLower.includes('pro')) {
    return {
      text: 'text-red-400',
      bg: 'bg-red-400/10',
      ring: 'ring-red-400/30'
    };
  }
  // Default fallback
  return {
    text: 'text-slate-400',
    bg: 'bg-slate-400/10',
    ring: 'ring-slate-400/30'
  };
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

// Helper functions for game statistics
const getGameStatus = (game: any, event: Event): string => {
  const now = new Date();
  const registrationDeadline = event.registrationDeadline ? new Date(event.registrationDeadline) : null;
  
  // Check if registration deadline has passed
  if (registrationDeadline && now > registrationDeadline) {
    // Check if matches exist and are completed
    const totalMatches = game.matches?.length || 0;
    const completedMatches = game.matches?.filter((match: any) => match.winnerId).length || 0;
    
    if (totalMatches === 0) {
      return 'Scheduled';
    } else if (completedMatches === totalMatches && totalMatches > 0) {
      return 'Completed';
    } else {
      return 'In Progress';
    }
  }
  
  return 'Registration Open';
};

const getMatchProgress = (game: any): { completed: number; total: number } => {
  const totalMatches = game.matches?.length || 0;
  const completedMatches = game.matches?.filter((match: any) => match.winnerId).length || 0;
  return { completed: completedMatches, total: totalMatches };
};

const getTeamCount = (game: any): number => {
  return game.teams?.length || 0;
};

const getCapacityStatus = (game: any): { filled: number; total: number } => {
  const registrations = game.registrations?.length || 0;
  const slots = game.slots?.length || 0;
  const totalCapacity = slots > 0 ? game.slots.reduce((sum: number, slot: any) => sum + (slot.capacity || 2), 0) : registrations * 2;
  return { filled: registrations, total: Math.max(totalCapacity, registrations) };
};

const getOpenTeamSlots = (game: any, user: any): number => {
  if (!user) return 0;
  
  return game.teams?.filter((team: any) => {
    const isTeamAvailable = team.openTeam && (team.currentSize < team.requiredSize);
    const isUserAlreadyMember = team.members?.some((member: any) => member.user?.id === user.id);
    
    return isTeamAvailable && team.currentSize < team.requiredSize && !isUserAlreadyMember;
  }).length || 0;
};

const getMostActivePlayer = (game: any): string => {
  if (!game.registrations || game.registrations.length === 0) return 'None';
  
  // Count matches per player
  const playerMatchCount: { [key: string]: number } = {};
  
  game.matches?.forEach((match: any) => {
    if (match.participantAId) {
      playerMatchCount[match.participantAId] = (playerMatchCount[match.participantAId] || 0) + 1;
    }
    if (match.participantBId) {
      playerMatchCount[match.participantBId] = (playerMatchCount[match.participantBId] || 0) + 1;
    }
  });
  
  // Find player with most matches
  let maxMatches = 0;
  let mostActivePlayerId = '';
  
  Object.entries(playerMatchCount).forEach(([playerId, matchCount]) => {
    if (matchCount > maxMatches) {
      maxMatches = matchCount;
      mostActivePlayerId = playerId;
    }
  });
  
  // Find player name
  const player = game.registrations.find((reg: any) => reg.user.id === mostActivePlayerId);
  if (player && maxMatches > 0) {
    return `${player.user.firstName} ${player.user.lastName} (${maxMatches})`;
  }
  
  return 'None';
};

const getNextMatchTime = (game: any): string => {
  if (!game.slots || game.slots.length === 0) return 'None';
  
  const now = new Date();
  const upcomingSlots = game.slots
    .filter((slot: any) => new Date(slot.startTime) > now && slot.published)
    .sort((a: any, b: any) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  
  if (upcomingSlots.length > 0) {
    const nextSlot = upcomingSlots[0];
    const startTime = new Date(nextSlot.startTime);
    const today = new Date();
    const isToday = startTime.toDateString() === today.toDateString();
    
    if (isToday) {
      return `Today ${startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else {
      return startTime.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    }
  }
  
  return 'None';
};

// Helper function to get participant name from ID
const getParticipantName = (participantId: string, participantType: string, game: any): string => {
  if (participantId === 'TBD' || !participantId) return 'TBD';
  
  if (participantType === 'USER') {
    const registration = game.registrations?.find((reg: any) => reg.user.id === participantId);
    if (registration) {
      return `${registration.user.firstName} ${registration.user.lastName}`.trim();
    }
  } else if (participantType === 'TEAM') {
    const team = game.teams?.find((team: any) => team.id === participantId);
    if (team) {
      return team.name;
    }
  }
  
  return participantId; // Fallback to ID if name not found
};

// Helper function to get user-specific match times with participant info
const getUserMatchTimes = (game: any, currentUser: any): { nextMatch: string; allMatches: string[]; matchDetails: any[] } => {
  if (!game.matches || !currentUser) {
    return { nextMatch: 'None', allMatches: [], matchDetails: [] };
  }
  
  const now = new Date();
  const userMatches = game.matches.filter((match: any) => {
    // Check if user is a participant in this match
    if (match.participantAId === currentUser.id || match.participantBId === currentUser.id) {
      return true;
    }
    
    // Check for team matches - need to check if user is in a team that's participating
    if (match.participantAType === 'TEAM' || match.participantBType === 'TEAM') {
      const userRegistration = game.registrations?.find((reg: any) => reg.user.id === currentUser.id);
      if (userRegistration && userRegistration.team) {
        if (match.participantAId === userRegistration.team.id || match.participantBId === userRegistration.team.id) {
          return true;
        }
      }
    }
    
    // Check for 4-player matches
    if (match.participantAType === 'FOUR_PARTICIPANT_DATA' || match.participantBType === 'FOUR_PARTICIPANT_DATA') {
      try {
        if (match.participantAId && match.participantAId !== 'TBD') {
          const participantAData = JSON.parse(match.participantAId);
          if (participantAData.participant1Id === currentUser.id || participantAData.participant2Id === currentUser.id) {
            return true;
          }
        }
        if (match.participantBId && match.participantBId !== 'TBD') {
          const participantBData = JSON.parse(match.participantBId);
          if (participantBData.participant3Id === currentUser.id || participantBData.participant4Id === currentUser.id) {
            return true;
          }
        }
      } catch (e) {
        // Ignore parsing errors
      }
    }
    
    return false;
  });
  
  // Process matches to get detailed info
  const matchDetails = userMatches.map((match: any) => {
    const isCompleted = !!match.winnerId;
    const isWinner = match.winnerId === currentUser.id;
    let participants = [];
    
    if (match.participantAType === 'FOUR_PARTICIPANT_DATA' || match.participantBType === 'FOUR_PARTICIPANT_DATA') {
      // Handle 4-player matches
      try {
        const participantAData = match.participantAId !== 'TBD' ? JSON.parse(match.participantAId) : {};
        const participantBData = match.participantBId !== 'TBD' ? JSON.parse(match.participantBId) : {};
        
        participants = [
          getParticipantName(participantAData.participant1Id, participantAData.participant1Type, game),
          getParticipantName(participantAData.participant2Id, participantAData.participant2Type, game),
          getParticipantName(participantBData.participant3Id, participantBData.participant3Type, game),
          getParticipantName(participantBData.participant4Id, participantBData.participant4Type, game)
        ].filter(name => name && name !== 'TBD');
      } catch (e) {
        participants = ['4-Player Match'];
      }
    } else {
      // Handle 2-player matches
      const participantA = getParticipantName(match.participantAId, match.participantAType, game);
      const participantB = getParticipantName(match.participantBId, match.participantBType, game);
      participants = [participantA, participantB].filter(name => name && name !== 'TBD');
    }
    
    return {
      ...match,
      isCompleted,
      isWinner,
      participants
    };
  });
  
  // Filter for upcoming matches with published slots
  const upcomingMatches = matchDetails
    .filter((match: any) => match.slot && match.slot.published && new Date(match.slot.startTime) > now)
    .sort((a: any, b: any) => new Date(a.slot.startTime).getTime() - new Date(b.slot.startTime).getTime());
  
  const formatMatchInfo = (match: any): string => {
    const startTime = new Date(match.slot.startTime);
    const today = new Date();
    const isToday = startTime.toDateString() === today.toDateString();
    
    const timeStr = isToday
      ? `Today ${startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
      : startTime.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    
    const participantsStr = match.participants.length > 0
      ? match.participants.join(' vs ')
      : 'Match scheduled';
    
    return `${timeStr}: ${participantsStr}`;
  };
  
  const allMatchTimes = upcomingMatches.map(formatMatchInfo);
  const nextMatch = allMatchTimes.length > 0 ? allMatchTimes[0] : 'None';
  
  return { nextMatch, allMatches: allMatchTimes, matchDetails: upcomingMatches };
};


interface Event {
  id: string;
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  timeWindow: string;
  location: string;
  locationUrl?: string;
  participantCap: number;
  registrationDeadline?: string | null;
  games: {
    id: string;
    name: string;
    description?: string;
    format: string;
    level: string[];
    contestType: string;
    weightage: number;
    avgGameTime: number;
    allowDraws: boolean;
    registrations?: any[];
    matches?: any[];
    teams?: any[];
    slots?: any[];
  }[];
}

interface ContestRules {
  title: string;
  description: string;
  rules: string[];
  gameDescription?: string;
}


export default function EventsPage() {
  const { user: currentUser, apiCall } = useUser();
  const { showSuccess, showError, showWarning, showInfo } = useAlert();
  
  // Debug current user
  console.log('EventsPage - Current user:', currentUser);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
    const [showRegistrationModal, setShowRegistrationModal] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [registrations, setRegistrations] = useState<{[gameId: string]: {level: string, mode: string, teamName?: string, teamMembers?: string[], openTeam?: boolean}}>({});
  const [submitting, setSubmitting] = useState(false);
  const [userRegistrations, setUserRegistrations] = useState<{[gameName: string]: {level: string, mode: string, teamName?: string, teamMembers?: {id: string, name: string, email: string, isTeamLead?: boolean}[], isTeamLead?: boolean, openTeam?: boolean}}>({});
  const [users, setUsers] = useState<{id: string, name: string, email: string}[]>([]);
  const [userSearch, setUserSearch] = useState<{[gameId: string]: string}>({});
  const [isEditingRegistration, setIsEditingRegistration] = useState(false);
  const [openTeams, setOpenTeams] = useState<{[gameId: string]: any[]}>({});
  const [loadingOpenTeams, setLoadingOpenTeams] = useState<{[gameId: string]: boolean}>({});
  const [showUserScheduling, setShowUserScheduling] = useState(false);
  const [selectedGameForScheduling, setSelectedGameForScheduling] = useState<any>(null);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [selectedContestRules, setSelectedContestRules] = useState<ContestRules | null>(null);
  const [gameMatchData, setGameMatchData] = useState<{[gameId: string]: any}>({});
  const [matchDataLoaded, setMatchDataLoaded] = useState<{[gameId: string]: boolean}>({});
  const [expandedGameInfo, setExpandedGameInfo] = useState<{[gameId: string]: boolean}>({});

  useEffect(() => {
    const fetchEventsAndMatchData = async () => {
      try {
        // Add cache-busting parameter to ensure fresh data
        const timestamp = new Date().getTime();
        const response = await fetch(`/api/events?t=${timestamp}`, {
          cache: 'no-cache',
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        });
        if (!response.ok) {
          throw new Error('Failed to fetch events');
        }
        const eventsData = await response.json();
        setEvents(eventsData);
        
        // Fetch match data for all games if user is logged in
        if (currentUser) {
          const allGames = eventsData.flatMap((event: any) => event.games);
          const matchDataPromises = allGames.map(async (game: any) => {
            try {
              const matchResponse = await apiCall(`/api/games/${game.id}/user-match-info`);
              if (matchResponse.ok) {
                const matchData = await matchResponse.json();
                return { gameId: game.id, matchData };
              }
            } catch (error) {
              // Silently handle errors
            }
            return { gameId: game.id, matchData: null };
          });
          
          const matchResults = await Promise.all(matchDataPromises);
          const matchDataMap: {[gameId: string]: any} = {};
          const loadedMap: {[gameId: string]: boolean} = {};
          
          matchResults.forEach(result => {
            if (result.matchData) {
              matchDataMap[result.gameId] = result.matchData;
            }
            loadedMap[result.gameId] = true;
          });
          
          setGameMatchData(matchDataMap);
          setMatchDataLoaded(loadedMap);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchEventsAndMatchData();
  }, [currentUser, apiCall]); // Add currentUser dependency to fetch match data when user is available

  useEffect(() => {
    const fetchUserRegistrations = async () => {
      if (!currentUser) return;
      
      try {
        const response = await apiCall('/api/registrations');
        if (response.ok) {
          const registrations = await response.json();
          const registrationMap = registrations.reduce((acc: any, reg: any) => {
            acc[reg.game.name] = {
              level: reg.level,
              mode: reg.mode,
              teamName: reg.teamName || '',
              teamMembers: reg.teamMembers || [],
              isTeamLead: reg.isTeamLead || false,
              openTeam: reg.openTeam || false
            };
            return acc;
          }, {});
          setUserRegistrations(registrationMap);
        }
      } catch (error) {
        console.error('Failed to fetch user registrations:', error);
      }
    };

    fetchUserRegistrations();
  }, [currentUser, apiCall]);

  useEffect(() => {
    const fetchUsers = async () => {
      if (!currentUser) return;
      
      try {
        // Fetch users for team registration modal (now available to all authenticated users)
        const response = await apiCall('/api/users');
        if (response.ok) {
          const usersData = await response.json();
          setUsers(usersData);
        }
      } catch (error) {
        console.error('Failed to fetch users:', error);
      }
    };

    fetchUsers();
  }, [currentUser, apiCall]);

  // Helper function to determine if registration editing should be disabled
  const isRegistrationEditingDisabled = (game: any, gameName: string) => {
    if (!isEditingRegistration || !userRegistrations[gameName]) {
      return false; // Not editing or no existing registration
    }
    
    const userRegistration = userRegistrations[gameName];
    
    // Allow editing for 1v1 games (always individual)
    if (game.format === '1v1') {
      return false;
    }
    
    // Allow editing for individual registrations (even in team games)
    if (userRegistration.mode === 'INDIVIDUAL') {
      return false;
    }
    
    // For team registrations, only allow team leaders to edit
    if (userRegistration.mode === 'TEAM') {
      return !userRegistration.isTeamLead;
    }
    
    return false;
  };


  const isRegistrationDeadlinePassed = (deadline: string | null | undefined): boolean => {
    if (!deadline) return false;
    return new Date(deadline).getTime() <= new Date().getTime();
  };

  const handleGameClick = async (event: Event, game: { id: string; name: string; description?: string; format: string; level: string[]; contestType: string; weightage: number; avgGameTime: number; allowDraws: boolean; registrations?: any[]; matches?: any[]; teams?: any[]; slots?: any[] }) => {
      if (!currentUser) {
        showWarning('Please log in to register for games');
        return;
      }
  
      // Check registration deadline
      if (isRegistrationDeadlinePassed(event.registrationDeadline)) {
        showError('Registration deadline has passed for this event');
        return;
      }
      
      const isRegistered = userRegistrations[game.name];
  
      if (isRegistered) {
        // Handle editing existing registration - open modal with current data (no rules modal)
        setSelectedEvent(event);
        setIsEditingRegistration(true);
        setRegistrations({
          [game.name]: {
            level: isRegistered.level,
            mode: isRegistered.mode,
            teamName: isRegistered.teamName || '',
            teamMembers: isRegistered.teamMembers?.map(member => member.id) || [],
            openTeam: isRegistered.openTeam || false
          }
        });
        setShowRegistrationModal(true);
      } else {
        // Handle new registration - show contest rules modal first
        showRules(game.contestType, game.description || '');
        
        // Check participation cap (skip check if unlimited)
        const userRegisteredCount = event.games.filter(g => userRegistrations[g.name]).length;
        if (event.participantCap !== 2147483647 && userRegisteredCount >= event.participantCap) {
          showWarning(`You have reached the participation limit of ${event.participantCap} games for this event`);
          return;
        }
  
        // Set up single game registration
        setSelectedEvent(event);
        setIsEditingRegistration(false);
        setRegistrations({
          [game.name]: {
            level: game.level[0], // Default to first available level
            mode: 'INDIVIDUAL',    // Default to individual mode
            teamName: '',
            teamMembers: []
          }
        });
        setShowRegistrationModal(true);
      }
    };

  const handleRegistrationChange = (gameId: string, field: 'level' | 'mode' | 'teamName' | 'openTeam', value: string | boolean) => {
      setRegistrations(prev => ({
        ...prev,
        [gameId]: {
          ...prev[gameId],
          [field]: value,
          level: field === 'level' ? value as string : prev[gameId]?.level || '',
          mode: field === 'mode' ? value as string : prev[gameId]?.mode || 'INDIVIDUAL',
          teamName: field === 'teamName' ? value as string : prev[gameId]?.teamName || '',
          teamMembers: field === 'mode' && value === 'INDIVIDUAL' ? [] : prev[gameId]?.teamMembers || [],
          openTeam: field === 'openTeam' ? value as boolean : prev[gameId]?.openTeam || false
        }
      }));
      
      // If mode is changed to INDIVIDUAL for a team-based game, fetch open teams
      if (field === 'mode' && value === 'INDIVIDUAL') {
        const game = selectedEvent?.games.find(g => g.name === gameId);
        if (game && game.format !== '1v1' && game.format !== 'Individual') {
          // Find the actual game ID from the games array
          const gameData = selectedEvent?.games.find(g => g.name === gameId);
          if (gameData?.id) {
            fetchOpenTeams(gameData.id);
          }
        }
      }
    };

  const handleTeamMemberAdd = (gameId: string, userId: string) => {
    const game = selectedEvent?.games.find(g => g.name === gameId);
    if (!game) return;
    
    const teamSize = parseInt(game.format.split('v')[0]);
    
    setRegistrations(prev => {
      const currentMembers = prev[gameId]?.teamMembers || [];
      if (currentMembers.length >= teamSize - 1) return prev; // -1 because user is already included
      if (currentMembers.includes(userId)) return prev;
      
      return {
        ...prev,
        [gameId]: {
          ...prev[gameId],
          teamMembers: [...currentMembers, userId]
        }
      };
    });
    
    setUserSearch(prev => ({ ...prev, [gameId]: '' }));
  };

  const handleTeamMemberRemove = (gameId: string, userId: string) => {
    setRegistrations(prev => ({
      ...prev,
      [gameId]: {
        ...prev[gameId],
        teamMembers: prev[gameId]?.teamMembers?.filter(id => id !== userId) || []
      }
    }));
  };

  const getFilteredUsers = (gameId: string) => {
    const search = userSearch[gameId] || '';
    const selectedMembers = registrations[gameId]?.teamMembers || [];
    
    return users.filter(user =>
      !selectedMembers.includes(user.id) &&
      ((user.name?.toLowerCase().includes(search.toLowerCase()) || false) ||
       (user.email?.toLowerCase().includes(search.toLowerCase()) || false))
    );
  };

  const handleUnregister = async () => {
    if (!selectedEvent) return;
    
    const selectedGames = Object.entries(registrations).filter(([_, reg]) => reg.level);
    if (selectedGames.length === 0) return;
    
    const gameName = selectedGames[0][0]; // Get the first (and should be only) game
    
    const confirmUnregister = window.confirm(`Are you sure you want to unregister from ${gameName}?`);
    if (!confirmUnregister) return;

    try {
      const response = await apiCall(`/api/registrations?gameName=${encodeURIComponent(gameName)}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        showSuccess(`Successfully unregistered from ${gameName}`, 'Unregistration Successful');
        
        setShowRegistrationModal(false);
        setSelectedEvent(null);
        setRegistrations({});
        setIsEditingRegistration(false);
        
        // Refresh user registrations
        const registrationsResponse = await apiCall('/api/registrations');
        if (registrationsResponse.ok) {
          const registrations = await registrationsResponse.json();
          const registrationMap = registrations.reduce((acc: any, reg: any) => {
            acc[reg.game.name] = {
              level: reg.level,
              mode: reg.mode,
              teamName: reg.teamName || '',
              teamMembers: reg.teamMembers || [],
              isTeamLead: reg.isTeamLead || false
            };
            return acc;
          }, {});
          setUserRegistrations(registrationMap);
        }
      } else {
        const errorData = await response.json();
        showError(errorData.error || 'Failed to unregister. Please try again.');
      }
    } catch (error) {
      console.error('Unregistration error:', error);
      showError('Failed to unregister. Please try again.');
    }
  };

  // Fetch open teams for a specific game
  const fetchOpenTeams = async (gameId: string) => {
    if (!currentUser) return;
    
    setLoadingOpenTeams(prev => ({ ...prev, [gameId]: true }));
    
    try {
      // Add cache-busting parameter to ensure fresh data
      const timestamp = new Date().getTime();
      const response = await apiCall(`/api/games/${gameId}/open-teams?t=${timestamp}`, {
        cache: 'no-cache',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      if (response.ok) {
        const data = await response.json();
        setOpenTeams(prev => ({ ...prev, [gameId]: data.openTeams }));
      } else {
        console.error('Failed to fetch open teams');
        setOpenTeams(prev => ({ ...prev, [gameId]: [] }));
      }
    } catch (error) {
      console.error('Error fetching open teams:', error);
      setOpenTeams(prev => ({ ...prev, [gameId]: [] }));
    } finally {
      setLoadingOpenTeams(prev => ({ ...prev, [gameId]: false }));
    }
  };

  // Handle joining an open team
  const handleJoinTeam = async (teamId: string, teamName: string, gameId: string) => {
    if (!currentUser) return;
    
    try {
      const response = await apiCall(`/api/teams/${teamId}/join`, {
        method: 'POST'
      });
      
      if (response.ok) {
        showSuccess(`Successfully joined team "${teamName}"!`, 'Team Joined');
        
        // Close the registration modal and refresh
        setShowRegistrationModal(false);
        setSelectedEvent(null);
        setRegistrations({});
        
        // Refresh user registrations
        const registrationsResponse = await apiCall('/api/registrations');
        if (registrationsResponse.ok) {
          const registrations = await registrationsResponse.json();
          const registrationMap = registrations.reduce((acc: any, reg: any) => {
            acc[reg.game.name] = {
              level: reg.level,
              mode: reg.mode,
              teamName: reg.teamName || '',
              teamMembers: reg.teamMembers || [],
              isTeamLead: reg.isTeamLead || false
            };
            return acc;
          }, {});
          setUserRegistrations(registrationMap);
        }
      } else {
        const errorData = await response.json();
        showError(errorData.error || 'Failed to join team. Please try again.');
      }
    } catch (error) {
      console.error('Error joining team:', error);
      showError('Failed to join team. Please try again.');
    }
  };

  const handleSubmitRegistrations = async () => {
    if (!currentUser || !selectedEvent) return;

    const selectedGames = Object.entries(registrations).filter(([_, reg]) => reg.level);
    
    if (selectedGames.length === 0) {
      showWarning('Please select at least one game to register for');
      return;
    }

    // Check permissions for editing registrations
    if (isEditingRegistration) {
      for (const [gameName, _] of selectedGames) {
        const game = selectedEvent.games.find(g => g.name === gameName);
        if (game && isRegistrationEditingDisabled(game, gameName)) {
          const currentGameRegistration = userRegistrations[gameName];
          if (currentGameRegistration?.mode === 'TEAM') {
            showError('Only team leaders can modify team registration details. You can only unregister from games.', 'Permission Denied');
          } else {
            showError('Cannot modify this registration. You can only unregister from games.', 'Permission Denied');
          }
          return;
        }
      }
    }

    // Validate team names for team registrations
    for (const [gameName, registration] of selectedGames) {
      if (registration.mode === 'TEAM' && (!registration.teamName || registration.teamName.trim() === '')) {
        showWarning(`Please enter a team name for ${gameName}`);
        return;
      }
    }

    // Check for duplicate team names within the same game
    for (const [gameName, registration] of selectedGames) {
      if (registration.mode === 'TEAM' && registration.teamName) {
        const gameId = selectedEvent.games.find(g => g.name === gameName)?.id;
        if (gameId) {
          try {
            // Check if team name already exists for this game
            const response = await apiCall(`/api/games/${gameId}/teams?teamName=${encodeURIComponent(registration.teamName.trim())}`);
            if (response.ok) {
              const data = await response.json();
              if (data.exists) {
                showError(`Team name "${registration.teamName}" already exists for ${gameName}. Please choose a different name.`, 'Duplicate Team Name');
                return;
              }
            }
          } catch (error) {
            console.error('Error checking team name:', error);
            // Continue with registration if check fails - backend will handle validation
          }
        }
      }
    }

    // Check participation cap (skip check if unlimited) - only for new registrations
    if (!isEditingRegistration && selectedEvent.participantCap !== 2147483647 && selectedGames.length > selectedEvent.participantCap) {
      showWarning(`You can only register for ${selectedEvent.participantCap} games per event`);
      return;
    }

    setSubmitting(true);
    try {
      const registrationData = selectedGames.map(([gameName, registration]) => {
        // For team registrations, include current user in teamMembers array when sending to backend
        let teamMembers = registration.teamMembers || [];
        if (registration.mode === 'TEAM' && currentUser && !teamMembers.includes(currentUser.id)) {
          teamMembers = [currentUser.id, ...teamMembers];
        }
        
        return {
          gameName,
          level: registration.level,
          mode: registration.mode,
          teamName: registration.teamName || '',
          teamMembers,
          openTeam: registration.openTeam || false
        };
      });

      // Use PUT for editing existing registration, POST for new registration
      const method = isEditingRegistration ? 'PUT' : 'POST';
      const response = await apiCall('/api/registrations', {
        method,
        body: JSON.stringify({
          registrations: registrationData,
          eventId: selectedEvent.id
        })
      });

      if (response.ok) {
        // Show success message
        const gameNames = selectedGames.map(([gameName]) => gameName);
        const message = isEditingRegistration
          ? `Successfully updated registration for ${gameNames.join(', ')}`
          : `Successfully registered for ${gameNames.join(', ')}!`;
        
        showSuccess(message, isEditingRegistration ? 'Registration Updated' : 'Registration Successful');
        
        setShowRegistrationModal(false);
        setSelectedEvent(null);
        setRegistrations({});
        setIsEditingRegistration(false);
                
                // Refresh user registrations to update card colors
                        const registrationsResponse = await apiCall('/api/registrations');
        if (registrationsResponse.ok) {
          const registrations = await registrationsResponse.json();
          const registrationMap = registrations.reduce((acc: any, reg: any) => {
            acc[reg.game.name] = {
              level: reg.level,
              mode: reg.mode,
              teamName: reg.teamName || '',
              teamMembers: reg.teamMembers || [],
              isTeamLead: reg.isTeamLead || false
            };
            return acc;
          }, {});
          setUserRegistrations(registrationMap);
        }
      } else {
        const errorData = await response.json();
        showError(errorData.error || `${isEditingRegistration ? 'Update' : 'Registration'} failed. Please try again.`);
      }
    } catch (error) {
      console.error('Registration error:', error);
      showError(`${isEditingRegistration ? 'Update' : 'Registration'} failed. Please try again.`);
    } finally {
      setSubmitting(false);
    }
  };


  const handleUserScheduling = (game: any) => {
    if (!currentUser) {
      showWarning('Please log in to schedule matches');
      return;
    }
    
    setSelectedGameForScheduling(game);
    setShowUserScheduling(true);
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

  const toggleGameInfo = (gameId: string) => {
    setExpandedGameInfo(prev => ({
      ...prev,
      [gameId]: !prev[gameId]
    }));
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
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <Navigation currentPage="events" />
        <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-white text-xl">Loading events...</div>
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <Navigation currentPage="events" />
        <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-red-400 text-xl">Error: {error}</div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <Navigation currentPage="events" />

      {/* Main Content */}
      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-8">
        <div className="mb-4 sm:mb-8">
          <h1 className="text-2xl sm:text-4xl font-bold text-white mb-2 sm:mb-4">Sports Week Events</h1>
          <p className="text-base sm:text-xl text-slate-300 max-w-3xl">
            Choose your battles! Register for individual games or form teams with your colleagues.
            Each category has a participation limit to ensure everyone gets a fair chance to compete.
          </p>
        </div>

        {/* Next Match Card - Only shows for logged in users with upcoming matches */}
        <NextMatchCard />

        {events.length === 0 ? (
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-8 text-center">
              <div className="text-slate-400 text-lg">No events available at the moment.</div>
              <p className="text-slate-500 mt-2">Check back later for upcoming sports events!</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:gap-8">
            {events.map((event) => (
              <Card key={event.id} className="bg-slate-800/50 border-slate-700">
                <CardHeader>
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-0">
                    <div>
                      <CardTitle className="text-white text-xl sm:text-2xl mb-1 sm:mb-2">{event.name}</CardTitle>
                      <CardDescription className="text-slate-300 text-base sm:text-lg">
                        {event.description}
                      </CardDescription>
                    </div>
                    <div className="text-left sm:text-right">
                      <div className="text-sm text-slate-400 mb-1">Participation Limit</div>
                      <div className="text-base sm:text-lg font-semibold text-blue-400 mb-2">
                        {event.participantCap === 2147483647 ? "No Limit" : `${event.participantCap} games per person`}
                      </div>
                      <Link href={`/events/${event.id}/schedule`}>
                        <Button
                          variant="default"
                          size="sm"
                          className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white border-0 shadow-lg hover:shadow-xl transition-all duration-200 font-medium"
                        >
                          <CalendarCheck className="w-4 h-4 mr-2" />
                          View Schedule
                        </Button>
                      </Link>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-6 mb-4 sm:mb-6">
                    <div className="flex items-center space-x-3">
                      <Calendar className="h-5 w-5 text-blue-400" />
                      <div>
                        <div className="text-sm text-slate-400">Date</div>
                        <div className="text-white">
                          {event.startDate === event.endDate
                            ? new Date(event.startDate).toLocaleDateString()
                            : `${new Date(event.startDate).toLocaleDateString()} - ${new Date(event.endDate).toLocaleDateString()}`
                          }
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <Clock className="h-5 w-5 text-green-400" />
                      <div>
                        <div className="text-sm text-slate-400">Time</div>
                        <div className="text-white">{event.timeWindow}</div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <MapPin className="h-5 w-5 text-purple-400" />
                      <div>
                        <div className="text-sm text-slate-400">Location</div>
                        {event.locationUrl ? (
                          <a
                            href={event.locationUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-white hover:text-blue-400 transition-colors cursor-pointer underline"
                          >
                            {event.location}
                          </a>
                        ) : (
                          <div className="text-white">{event.location}</div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Registration Deadline Countdown */}
                  {event.registrationDeadline && (
                    <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-slate-700/30 rounded-lg border border-slate-600">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-white font-medium mb-1">Registration Deadline</h4>
                          <p className="text-sm text-slate-400">Register before the deadline to participate</p>
                        </div>
                        <RegistrationDeadlineCountdown deadline={event.registrationDeadline} />
                      </div>
                    </div>
                  )}

                  {/* Available Games */}
                  <div className="mb-4 sm:mb-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-white flex items-center">
                        <Target className="h-5 w-5 mr-2 text-orange-400" />
                        Available Games
                      </h3>
                      <div className="flex items-center space-x-4 text-sm">
                        <div className="flex items-center space-x-2">
                          <div className="w-4 h-4 rounded bg-gradient-to-br from-slate-700/60 to-slate-800/60 border border-slate-600/30"></div>
                          <span className="text-slate-300">Individual</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <div className="w-4 h-4 rounded bg-gradient-to-br from-slate-600 to-slate-700 border border-slate-600"></div>
                          <span className="text-slate-300">Team</span>
                        </div>
                      </div>
                    </div>
                    {event.games.length === 0 ? (
                      <div className="text-center py-8 text-red-400">
                        <div className="text-lg font-semibold">No games available</div>
                        <p className="text-sm mt-1 text-red-300">This event currently has no games configured.</p>
                      </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                          {event.games
                            .filter(game => !userRegistrations[game.name])
                            .sort((a, b) => {
                              // Sort 1v1 games first, then team-based games
                              const aIs1v1 = a.format === '1v1' || a.contestType === 'SCORING';
                              const bIs1v1 = b.format === '1v1' || b.contestType === 'SCORING';
                              
                              if (aIs1v1 && !bIs1v1) return -1;
                              if (!aIs1v1 && bIs1v1) return 1;
                              return 0;
                            })
                            .map((game, index) => {
                            console.log('Rendering game:', game.name, 'Current user role:', currentUser?.role);
                            
                            // Determine if this is a team-based game
                            const isTeamGame = game.format !== '1v1' && game.contestType !== 'SCORING';
                            const cardColorScheme = isTeamGame
                              ? "bg-gradient-to-br from-slate-600 to-slate-700 hover:from-slate-500 hover:to-slate-600 hover:border-slate-400 border-2 border-slate-600 hover:shadow-xl hover:shadow-slate-500/20"
                              : "bg-gradient-to-br from-slate-700/60 to-slate-800/60 hover:from-slate-600/70 hover:to-slate-700/70 hover:border-blue-400/60 border-2 border-slate-600/30 hover:shadow-xl hover:shadow-blue-500/10";
                            
                            return (
                            <div
                              key={`available-${game.name}`}
                              className={`group rounded-xl p-3 sm:p-5 relative game-card-transition ${cardColorScheme} transition-all duration-300 backdrop-blur-sm`}
                              style={{
                                animation: `slideIn 0.5s ease-out ${index * 0.1}s both`
                              }}
                            >
                              <div
                                onClick={() => handleGameClick(event, game)}
                                className="cursor-pointer"
                              >
                                <div className="flex items-start justify-between mb-2 sm:mb-3">
                                  <h4 className="font-bold text-white text-base sm:text-lg group-hover:text-blue-100 transition-colors">{game.name}</h4>
                                  <div className="flex items-center space-x-2">
                                    <button
                                                                          onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            showRules(game.contestType, game.description);
                                                                          }}
                                                                          className="p-2 rounded-full bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 hover:text-blue-300 transition-all duration-200 hover:scale-110"
                                                                          title="View contest rules"
                                                                        >
                                                                          <Info className="h-5 w-5" />
                                                                        </button>
                                  </div>
                                </div>
                                
                                <div className="space-y-2 sm:space-y-3">
                                  <div className="flex items-center space-x-2">
                                    <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                                    <span className="text-xs sm:text-sm text-slate-300">Format:</span>
                                    <span className="text-xs sm:text-sm font-medium text-blue-400 bg-blue-400/10 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md">
                                      {game.contestType === 'SCORING' ? 'Individual' : game.format}
                                    </span>
                                  </div>
                                  
                                  <div className="flex items-center space-x-2">
                                    <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
                                    <span className="text-xs sm:text-sm text-slate-300">Contest:</span>
                                    <span className="text-sm font-medium text-purple-400 bg-purple-400/10 px-2 py-1 rounded-md">
                                      {formatContestType(game.contestType)}
                                    </span>
                                  </div>
                                  
                                  <div className="flex items-center space-x-2">
                                    <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                                    <span className="text-xs sm:text-sm text-slate-300">Participants:</span>
                                    <span className="text-sm font-medium text-green-400 bg-green-400/10 px-2 py-1 rounded-md">
                                      {game.registrations?.length || 0}
                                    </span>
                                  </div>
                                  
                                  <div className="flex items-center space-x-2">
                                    <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
                                    <span className="text-xs sm:text-sm text-slate-300">Weightage:</span>
                                    <span className="text-sm font-medium text-yellow-400 bg-yellow-400/10 px-2 py-1 rounded-md">
                                      {game.weightage} pts
                                    </span>
                                  </div>
                                  
                                  <div className="flex items-center space-x-2">
                                    <div className="w-2 h-2 bg-orange-400 rounded-full"></div>
                                    <span className="text-xs sm:text-sm text-slate-300">Avg Time:</span>
                                    <span className="text-sm font-medium text-orange-400 bg-orange-400/10 px-2 py-1 rounded-md">
                                      {game.avgGameTime} min
                                    </span>
                                  </div>
                                  
                                  {(() => {
                                    const matchProgress = getMatchProgress(game);
                                    return matchProgress.total > 0 && (
                                      <div className="flex items-center space-x-2">
                                        <div className="w-2 h-2 bg-indigo-400 rounded-full"></div>
                                        <span className="text-xs sm:text-sm text-slate-300">Progress:</span>
                                        <span className="text-sm font-medium text-indigo-400 bg-indigo-400/10 px-2 py-1 rounded-md">
                                          {matchProgress.completed}/{matchProgress.total} matches
                                        </span>
                                      </div>
                                    );
                                  })()}
                                  
                                  {(() => {
                                    const teamCount = getTeamCount(game);
                                    const isTeamGame = parseInt(game.format.split('v')[0]) > 1;
                                    return isTeamGame && teamCount > 0 && (
                                      <div className="flex items-center space-x-2">
                                        <div className="w-2 h-2 bg-pink-400 rounded-full"></div>
                                        <span className="text-xs sm:text-sm text-slate-300">Teams:</span>
                                        <span className="text-sm font-medium text-pink-400 bg-pink-400/10 px-2 py-1 rounded-md">
                                          {teamCount} teams
                                        </span>
                                      </div>
                                    );
                                  })()}
                                  
                                  {(() => {
                                    const nextMatch = getNextMatchTime(game);
                                    return nextMatch !== 'None' && (
                                      <div className="flex items-center space-x-2">
                                        <div className="w-2 h-2 bg-cyan-400 rounded-full"></div>
                                        <span className="text-xs sm:text-sm text-slate-300">Next Match:</span>
                                        <span className="text-sm font-medium text-cyan-400 bg-cyan-400/10 px-2 py-1 rounded-md">
                                          {nextMatch}
                                        </span>
                                      </div>
                                    );
                                  })()}
                                  
                                  
                                  {(() => {
                                    const openTeamSlots = getOpenTeamSlots(game, currentUser);
                                    return openTeamSlots > 0 && (
                                      <div className="flex items-center space-x-2">
                                        <div className="w-2 h-2 bg-teal-400 rounded-full"></div>
                                        <span className="text-xs sm:text-sm text-slate-300">Open Teams:</span>
                                        <span className="text-sm font-medium text-teal-400 bg-teal-400/10 px-2 py-1 rounded-md">
                                          {openTeamSlots} looking for players
                                        </span>
                                      </div>
                                    );
                                  })()}
                                  
                                  {(() => {
                                    const mostActive = getMostActivePlayer(game);
                                    return mostActive !== 'None' && (
                                      <div className="flex items-center space-x-2">
                                        <div className="w-2 h-2 bg-amber-400 rounded-full"></div>
                                        <span className="text-xs sm:text-sm text-slate-300">Most Active:</span>
                                        <span className="text-sm font-medium text-amber-400 bg-amber-400/10 px-2 py-1 rounded-md">
                                          {mostActive}
                                        </span>
                                      </div>
                                    );
                                  })()}
                                </div>
                                
                                {/* Game Description - removed as per task requirements */}
                                
                                <div className="mt-4 pt-3 border-t border-slate-600/50">
                                  <Button
                                    size="sm"
                                    className="codeninja-gradient text-white hover:opacity-90 w-full"
                                  >
                                    <Target className="h-4 w-4 mr-2" />
                                    Register
                                  </Button>
                                </div>
                              </div>
                            </div>
                          );
                          })}
                        </div>
                        {event.games.length > 0 && event.games.filter(game => !userRegistrations[game.name]).length === 0 && (
                          <div className="text-center py-8 text-slate-400">
                            <div className="text-lg">All games registered!</div>
                            <p className="text-sm mt-1">You've registered for all available games in this event.</p>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* Registered Games */}
                  {event.games.filter(game => userRegistrations[game.name]).length > 0 && (
                    <div className="mb-4 sm:mb-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-white flex items-center">
                          <UserCheck className="h-5 w-5 mr-2 text-green-400" />
                          Registered Games ({event.games.filter(game => userRegistrations[game.name]).length})
                        </h3>
                        <div className="flex items-center space-x-4 text-sm">
                          <div className="flex items-center space-x-2">
                            <div className="w-4 h-4 rounded bg-gradient-to-br from-green-900/40 to-green-800/40 border border-green-500/50"></div>
                            <span className="text-slate-300">Individual</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <div className="w-4 h-4 rounded bg-gradient-to-br from-green-800 to-green-900 border border-green-600"></div>
                            <span className="text-slate-300">Team</span>
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                        {event.games
                          .filter(game => userRegistrations[game.name])
                          .sort((a, b) => {
                            // Use cached match data for more reliable sorting
                            const aMatchData = gameMatchData[a.id];
                            const bMatchData = gameMatchData[b.id];
                            
                            const aHasUpcoming = aMatchData?.nextMatch && aMatchData.nextMatch !== 'None';
                            const bHasUpcoming = bMatchData?.nextMatch && bMatchData.nextMatch !== 'None';
                            
                            // Games with upcoming matches come first
                            if (aHasUpcoming && !bHasUpcoming) {
                              return -1;
                            }
                            if (!aHasUpcoming && bHasUpcoming) {
                              return 1;
                            }
                            
                            // If both have upcoming matches, sort by earliest match time
                            if (aHasUpcoming && bHasUpcoming && aMatchData?.matches && bMatchData?.matches) {
                              // Find the earliest upcoming match for each game
                              const now = new Date();
                              const aUpcoming = aMatchData.matches
                                .filter((m: any) => m.slot && new Date(m.slot.startTime) > now && !m.isCompleted)
                                .sort((x: any, y: any) => new Date(x.slot.startTime).getTime() - new Date(y.slot.startTime).getTime());
                              
                              const bUpcoming = bMatchData.matches
                                .filter((m: any) => m.slot && new Date(m.slot.startTime) > now && !m.isCompleted)
                                .sort((x: any, y: any) => new Date(x.slot.startTime).getTime() - new Date(y.slot.startTime).getTime());
                              
                              if (aUpcoming.length > 0 && bUpcoming.length > 0) {
                                const aNextTime = new Date(aUpcoming[0].slot.startTime);
                                const bNextTime = new Date(bUpcoming[0].slot.startTime);
                                const result = aNextTime.getTime() - bNextTime.getTime();
                                return result;
                              }
                            }
                            
                            // If neither has upcoming matches, sort by format (1v1 first)
                            const aIs1v1 = a.format === '1v1' || a.contestType === 'SCORING';
                            const bIs1v1 = b.format === '1v1' || b.contestType === 'SCORING';
                            if (aIs1v1 && !bIs1v1) return -1;
                            if (!aIs1v1 && bIs1v1) return 1;
                            return 0;
                          })
                          .map((game, index) => {
                          const userRegistration = userRegistrations[game.name];
                          
                          // Determine if this is a team-based game
                          const isTeamGame = game.format !== '1v1' && game.contestType !== 'SCORING';
                          const cardColorScheme = isTeamGame
                            ? "bg-gradient-to-br from-green-800 to-green-900 border-2 border-green-600 hover:from-green-700 hover:to-green-800 hover:border-green-500 hover:shadow-xl hover:shadow-green-600/20"
                            : "bg-gradient-to-br from-green-900/40 to-green-800/40 border-2 border-green-500/50 hover:from-green-800/50 hover:to-green-700/50 hover:border-green-400/70 hover:shadow-xl hover:shadow-green-500/10";
                          
                          return (
                            <div
                              key={`registered-${game.name}`}
                              className={`group rounded-xl p-3 sm:p-5 relative game-card-transition ${cardColorScheme} transition-all duration-300 backdrop-blur-sm`}
                              style={{
                                animation: `slideInFromTop 0.6s ease-out ${index * 0.1}s both`
                              }}
                            >
                              <div className="absolute top-3 right-3 flex space-x-2">
                                <div className="p-1.5 bg-green-500/20 rounded-full">
                                  <CheckCircle className="h-4 w-4 text-green-400" />
                                </div>
                                <div className="p-1.5 bg-slate-500/20 rounded-full">
                                  <MousePointer2 className="h-4 w-4 text-slate-400" />
                                </div>
                                <button
                                                                  onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    showRules(game.contestType, game.description);
                                                                  }}
                                                                  className="p-2 rounded-full bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 hover:text-blue-300 transition-all duration-200 hover:scale-110"
                                                                  title="View contest rules"
                                                                >
                                                                  <Info className="h-5 w-5" />
                                                                </button>
                              </div>
                              
                              <div
                                onClick={() => handleGameClick(event, game)}
                                className="cursor-pointer"
                              >
                                <h4 className="font-bold text-white text-lg mb-3 pr-20 group-hover:text-green-100 transition-colors">{game.name}</h4>
                                
                                {/* Match Info Section - Above format */}
                                <div className="mb-3">
                                  <CompactMatchInfo
                                    gameId={game.id}
                                    contestType={game.contestType}
                                    className="w-full"
                                    preloadedMatchData={gameMatchData[game.id]}
                                  />
                                </div>
                                
                                {/* Collapsible Game Info Section */}
                                <div className="mb-3">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleGameInfo(game.id);
                                    }}
                                    className="flex items-center space-x-2 text-slate-300 hover:text-white transition-colors w-full text-left"
                                  >
                                    {expandedGameInfo[game.id] ? (
                                      <ChevronDown className="h-4 w-4" />
                                    ) : (
                                      <ChevronRight className="h-4 w-4" />
                                    )}
                                    <span className="text-sm font-medium">Game Info</span>
                                  </button>
                                  
                                  {expandedGameInfo[game.id] && (
                                    <div className="mt-2 space-y-2 sm:space-y-3 pl-6">
                                      <div className="flex items-center space-x-2">
                                        <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                                        <span className="text-xs sm:text-sm text-slate-300">Format:</span>
                                        <span className="text-xs sm:text-sm font-medium text-blue-400 bg-blue-400/10 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md">
                                          {game.contestType === 'SCORING' ? 'Individual' : game.format}
                                        </span>
                                      </div>
                                      
                                      <div className="flex items-center space-x-2">
                                        <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                                        <span className="text-xs sm:text-sm text-slate-300">Participants:</span>
                                        <span className="text-sm font-medium text-green-400 bg-green-400/10 px-2 py-1 rounded-md">
                                          {game.registrations?.length || 0}
                                        </span>
                                      </div>
                                      
                                      <div className="flex items-center space-x-2">
                                        <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
                                        <span className="text-xs sm:text-sm text-slate-300">Weightage:</span>
                                        <span className="text-sm font-medium text-yellow-400 bg-yellow-400/10 px-2 py-1 rounded-md">
                                          {game.weightage} pts
                                        </span>
                                      </div>
                                      
                                      <div className="flex items-center space-x-2">
                                        <div className="w-2 h-2 bg-orange-400 rounded-full"></div>
                                        <span className="text-xs sm:text-sm text-slate-300">Avg Time:</span>
                                        <span className="text-sm font-medium text-orange-400 bg-orange-400/10 px-2 py-1 rounded-md">
                                          {game.avgGameTime} min
                                        </span>
                                      </div>
                                      
                                      {(() => {
                                        const matchProgress = getMatchProgress(game);
                                        return matchProgress.total > 0 && (
                                          <div className="flex items-center space-x-2">
                                            <div className="w-2 h-2 bg-indigo-400 rounded-full"></div>
                                            <span className="text-xs sm:text-sm text-slate-300">Progress:</span>
                                            <span className="text-sm font-medium text-indigo-400 bg-indigo-400/10 px-2 py-1 rounded-md">
                                              {matchProgress.completed}/{matchProgress.total} matches
                                            </span>
                                          </div>
                                        );
                                      })()}
                                      
                                      {(() => {
                                        const teamCount = getTeamCount(game);
                                        const isTeamGame = parseInt(game.format.split('v')[0]) > 1;
                                        return isTeamGame && teamCount > 0 && (
                                          <div className="flex items-center space-x-2">
                                            <div className="w-2 h-2 bg-pink-400 rounded-full"></div>
                                            <span className="text-xs sm:text-sm text-slate-300">Teams:</span>
                                            <span className="text-sm font-medium text-pink-400 bg-pink-400/10 px-2 py-1 rounded-md">
                                              {teamCount} teams
                                            </span>
                                          </div>
                                        );
                                      })()}
                                      
                                      {(() => {
                                        const openTeamSlots = getOpenTeamSlots(game, currentUser);
                                        return openTeamSlots > 0 && (
                                          <div className="flex items-center space-x-2">
                                            <div className="w-2 h-2 bg-teal-400 rounded-full"></div>
                                            <span className="text-xs sm:text-sm text-slate-300">Open Teams:</span>
                                            <span className="text-sm font-medium text-teal-400 bg-teal-400/10 px-2 py-1 rounded-md">
                                              {openTeamSlots} looking for players
                                            </span>
                                          </div>
                                        );
                                      })()}
                                      
                                      {(() => {
                                        const mostActive = getMostActivePlayer(game);
                                        return mostActive !== 'None' && (
                                          <div className="flex items-center space-x-2">
                                            <div className="w-2 h-2 bg-amber-400 rounded-full"></div>
                                            <span className="text-xs sm:text-sm text-slate-300">Most Active:</span>
                                            <span className="text-sm font-medium text-amber-400 bg-amber-400/10 px-2 py-1 rounded-md">
                                              {mostActive}
                                            </span>
                                          </div>
                                        );
                                      })()}
                                    </div>
                                  )}
                                </div>
                                
                                {/* Game Description - removed as per task requirements */}
                                
                                <div className="mt-4 pt-3 border-t border-green-500/30">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-2">
                                      <CheckCircle className="h-4 w-4 text-green-400" />
                                      <span className="text-sm font-medium text-green-400">
                                        Registered ({userRegistration.mode})
                                      </span>
                                    </div>
                                  </div>
                                  
                                </div>
                              </div>
                              
                              {/* Schedule Button - Only show if registration deadline hasn't passed and team conditions are met */}
                              {(() => {
                                // Check if this is a team game based on format
                                const playersPerSide = parseInt(game.format.split('v')[0]);
                                const isTeamGame = playersPerSide > 1;
                                const isTeamRegistration = userRegistration.mode === 'TEAM';
                                const isIndividualInTeamGame = isTeamGame && userRegistration.mode === 'INDIVIDUAL';
                                
                                // For team games with team registration, check if team is complete and user is team leader
                                if (isTeamGame && isTeamRegistration) {
                                  const currentTeamSize = (userRegistration.teamMembers?.length || 0) + 1; // +1 for current user
                                  const requiredTeamSize = playersPerSide;
                                  const isTeamComplete = currentTeamSize === requiredTeamSize;
                                  const isTeamLeader = userRegistration.isTeamLead;
                                  
                                  // Show schedule button only if team is complete, user is team leader, and deadline hasn't passed
                                  if (!isRegistrationDeadlinePassed(event.registrationDeadline) && isTeamComplete && isTeamLeader) {
                                    return (
                                      <div className="border-t border-slate-600 mt-3 pt-2">
                                        <Button
                                          size="sm"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedGameForScheduling({
                                              ...game,
                                              userRegistration
                                            });
                                            setShowUserScheduling(true);
                                          }}
                                          className="codeninja-gradient text-white hover:opacity-90 w-full"
                                        >
                                          <CalendarCheck className="h-4 w-4 mr-2" />
                                          Schedule Match
                                        </Button>
                                      </div>
                                    );
                                  }
                                  
                                  // Show incomplete team tag if team is not complete
                                  if (!isTeamComplete) {
                                    return (
                                      <div className="border-t border-slate-600 mt-3 pt-2">
                                        <div className="flex items-center justify-center py-2 px-3 bg-orange-500/20 border border-orange-500/30 rounded-md">
                                          <Users className="h-4 w-4 mr-2 text-orange-400" />
                                          <span className="text-sm font-medium text-orange-400">
                                            Incomplete Team ({currentTeamSize}/{requiredTeamSize})
                                          </span>
                                        </div>
                                      </div>
                                    );
                                  }
                                  
                                  // Show team leader required message if user is not team leader
                                  if (!isTeamLeader) {
                                    return (
                                      <div className="border-t border-slate-600 mt-3 pt-2">
                                        <div className="flex items-center justify-center py-2 px-3 bg-blue-500/20 border border-blue-500/30 rounded-md">
                                          <UserCheck className="h-4 w-4 mr-2 text-blue-400" />
                                          <span className="text-sm font-medium text-blue-400">
                                            Only Team Leader Can Schedule
                                          </span>
                                        </div>
                                      </div>
                                    );
                                  }
                                } else if (isIndividualInTeamGame) {
                                  // For team games where user is registered as individual (team unassigned)
                                  return (
                                    <div className="border-t border-slate-600 mt-3 pt-2">
                                      <div className="flex items-center justify-center py-2 px-3 bg-yellow-500/20 border border-yellow-500/30 rounded-md">
                                        <Users className="h-4 w-4 mr-2 text-yellow-400" />
                                        <span className="text-sm font-medium text-yellow-400">
                                          Team Unassigned
                                        </span>
                                      </div>
                                    </div>
                                  );
                                } else {
                                  // For individual games (1v1), show schedule button normally
                                  if (!isRegistrationDeadlinePassed(event.registrationDeadline)) {
                                    return (
                                      <div className="border-t border-slate-600 mt-3 pt-2">
                                        <Button
                                          size="sm"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedGameForScheduling({
                                              ...game,
                                              userRegistration
                                            });
                                            setShowUserScheduling(true);
                                          }}
                                          className="codeninja-gradient text-white hover:opacity-90 w-full"
                                        >
                                          <CalendarCheck className="h-4 w-4 mr-2" />
                                          Schedule Match
                                        </Button>
                                      </div>
                                    );
                                  }
                                }
                                
                                return null;
                              })()}
                              
                              {/* Enhanced Team Information with Separator */}
                              {(() => {
                                // Check if this is a team game based on format (more than 1 player per side)
                                const playersPerSide = parseInt(game.format.split('v')[0]);
                                const isTeamGame = playersPerSide > 1;
                                
                                // Show team section for team games or actual team registrations
                                if (isTeamGame || userRegistration.mode === 'TEAM') {
                                  return (
                                    <div className="border-t border-slate-600 mt-3 pt-2">
                                      {/* Team Name */}
                                      {userRegistration.mode === 'TEAM' && userRegistration.teamName ? (
                                        <div className="text-xs text-blue-300 mb-2 font-medium flex items-center">
                                          <Users className="h-3 w-3 mr-1" />
                                          {userRegistration.teamName} - {(userRegistration.teamMembers?.length || 0) + 1} members
                                        </div>
                                      ) : null}
                                      
                                      {userRegistration.mode === 'TEAM' ? (
                                        <>
                                          {/* Current user with white name and colored tags */}
                                          <div className="text-xs text-white mb-1">
                                            • {currentUser?.firstName ? `${currentUser.firstName} ${currentUser.lastName || ''}`.trim() : currentUser?.email}
                                            {userRegistration.isTeamLead ? (
                                              <span className="text-yellow-400 ml-1">(Team Leader)</span>
                                            ) : (
                                              <span className="text-slate-400 ml-1">(Member)</span>
                                            )}
                                            <span className="text-blue-400 ml-1">(You)</span>
                                          </div>
                                          
                                          {/* Other team members with white names */}
                                          {userRegistration.teamMembers && userRegistration.teamMembers.map((member, idx) => (
                                            <div key={member.id} className="text-xs text-white mb-1">
                                              • {member.name}
                                              {member.isTeamLead ? (
                                                <span className="text-yellow-400 ml-1">(Team Leader)</span>
                                              ) : (
                                                <span className="text-slate-400 ml-1">(Member)</span>
                                              )}
                                              {member.id === currentUser?.id && (
                                                <span className="text-blue-400 ml-1">(You)</span>
                                              )}
                                            </div>
                                          ))}
                                        </>
                                      ) : isTeamGame && userRegistration.mode === 'INDIVIDUAL' ? (
                                        <div className="text-xs text-slate-400 mb-1">
                                          Waiting for admin to assign you to a team
                                        </div>
                                      ) : null}
                                    </div>
                                  );
                                }
                                return null;
                              })()}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Registration Modal */}
        {showRegistrationModal && selectedEvent && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-55">
                      <Card className="w-full h-[85vh] sm:h-auto sm:max-w-2xl bg-slate-800 border-0 sm:border sm:border-slate-700 sm:rounded-lg sm:max-h-[90vh] overflow-y-auto flex flex-col">
              <CardHeader className="flex-shrink-0 border-b border-slate-700 sm:border-b-0 p-3 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-0">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-white text-lg sm:text-xl">Register for Game</CardTitle>
                    <CardDescription className="text-slate-300 text-sm hidden sm:block">
                      {selectedEvent.name} - Choose your skill level and mode
                    </CardDescription>
                    <CardDescription className="text-slate-300 text-xs sm:hidden mt-1">
                      {selectedEvent.name}
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-shrink-0 ml-2 p-2"
                    onClick={() => setShowRegistrationModal(false)}
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto p-3 sm:p-6">
                <div className="space-y-4">
                  {Object.entries(registrations).map(([gameName, registration]) => {
                    const game = selectedEvent.games.find(g => g.name === gameName);
                    if (!game) return null;
                    
                    const currentGameRegistration = userRegistrations[gameName];
                    const showPermissionWarning = isRegistrationEditingDisabled(game, gameName);
                    
                    return (
                      <Card key={game.name} className="bg-slate-700/50 border-slate-600">
                        <CardContent className="p-3 sm:p-4">
                          {showPermissionWarning && (
                            <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-md">
                              <div className="flex items-center space-x-2">
                                <div className="text-yellow-400">⚠️</div>
                                <div className="text-yellow-300 text-sm">
                                  <strong>Team Member View:</strong> Only the team leader can modify registration details. You can only unregister from this game.
                                </div>
                              </div>
                            </div>
                          )}
                          <div className="mb-4">
                            <h4 className="font-semibold text-white mb-2 text-sm sm:text-base">{game.name}</h4>
                            <div className="text-xs sm:text-sm text-slate-400">
                              <div className="sm:hidden">
                                <div>Format: {game.format}</div>
                              </div>
                              <div className="hidden sm:block">
                                Format: {game.format}
                              </div>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                            <div>
                              <label className="block text-xs sm:text-sm font-medium text-slate-300 mb-2">
                                Skill Level
                              </label>
                              <select
                                value={registration.level}
                                onChange={(e) => handleRegistrationChange(gameName, 'level', e.target.value)}
                                className="w-full px-3 py-2 text-sm sm:text-base bg-slate-600 border border-slate-500 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                disabled={isRegistrationEditingDisabled(game, gameName)}
                              >
                                {game.level.map(level => (
                                  <option key={level} value={level}>{level}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs sm:text-sm font-medium text-slate-300 mb-2">
                                Mode
                              </label>
                              <select
                                value={registration.mode}
                                onChange={(e) => handleRegistrationChange(gameName, 'mode', e.target.value)}
                                className="w-full px-3 py-2 text-sm sm:text-base bg-slate-600 border border-slate-500 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                disabled={isRegistrationEditingDisabled(game, gameName)}
                              >
                                <option value="INDIVIDUAL">Individual</option>
                                {game.format !== '1v1' && <option value="TEAM">Team</option>}
                              </select>
                            </div>
                          </div>
                          
                          {/* Open Team Checkbox */}
                          {registration.mode === 'TEAM' && game.format !== '1v1' && (
                            <div className="mt-4">
                              <div className="flex items-center space-x-3">
                                <input
                                  type="checkbox"
                                  id={`openTeam-${gameName}`}
                                  checked={registration.openTeam || false}
                                  onChange={(e) => handleRegistrationChange(gameName, 'openTeam', e.target.checked)}
                                  className="w-4 h-4 text-blue-600 bg-slate-700 border-slate-600 rounded focus:ring-blue-500 focus:ring-2"
                                  disabled={isRegistrationEditingDisabled(game, gameName)}
                                />
                                <label htmlFor={`openTeam-${gameName}`} className="text-xs sm:text-sm font-medium text-slate-300 cursor-pointer">
                                  Allow individual players to join this team
                                </label>
                              </div>
                              <p className="text-slate-500 text-xs mt-1 ml-7">
                                When enabled, individual players can request to join your team if it's not complete
                              </p>
                            </div>
                          )}
                          
                          {/* Team Name Input */}
                          {registration.mode === 'TEAM' && game.format !== '1v1' && (
                            <div className="mt-4">
                              <label className="block text-xs sm:text-sm font-medium text-slate-300 mb-2">
                                Team Name *
                              </label>
                              <input
                                type="text"
                                value={registration.teamName || ''}
                                onChange={(e) => handleRegistrationChange(gameName, 'teamName', e.target.value)}
                                placeholder="Enter your team name"
                                className="w-full px-3 py-2 text-sm sm:text-base bg-slate-600 border border-slate-500 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                required
                                disabled={isRegistrationEditingDisabled(game, gameName)}
                              />
                            </div>
                          )}
                          
                          {/* Team Member Selection */}
                          {registration.mode === 'TEAM' && game.format !== '1v1' && (
                            <div className="mt-4 pt-4 border-t border-slate-600">
                              <label className="block text-xs sm:text-sm font-medium text-slate-300 mb-2">
                                Team Members ({(registration.teamMembers?.length || 0) + 1}/{parseInt(game.format.split('v')[0])})
                              </label>
                              
                              {/* Current user (always included) */}
                              <div className="mb-3">
                                <div className="flex items-center justify-between p-2 sm:p-3 bg-slate-600/50 rounded">
                                  <span className="text-white text-sm sm:text-base truncate">{currentUser?.email} (You)</span>
                                  {(currentGameRegistration?.isTeamLead !== false) ? (
                                    <span className="text-green-400 text-xs sm:text-sm flex-shrink-0 ml-2">Team Leader</span>
                                  ) : (
                                    <span className="text-blue-400 text-xs sm:text-sm flex-shrink-0 ml-2">Team Member</span>
                                  )}
                                </div>
                              </div>
                              
                              {/* Selected team members */}
                              {registration.teamMembers?.map(userId => {
                                const user = users.find(u => u.id === userId);
                                const currentGameRegistration = userRegistrations[gameName];
                                const isCurrentUserTeamLead = currentGameRegistration?.isTeamLead || false;
                                
                                // Check if this specific member is the team leader
                                const memberData = currentGameRegistration?.teamMembers?.find((member: any) => member.id === userId);
                                const isMemberTeamLead = memberData?.isTeamLead || false;
                                
                                return user ? (
                                  <div key={userId} className="flex items-center justify-between p-2 sm:p-3 bg-slate-600/50 rounded mb-2">
                                    <span className="text-white text-sm sm:text-base truncate">{user.name || user.email}</span>
                                    <div className="flex items-center space-x-2">
                                      {isCurrentUserTeamLead && (
                                        <button
                                          type="button"
                                          onClick={() => handleTeamMemberRemove(gameName, userId)}
                                          className="text-red-400 hover:text-red-300 text-xs sm:text-sm flex-shrink-0 px-2 py-1 rounded hover:bg-red-400/10"
                                        >
                                          Remove
                                        </button>
                                      )}
                                      {isMemberTeamLead ? (
                                        <span className="text-green-400 text-xs sm:text-sm flex-shrink-0">Team Leader</span>
                                      ) : (
                                        <span className="text-blue-400 text-xs sm:text-sm flex-shrink-0">Team Member</span>
                                      )}
                                    </div>
                                  </div>
                                ) : null;
                              })}
                              
                              {/* Add team member */}
                              {(registration.teamMembers?.length || 0) < parseInt(game.format.split('v')[0]) - 1 && (
                                <div className="space-y-2">
                                  <input
                                    type="text"
                                    placeholder="Search users..."
                                    value={userSearch[gameName] || ''}
                                    onChange={(e) => setUserSearch(prev => ({ ...prev, [gameName]: e.target.value }))}
                                    className="w-full px-3 py-2 text-sm sm:text-base bg-slate-600 border border-slate-500 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    disabled={isRegistrationEditingDisabled(game, gameName)}
                                  />
                                  
                                  {userSearch[gameName] && getFilteredUsers(gameName).length > 0 && !(isEditingRegistration && userRegistrations[gameName] && !userRegistrations[gameName].isTeamLead) && (
                                    <div className="max-h-32 sm:max-h-40 overflow-y-auto bg-slate-700 border border-slate-600 rounded">
                                      {getFilteredUsers(gameName).slice(0, 5).map(user => (
                                        <button
                                          key={user.id}
                                          type="button"
                                          onClick={() => handleTeamMemberAdd(gameName, user.id)}
                                          className="w-full text-left p-2 sm:p-3 hover:bg-slate-600 text-white border-b border-slate-600 last:border-b-0"
                                        >
                                          <div className="text-sm sm:text-base truncate">{user.name || user.email}</div>
                                          <div className="text-xs sm:text-sm text-slate-400 truncate">{user.email}</div>
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                          
                          {/* Open Teams Section - Show when Individual mode is selected for team-based games */}
                          {registration.mode === 'INDIVIDUAL' && game.format !== '1v1' && game.format !== 'Individual' && (
                            <div className="mt-4 pt-4 border-t border-slate-600">
                              <div className="flex items-center justify-between mb-3">
                                <label className="block text-xs sm:text-sm font-medium text-slate-300">
                                  Available Open Teams
                                </label>
                                <button
                                  type="button"
                                  onClick={() => game.id && fetchOpenTeams(game.id)}
                                  className="text-blue-400 hover:text-blue-300 text-xs sm:text-sm px-2 py-1 rounded hover:bg-blue-400/10"
                                  disabled={loadingOpenTeams[game.id || '']}
                                >
                                  {loadingOpenTeams[game.id || ''] ? 'Loading...' : 'Refresh'}
                                </button>
                              </div>
                              
                              <div className="text-xs sm:text-sm text-slate-400 mb-3">
                                Join an existing team that's looking for more players, or register individually to be assigned later.
                              </div>
                              
                              {loadingOpenTeams[game.id || ''] ? (
                                <div className="text-center py-4 text-slate-400">
                                  Loading open teams...
                                </div>
                              ) : openTeams[game.id || '']?.length > 0 ? (
                                <div className="space-y-2 max-h-40 overflow-y-auto">
                                  {openTeams[game.id || ''].map((team: any) => (
                                    <div key={team.id} className="flex items-center justify-between p-3 bg-slate-600/30 rounded border border-slate-600">
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                          <span className="text-white text-sm font-medium truncate">{team.name}</span>
                                          <span className="text-xs text-slate-400 flex-shrink-0">
                                            {team.currentSize}/{team.requiredSize} members
                                          </span>
                                        </div>
                                        <div className="text-xs text-slate-400">
                                          Led by {team.leader.firstName} {team.leader.lastName}
                                        </div>
                                        {team.members.length > 1 && (
                                          <div className="text-xs text-slate-500 mt-1">
                                            Members: {team.members.slice(1).map((member: any) => `${member.firstName} ${member.lastName}`).join(', ')}
                                          </div>
                                        )}
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => handleJoinTeam(team.id, team.name, game.id)}
                                        className="ml-3 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition-colors flex-shrink-0"
                                      >
                                        Join Team
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="text-center py-4 text-slate-400 text-sm">
                                  No open teams available. You can register individually and be assigned to a team later.
                                </div>
                              )}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>

                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mt-6 pt-4 border-t border-slate-600 space-y-3 sm:space-y-0">
                  {isEditingRegistration && (
                    <Button
                      variant="destructive"
                      onClick={handleUnregister}
                      disabled={submitting}
                      className="w-full sm:w-auto"
                    >
                      Unregister
                    </Button>
                  )}
                  {!isEditingRegistration && <div className="hidden sm:block"></div>}
                  
                  <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowRegistrationModal(false);
                        setIsEditingRegistration(false);
                      }}
                      className="w-full sm:w-auto"
                    >
                      Cancel
                    </Button>
                    {(() => {
                      // Check if user is team lead for any of the selected games
                      const selectedGames = Object.entries(registrations).filter(([_, reg]) => reg.level);
                      const canUpdate = selectedGames.every(([gameName, _]) => {
                        const currentGameRegistration = userRegistrations[gameName];
                        return !isEditingRegistration || !currentGameRegistration || currentGameRegistration.isTeamLead !== false;
                      });
                      
                      return canUpdate && (
                        <Button
                          className="codeninja-gradient w-full sm:w-auto"
                          onClick={handleSubmitRegistrations}
                          disabled={submitting}
                        >
                          {submitting
                            ? (isEditingRegistration ? 'Updating...' : 'Registering...')
                            : (isEditingRegistration ? 'Update Registration' : 'Register for Game')
                          }
                        </Button>
                      );
                    })()}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Rules Modal */}
        {showRulesModal && selectedContestRules && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <Card className="w-full max-w-2xl bg-slate-800 border-slate-700 max-h-[85vh] sm:max-h-[90vh] overflow-y-auto shadow-2xl">
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
                  <CardDescription className="text-slate-300 mt-2 text-sm sm:text-base">
                    {selectedContestRules.description}
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="p-4 sm:p-6">
                <div className="space-y-4 sm:space-y-6">
                  {selectedContestRules.gameDescription && (
                                      <div className="bg-gradient-to-r from-blue-600/10 to-purple-600/10 p-4 rounded-lg border border-blue-500/20 mb-6">
                                        <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                                          <Info className="h-5 w-5 mr-2 text-blue-400" />
                                          Game Description
                                        </h3>
                                        <div className="text-slate-200 leading-relaxed text-sm sm:text-base">
                                          <FormattedText text={selectedContestRules.gameDescription} />
                                        </div>
                                      </div>
                                    )}
                  
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
                                            <span className="text-slate-200 leading-relaxed text-sm sm:text-base pt-1">{rule}</span>
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

      {/* User Scheduling Modal */}
      {showUserScheduling && selectedGameForScheduling && (
        <UserRestrictedGameSchedulingInterface
          gameId={selectedGameForScheduling.id}
          userRegistration={userRegistrations[selectedGameForScheduling.name]}
          apiCall={apiCall}
          currentUser={currentUser}
          onClose={() => {
            setShowUserScheduling(false);
            setSelectedGameForScheduling(null);
          }}
        />
      )}
    </div>
  );
}
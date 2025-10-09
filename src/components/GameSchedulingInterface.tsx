"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useAlert } from "@/contexts/AlertContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Users,
  Calendar,
  Clock,
  Trophy,
  Target,
  Search,
  Filter,
  Save,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  X,
  User,
  UserCheck,
  ChevronDown,
  ChevronRight,
  GripVertical,
  RotateCcw,
  Info,
  Shield,
  ShieldCheck,
  Phone,
  Mail
} from "lucide-react";
import { ContestValidator, ParticipantStatus } from "@/lib/contest-validation";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import {
  useDroppable,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import ScheduleEditor from "./ScheduleEditor";

interface Participant {
  id: string;
  name: string;
  type: 'user' | 'team';
  level?: string;
  phone?: string | null;
}

interface Registration {
  id: string;
  level: string;
  mode: string;
  isComplete: boolean;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string | null;
    avatarUrl?: string;
  };
  team?: {
    id: string;
    name: string;
    isComplete: boolean;
    requiredSize: number;
    actualSize: number;
    leader?: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      phone?: string | null;
      avatarUrl?: string;
    };
    members: Array<{
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      avatarUrl?: string;
    }>;
  };
}

interface GameData {
  id: string;
  name: string;
  contestType: string;
  typeFormat: string;
  avgGameTime: number;
  simultaneousGames: number;
  oneLoserMode?: boolean;
  category?: {
    startDate: string;
    endDate: string;
    dailyWindows: Array<{
      start: string;
      end: string;
    }>;
  };
}

interface ScheduleMatch {
  id: string;
  gameId: string;
  gameName: string;
  participantA: string;
  participantB: string;
  startTime: Date;
  endTime: Date;
  venueId: string;
  venueName: string;
  courtId: string;
  courtName: string;
  status: 'scheduled' | 'conflict' | 'confirmed';
  round?: number;
  position?: number;
}

interface ScheduledMatch {
  id: string;
  participantA: string;
  participantB: string;
  participantC?: string; // For 1v1v1v1 format
  participantD?: string; // For 1v1v1v1 format
  registrationAId: string;
  registrationBId: string;
  registrationCId?: string; // For 1v1v1v1 format
  registrationDId?: string; // For 1v1v1v1 format
  participantAId?: string; // Actual participant ID (team ID or user ID)
  participantBId?: string; // Actual participant ID (team ID or user ID)
  participantCId?: string; // For 1v1v1v1 format
  participantDId?: string; // For 1v1v1v1 format
  participantAType?: string; // 'TEAM' or 'USER'
  participantBType?: string; // 'TEAM' or 'USER'
  participantCType?: string; // For 1v1v1v1 format
  participantDType?: string; // For 1v1v1v1 format
  timeSlotId: string;
  winnerId?: string;
  winnerType?: string;
  scoreNotes?: string; // Score for scoring contests
}

interface TimeSlot {
  id: string;
  startTime: Date;
  endTime: Date;
  timelineId: number;
  venueId: string;
  venueName: string;
  courtId: string;
  courtName: string;
  matches: ScheduleMatch[];
}

interface GameSchedulingInterfaceProps {
  gameId: string;
  onClose: () => void;
  onShowRegistrations?: () => void;
  apiCall: (url: string, options?: RequestInit) => Promise<Response>;
}

const contestTypeLabels = {
  SINGLE_ELIMINATION: "Single Elimination",
  SINGLE_ELIMINATION_1V1V1V1: "Single Elimination (4 Players)",
  DOUBLE_ELIMINATION: "Double Elimination",
  ROUND_ROBIN: "Round Robin",
  ROUND_ROBIN_HOME_AWAY: "Round Robin (Home/Away)",
  GROUP_STAGE_KNOCKOUT: "Group Stage → Knockout",
  SWISS_SYSTEM: "Swiss System",
  LADDER: "Ladder",
  TIME_BOXED_LEAGUE: "Time-boxed League",
  FRIENDLY: "Friendly",
  SCORING: "Scoring Contest"
};

// Level color mapping function
const getLevelColor = (level: string) => {
  switch (level?.toLowerCase()) {
    case 'beginner':
      return {
        bg: 'bg-green-500/20',
        text: 'text-green-400',
        border: 'border-green-500/30'
      };
    case 'intermediate':
      return {
        bg: 'bg-yellow-500/20',
        text: 'text-yellow-400',
        border: 'border-yellow-500/30'
      };
    case 'advanced':
      return {
        bg: 'bg-red-500/20',
        text: 'text-red-400',
        border: 'border-red-500/30'
      };
    default:
      return {
        bg: 'bg-slate-500/20',
        text: 'text-slate-400',
        border: 'border-slate-500/30'
      };
  }
};

// Helper function to format names as "FirstName First6LettersOfLastName" with ".." if truncated
const formatParticipantName = (firstName: string, lastName: string): string => {
  if (!lastName) return firstName;
  
  const first6Letters = lastName.substring(0, 6);
  const isLongerThan6 = lastName.length > 6;
  
  return `${firstName} ${first6Letters}${isLongerThan6 ? '..' : ''}`;
};

// Helper function to format level as initial (B, I, A)
const formatLevelInitial = (level: string): string => {
  if (!level) return '';
  return level.charAt(0).toUpperCase();
};

// Helper function to reformat existing participant names from database
const reformatExistingParticipantName = (participantName: string, participantId: string, participantType: string, registrations: Registration[]): string => {
  // If it's a team name, return as-is
  if (participantType === 'TEAM') {
    return participantName;
  }
  
  // For individual participants, find the registration and reformat
  const registration = registrations.find(reg =>
    reg.user.id === participantId
  );
  
  if (registration) {
    return formatParticipantName(registration.user.firstName, registration.user.lastName);
  }
  
  // Fallback: return original name if registration not found
  return participantName;
};

export default function GameSchedulingInterface({
  gameId,
  onClose,
  onShowRegistrations,
  apiCall
}: GameSchedulingInterfaceProps) {
  // Try to use alert system, fallback to console if not available
  let showError: (message: string, title?: string) => void;
  try {
    const alertContext = useAlert();
    showError = alertContext.showError;
  } catch (error) {
    console.warn('Alert system not available, using console fallback');
    showError = (message: string, title?: string) => {
      console.error(`${title ? title + ': ' : ''}${message}`);
      alert(`${title ? title + ': ' : ''}${message}`);
    };
  }
  
  const [loading, setLoading] = useState(true);
  const [gameData, setGameData] = useState<GameData | null>(null);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [matches, setMatches] = useState<ScheduleMatch[]>([]);
  const [actualMatches, setActualMatches] = useState<any[]>([]); // Store real match data for round counting
  const [searchTerm, setSearchTerm] = useState('');
  const [levelFilter, setLevelFilter] = useState('All');
  const [showCompleteSection, setShowCompleteSection] = useState(true);
  const [showIncompleteSection, setShowIncompleteSection] = useState(true);
  const [roundSectionStates, setRoundSectionStates] = useState<{[key: number]: boolean}>({});
  const [selectedDate, setSelectedDate] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [scheduledMatches, setScheduledMatches] = useState<ScheduledMatch[]>([]);
  const [scheduledRegistrationIds, setScheduledRegistrationIds] = useState<Set<string>>(new Set());
  const [updatingWinner, setUpdatingWinner] = useState<string | null>(null);
  const [selectedTimeline, setSelectedTimeline] = useState<number>(1);
  const [selectedParticipant, setSelectedParticipant] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [useSelectAndDrop, setUseSelectAndDrop] = useState(true); // Default to select and drop for PC
  const [participantStatuses, setParticipantStatuses] = useState<ParticipantStatus[]>([]);
  const [rulesExpanded, setRulesExpanded] = useState(false);
  const [showRegistrationSection, setShowRegistrationSection] = useState(true);
  const [mobileRegistrationHeight, setMobileRegistrationHeight] = useState(30); // percentage of viewport height
  const [isResizing, setIsResizing] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

  // Track screen size for responsive behavior
  useEffect(() => {
    const checkScreenSize = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };
    
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  // Handle mobile registration section resizing
  const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    setIsResizing(true);
    e.preventDefault();
    e.stopPropagation();
  };

  const handleMouseMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!isResizing) return;
    
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const viewportHeight = window.innerHeight;
    const newHeight = Math.min(Math.max((clientY / viewportHeight) * 100, 20), 70); // Min 20%, Max 70%
    setMobileRegistrationHeight(newHeight);
  }, [isResizing]);

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
  }, []);

  // Add event listeners for mouse and touch events
  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove, { passive: false });
      document.addEventListener('mouseup', handleMouseUp);
      document.addEventListener('touchmove', handleMouseMove, { passive: false });
      document.addEventListener('touchend', handleMouseUp);
      
      document.body.style.cursor = 'ns-resize';
      document.body.style.userSelect = 'none';
      document.body.style.touchAction = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchmove', handleMouseMove);
      document.removeEventListener('touchend', handleMouseUp);
      
      if (!isResizing) {
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        document.body.style.touchAction = '';
      }
    };
  }, [isResizing, handleMouseMove, handleMouseUp]);
  const [showScoreDialog, setShowScoreDialog] = useState(false);
  const [scoreDialogData, setScoreDialogData] = useState<{
    match: ScheduledMatch;
    side: 'A' | 'B' | 'C' | 'D';
    participantName: string;
  } | null>(null);
  const [scoreInput, setScoreInput] = useState('');
  const [overrideConflicts, setOverrideConflicts] = useState(false);

  // Scroll position preservation
  const [registrationScrollTop, setRegistrationScrollTop] = useState(0);
  const [timelineScrollTop, setTimelineScrollTop] = useState(0);
  const registrationListRef = useRef<HTMLDivElement>(null);
  const timelineContainerRef = useRef<HTMLDivElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    loadScheduleData();
  }, [gameId]);

  // Auto-select first participant when all data is loaded
  useEffect(() => {
    if (!loading && registrations.length > 0 && !selectedParticipant && gameData) {
      // Get available participants using the same filtering and sorting logic as the display
      const filteredAndSortedRegistrations = getFilteredRegistrations();
      const getAvailableParticipants = (regs: Registration[]) => {
        return regs.filter(reg => {
          // Get participant ID
          const participantId = reg.mode === 'TEAM' && reg.team ? reg.team.id : reg.user.id;
          
          // Find participant status
          const participantStatus = participantStatuses.find(p => p.id === participantId);
          
          // If no status found, participant hasn't been scheduled yet - allow scheduling
          if (!participantStatus) {
            return true;
          }
          
          // Hide participants with unconcluded matches (active matches) for ALL contest types
          if (participantStatus.hasActiveMatch) {
            return false;
          }
          
          // For single elimination, also check if eliminated
          if (gameData.contestType === 'SINGLE_ELIMINATION' || gameData.contestType === 'SINGLE_ELIMINATION_1V1V1V1') {
            // Hide if eliminated
            return !participantStatus.isEliminated;
          }
          
          return true;
        });
      };

      const availableParticipants = getAvailableParticipants(filteredAndSortedRegistrations);
      
      // Select the first available participant (which is now the first after sorting)
      if (availableParticipants.length > 0) {
        setSelectedParticipant(availableParticipants[0].id);
      }
    }
  }, [loading, registrations, participantStatuses, gameData, selectedParticipant]);

  useEffect(() => {
    // Detect if device is mobile
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768 || 'ontouchstart' in window);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    // Set first available date as default when game data loads
    if (gameData?.category && selectedDate === '') {
      const availableDates = getAvailableDates();
      if (availableDates.length > 0) {
        setSelectedDate(availableDates[0].toISOString());
      }
    }
  }, [gameData, selectedDate]);

  // Load existing matches after registrations are loaded
  useEffect(() => {
    if (gameId && registrations.length > 0) {
      loadExistingMatches();
    }
  }, [gameId, registrations]);

  // Reload matches when timeline changes
  useEffect(() => {
    if (gameId && registrations.length > 0 && selectedTimeline) {
      loadExistingMatches();
    }
  }, [selectedTimeline]);

  // Reload matches when selected date changes
  useEffect(() => {
    if (gameId && registrations.length > 0 && selectedDate && gameData) {
      loadExistingMatches();
    }
  }, [selectedDate]);

  // Set section states based on team game type and team counts
  useEffect(() => {
    if (gameData && gameData.typeFormat !== '1v1' && gameData.typeFormat !== 'Individual') {
      // For team games, collapse incomplete section by default
      setShowIncompleteSection(false);
      
      // If there are no complete teams, collapse complete section too
      const completeTeams = registrations.filter(reg => reg.isComplete);
      if (completeTeams.length === 0) {
        setShowCompleteSection(false);
      }
    }
  }, [gameData, registrations]);

  // Scroll position preservation helpers
  const saveScrollPositions = () => {
    if (registrationListRef.current) {
      setRegistrationScrollTop(registrationListRef.current.scrollTop);
    }
    if (timelineContainerRef.current) {
      setTimelineScrollTop(timelineContainerRef.current.scrollTop);
    }
  };

  const restoreScrollPositions = () => {
    // Use setTimeout to ensure DOM is updated before restoring scroll
    setTimeout(() => {
      if (registrationListRef.current && registrationScrollTop > 0) {
        registrationListRef.current.scrollTop = registrationScrollTop;
      }
      if (timelineContainerRef.current && timelineScrollTop > 0) {
        timelineContainerRef.current.scrollTop = timelineScrollTop;
      }
    }, 100);
  };

  const loadScheduleData = async () => {
    // Save current scroll positions before loading
    saveScrollPositions();
    setLoading(true);
    try {
      // Load basic game data and registrations
      const response = await apiCall(`/api/admin/games/${gameId}/schedule`);
      if (response.ok) {
        const data = await response.json();
        setGameData(data.game);
        setRegistrations(data.registrations);
        setParticipants(data.participants);
        setTimeSlots(data.timeSlots.map((slot: any) => ({
          ...slot,
          startTime: new Date(slot.startTime),
          endTime: new Date(slot.endTime),
          matches: slot.matches.map((match: any) => ({
            ...match,
            startTime: new Date(match.startTime),
            endTime: new Date(match.endTime)
          }))
        })));
        setMatches(data.matches.map((match: any) => ({
          ...match,
          startTime: new Date(match.startTime),
          endTime: new Date(match.endTime)
        })));
      } else {
        console.error('Failed to load schedule data');
      }
    } catch (error) {
      console.error('Error loading schedule data:', error);
    } finally {
      setLoading(false);
      // Restore scroll positions after loading
      restoreScrollPositions();
    }
  };

  const loadExistingMatches = async () => {
    // Save current scroll positions before loading
    saveScrollPositions();
    try {
      // Load matches from ALL timelines to prevent cross-timeline conflicts
      const response = await apiCall(`/api/admin/games/${gameId}/matches`);
      if (response.ok) {
        const data = await response.json();
        console.log('Loading existing matches from all timelines:', data.matches?.length || 0);
        if (data.success && data.matches) {
          // Convert database matches to scheduled matches format
          const scheduledMatchesData: ScheduledMatch[] = [];
          const scheduledRegIds = new Set<string>();
          const invalidMatches: string[] = [];

          // Generate time windows for current timeline to match slot IDs
          const selectedDateObj = new Date(selectedDate);
          const timeWindows = getTimeWindows();
          console.log('Generated time windows for current timeline:', timeWindows.length);

          // Get valid date range and time windows from game category
          const validDateRange = getAvailableDates();
          const validTimeWindows = gameData?.category?.dailyWindows ?
            (typeof gameData.category.dailyWindows === 'string' ?
              JSON.parse(gameData.category.dailyWindows) :
              gameData.category.dailyWindows) : [];

          // Build participant statuses from all matches and registrations
          const newParticipantStatuses: ParticipantStatus[] = [];

          for (const registration of registrations) {
            const participantId = registration.mode === 'TEAM' && registration.team
              ? registration.team.id
              : registration.user.id;
            
            const participantName = registration.mode === 'TEAM' && registration.team
              ? registration.team.name
              : formatParticipantName(registration.user.firstName, registration.user.lastName);

            // Calculate stats from existing matches
            let wins = 0;
            let losses = 0;
            let totalMatches = 0;
            let hasActiveMatch = false;
            let isEliminated = false;

            for (const match of data.matches) {
              let isParticipantInMatch = false;
              
              // Check participantA (could be regular participant or JSON for participants 1 and 2)
              if (match.participantAType === 'FOUR_PARTICIPANT_DATA' && match.participantAId) {
                // Parse JSON to check for participants 1 and 2
                try {
                  const participantAData = JSON.parse(match.participantAId);
                  if (participantAData.participant1Id === participantId ||
                      participantAData.participant2Id === participantId) {
                    isParticipantInMatch = true;
                  }
                } catch (e) {
                  // If parsing fails, ignore
                }
              } else if (match.participantAId === participantId) {
                isParticipantInMatch = true;
              }
              
              // Check participantB (could be regular participant or JSON for participants 3 and 4)
              if (match.participantBType === 'FOUR_PARTICIPANT_DATA' && match.participantBId) {
                // Parse JSON to check for participants 3 and 4
                try {
                  const participantBData = JSON.parse(match.participantBId);
                  if (participantBData.participant3Id === participantId ||
                      participantBData.participant4Id === participantId) {
                    isParticipantInMatch = true;
                  }
                } catch (e) {
                  // If parsing fails, ignore
                }
              } else if (match.participantBId === participantId) {
                isParticipantInMatch = true;
              }
              
              if (isParticipantInMatch) {
                if (match.winnerId) {
                  totalMatches++;
                  
                  // For 1 Loser mode in 1v1v1v1, invert the logic
                  const isOneLoserMode = gameData?.contestType === 'SINGLE_ELIMINATION_1V1V1V1' && gameData?.oneLoserMode;
                  const isWinner = isOneLoserMode
                    ? match.winnerId !== participantId  // In 1 Loser mode, NOT being the winnerId means you won
                    : match.winnerId === participantId; // Normal mode, being the winnerId means you won
                  
                  if (isWinner) {
                    wins++;
                  } else {
                    losses++;
                    // In single elimination, losing means elimination
                    if (gameData?.contestType === 'SINGLE_ELIMINATION') {
                      isEliminated = true;
                    }
                    // In 1v1v1v1 with 1 Loser mode, being the loser means elimination
                    if (isOneLoserMode) {
                      isEliminated = true;
                    }
                  }
                } else {
                  // Match exists but no winner = active match
                  // Count as active for ANY unconcluded match (including TBD matches)
                  // This will hide participants from registration section if they have any scheduled match
                  hasActiveMatch = true;
                }
              }
            }

            newParticipantStatuses.push({
              id: participantId,
              name: participantName,
              type: registration.mode === 'TEAM' ? 'team' : 'user',
              isEliminated,
              hasActiveMatch,
              wins,
              losses,
              totalMatches
            });
          }

          // Update participant statuses
          setParticipantStatuses(newParticipantStatuses);
          
          // Store actual matches data for round counting
          setActualMatches(data.matches || []);

          data.matches.forEach((match: any) => {
            if (match.slot) {
              const slotStart = new Date(match.slot.startTime);
              const slotEnd = new Date(match.slot.endTime);
              
              // Validate if match is within valid date range
              const matchDate = slotStart.toDateString();
              const isValidDate = validDateRange.some(date => date.toDateString() === matchDate);
              
              // Validate if match is within valid time windows
              const matchStartTime = slotStart.toTimeString().slice(0, 5); // HH:MM format
              const matchEndTime = slotEnd.toTimeString().slice(0, 5); // HH:MM format
              const isValidTimeWindow = validTimeWindows.some((window: any) =>
                window.start <= matchStartTime && matchEndTime <= window.end
              );

              // If match is outside valid date/time range, mark for deletion
              if (!isValidDate || !isValidTimeWindow) {
                console.warn('Invalid match found:', {
                  matchId: match.id,
                  slotStart: slotStart.toISOString(),
                  slotEnd: slotEnd.toISOString(),
                  isValidDate,
                  isValidTimeWindow,
                  matchStartTime,
                  matchEndTime,
                  validTimeWindows
                });
                invalidMatches.push(match.id);
                return; // Skip processing this match
              }
              
              // Check if this match is for the current timeline and current date
              const isCurrentTimeline = match.slot.timelineId === selectedTimeline;
              const isCurrentDate = slotStart.toDateString() === selectedDateObj.toDateString();
              
              // Find participant registrations
              let regA = null;
              let regB = null;
              let regC = null;
              let regD = null;
              
              // Handle participantA (could be regular participant or JSON for participants 1 and 2)
              if (match.participantAType === 'FOUR_PARTICIPANT_DATA' && match.participantAId) {
                // Parse JSON to get participants 1 and 2
                try {
                  const participantAData = JSON.parse(match.participantAId);
                  if (participantAData.participant1Id) {
                    regA = registrations.find(reg =>
                      (participantAData.participant1Type === 'TEAM' && reg.team?.id === participantAData.participant1Id) ||
                      (participantAData.participant1Type === 'USER' && reg.user.id === participantAData.participant1Id)
                    );
                  }
                  if (participantAData.participant2Id) {
                    regB = registrations.find(reg =>
                      (participantAData.participant2Type === 'TEAM' && reg.team?.id === participantAData.participant2Id) ||
                      (participantAData.participant2Type === 'USER' && reg.user.id === participantAData.participant2Id)
                    );
                  }
                } catch (e) {
                  console.error('Error parsing participant A data:', e);
                }
              } else {
                // Regular participant A
                regA = registrations.find(reg =>
                  (match.participantAType === 'TEAM' && reg.team?.id === match.participantAId) ||
                  (match.participantAType === 'USER' && reg.user.id === match.participantAId)
                );
              }
              
              // Handle participantB (could be regular participant or JSON for participants 3 and 4)
              if (match.participantBType === 'FOUR_PARTICIPANT_DATA' && match.participantBId) {
                // Parse JSON to get participants 3 and 4
                try {
                  const participantBData = JSON.parse(match.participantBId);
                  if (participantBData.participant3Id) {
                    regC = registrations.find(reg =>
                      (participantBData.participant3Type === 'TEAM' && reg.team?.id === participantBData.participant3Id) ||
                      (participantBData.participant3Type === 'USER' && reg.user.id === participantBData.participant3Id)
                    );
                  }
                  if (participantBData.participant4Id) {
                    regD = registrations.find(reg =>
                      (participantBData.participant4Type === 'TEAM' && reg.team?.id === participantBData.participant4Id) ||
                      (participantBData.participant4Type === 'USER' && reg.user.id === participantBData.participant4Id)
                    );
                  }
                } catch (e) {
                  console.error('Error parsing participant B data:', e);
                }
              } else if (!regB) {
                // Regular participant B (only if regB wasn't set from participantA JSON)
                regB = registrations.find(reg =>
                  (match.participantBType === 'TEAM' && reg.team?.id === match.participantBId) ||
                  (match.participantBType === 'USER' && reg.user.id === match.participantBId)
                );
              }
              
              // Debug registration lookup during data loading
              if (match.participantAType === 'USER' || match.participantBType === 'USER') {
                console.log('=== LOADING EXISTING MATCH WITH USER PARTICIPANTS ===');
                console.log('Match:', {
                  id: match.id,
                  participantAId: match.participantAId,
                  participantAType: match.participantAType,
                  participantBId: match.participantBId,
                  participantBType: match.participantBType
                });
                console.log('Found regA:', regA ? {
                  id: regA.id,
                  mode: regA.mode,
                  level: regA.level,
                  userName: regA.mode === 'USER' ? `${regA.user.firstName} ${regA.user.lastName}` : null
                } : 'NULL');
                console.log('Found regB:', regB ? {
                  id: regB.id,
                  mode: regB.mode,
                  level: regB.level,
                  userName: regB.mode === 'USER' ? `${regB.user.firstName} ${regB.user.lastName}` : null
                } : 'NULL');
              }

              // Track ALL scheduled registrations across all timelines and dates
              if (regA) scheduledRegIds.add(regA.id);
              if (regB) scheduledRegIds.add(regB.id);
              if (regC) scheduledRegIds.add(regC.id);
              if (regD) scheduledRegIds.add(regD.id);

              // Only add to scheduled matches if it's for current timeline and date
              if (isCurrentTimeline && isCurrentDate) {
                // Find matching time window by comparing start times
                const matchingWindow = timeWindows.find((window: any) => {
                  const windowStart = new Date(window.startTime);
                  const windowEnd = new Date(window.endTime);
                  const startTimeDiff = Math.abs(windowStart.getTime() - slotStart.getTime());
                  const endTimeDiff = Math.abs(windowEnd.getTime() - slotEnd.getTime());
                  return startTimeDiff < 60000 && endTimeDiff < 60000; // Within 1 minute
                });

                if (matchingWindow && (regA || regB || regC || regD)) {
                  const participantA = regA ? (
                    regA.mode === 'TEAM' && regA.team
                      ? regA.team.name
                      : formatParticipantName(regA.user.firstName, regA.user.lastName)
                  ) : '';
                  
                  const participantB = regB ? (
                    regB.mode === 'TEAM' && regB.team
                      ? regB.team.name
                      : formatParticipantName(regB.user.firstName, regB.user.lastName)
                  ) : '';
                  
                  const participantC = regC ? (
                    regC.mode === 'TEAM' && regC.team
                      ? regC.team.name
                      : formatParticipantName(regC.user.firstName, regC.user.lastName)
                  ) : '';
                  
                  const participantD = regD ? (
                    regD.mode === 'TEAM' && regD.team
                      ? regD.team.name
                      : formatParticipantName(regD.user.firstName, regD.user.lastName)
                  ) : '';

                  // Parse participant IDs for 1v1v1v1 format
                  let participant1Id = '';
                  let participant2Id = '';
                  let participant3Id = '';
                  let participant4Id = '';
                  let participant1Type = '';
                  let participant2Type = '';
                  let participant3Type = '';
                  let participant4Type = '';
                  
                  // Parse participantA JSON for participants 1 and 2
                  if (match.participantAType === 'FOUR_PARTICIPANT_DATA' && match.participantAId) {
                    try {
                      const participantAData = JSON.parse(match.participantAId);
                      participant1Id = participantAData.participant1Id || '';
                      participant2Id = participantAData.participant2Id || '';
                      participant1Type = participantAData.participant1Type || '';
                      participant2Type = participantAData.participant2Type || '';
                    } catch (e) {
                      console.error('Error parsing participant A data:', e);
                    }
                  } else {
                    // Regular participant A
                    participant1Id = match.participantAId || '';
                    participant1Type = match.participantAType || '';
                  }
                  
                  // Parse participantB JSON for participants 3 and 4
                  if (match.participantBType === 'FOUR_PARTICIPANT_DATA' && match.participantBId) {
                    try {
                      const participantBData = JSON.parse(match.participantBId);
                      participant3Id = participantBData.participant3Id || '';
                      participant4Id = participantBData.participant4Id || '';
                      participant3Type = participantBData.participant3Type || '';
                      participant4Type = participantBData.participant4Type || '';
                    } catch (e) {
                      console.error('Error parsing participant B data:', e);
                    }
                  } else if (!participant2Id) {
                    // Regular participant B (only if participant2 wasn't set from participantA JSON)
                    participant2Id = match.participantBId || '';
                    participant2Type = match.participantBType || '';
                  }

                  scheduledMatchesData.push({
                    id: match.id,
                    participantA,
                    participantB,
                    participantC,
                    participantD,
                    registrationAId: regA?.id || '',
                    registrationBId: regB?.id || '',
                    registrationCId: regC?.id || '',
                    registrationDId: regD?.id || '',
                    participantAId: participant1Id,
                    participantBId: participant2Id,
                    participantCId: participant3Id,
                    participantDId: participant4Id,
                    participantAType: participant1Type,
                    participantBType: participant2Type,
                    participantCType: participant3Type,
                    participantDType: participant4Type,
                    timeSlotId: matchingWindow.id,
                    winnerId: match.winnerId,
                    winnerType: match.winnerType,
                    scoreNotes: match.scoreNotes
                  });
                }
              }
            }
          });

          // Delete invalid matches
          if (invalidMatches.length > 0) {
            console.log(`Found ${invalidMatches.length} invalid matches, deleting them...`);
            const deletePromises = invalidMatches.map(matchId =>
              apiCall(`/api/admin/games/${gameId}/matches?matchId=${matchId}`, {
                method: 'DELETE',
              })
            );
            
            try {
              await Promise.allSettled(deletePromises);
              console.log(`Successfully cleaned up ${invalidMatches.length} invalid matches`);
            } catch (error) {
              console.error('Error deleting invalid matches:', error);
            }
          }

          // Find and delete unused slots (slots that have no matches)
          try {
            console.log('Checking for unused slots to clean up...');
            const slotsResponse = await apiCall(`/api/admin/games/${gameId}/slots`);
            if (slotsResponse.ok) {
              const slotsData = await slotsResponse.json();
              if (slotsData.success && slotsData.slots) {
                const unusedSlots: string[] = [];
                
                // Check each slot to see if it has any matches
                for (const slot of slotsData.slots) {
                  const hasMatches = data.matches.some((match: any) =>
                    match.slot && match.slot.id === slot.id
                  );
                  
                  if (!hasMatches) {
                    console.log('Found unused slot:', {
                      slotId: slot.id,
                      startTime: slot.startTime,
                      endTime: slot.endTime,
                      timelineId: slot.timelineId
                    });
                    unusedSlots.push(slot.id);
                  }
                }
                
                // Delete unused slots
                if (unusedSlots.length > 0) {
                  console.log(`Found ${unusedSlots.length} unused slots, deleting them...`);
                  const deleteSlotPromises = unusedSlots.map(slotId =>
                    apiCall(`/api/admin/games/${gameId}/slots?slotId=${slotId}`, {
                      method: 'DELETE',
                    })
                  );
                  
                  try {
                    await Promise.allSettled(deleteSlotPromises);
                    console.log(`Successfully cleaned up ${unusedSlots.length} unused slots`);
                  } catch (error) {
                    console.error('Error deleting unused slots:', error);
                  }
                }
              }
            }
          } catch (error) {
            console.error('Error checking for unused slots:', error);
          }

          setScheduledMatches(scheduledMatchesData);
          setScheduledRegistrationIds(scheduledRegIds);
        }
      }
    } catch (error) {
      console.error('Error loading existing matches:', error);
    } finally {
      // Restore scroll positions after loading
      restoreScrollPositions();
    }
  };

  const handleScheduleChange = (updatedSlots: TimeSlot[]) => {
    setTimeSlots(updatedSlots);
    
    // Extract all matches from updated slots
    const allMatches = updatedSlots.flatMap(slot => slot.matches);
    setMatches(allMatches);
  };


  const getFilteredRegistrations = () => {
    const baseFiltered = registrations.filter(reg => {
      const matchesSearch = searchTerm === '' ||
        reg.user.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        reg.user.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        reg.user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (reg.team?.name.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesLevel = levelFilter === 'All' || reg.level === levelFilter;
      
      return matchesSearch && matchesLevel;
    });

    // Apply contest type-specific filtering
    if (!gameData) return baseFiltered.sort((a, b) => {
      // Sort teams in ascending order
      const nameA = a.mode === 'TEAM' && a.team ? a.team.name : `${a.user.firstName} ${a.user.lastName}`;
      const nameB = b.mode === 'TEAM' && b.team ? b.team.name : `${b.user.firstName} ${b.user.lastName}`;
      return nameA.localeCompare(nameB);
    });

    const filtered = baseFiltered.filter(reg => {
      // Get participant ID
      const participantId = reg.mode === 'TEAM' && reg.team ? reg.team.id : reg.user.id;
      
      // Find participant status
      const participantStatus = participantStatuses.find(p => p.id === participantId);
      
      // If no status found, participant hasn't been scheduled yet - allow scheduling
      if (!participantStatus) {
        return true;
      }
      
      // Hide participants with unconcluded matches (active matches) for non-Round Robin contest types
      // For Round Robin, allow participants with active matches to be shown
      if (participantStatus.hasActiveMatch &&
          gameData.contestType !== 'ROUND_ROBIN' &&
          gameData.contestType !== 'ROUND_ROBIN_HOME_AWAY') {
        return false;
      }
      
      // For single elimination, also check if eliminated
      if (gameData.contestType === 'SINGLE_ELIMINATION') {
        // Hide if eliminated
        return !participantStatus.isEliminated;
      }
      
      // For Round Robin, allow all participants (they can play multiple matches)
      if (gameData.contestType === 'ROUND_ROBIN' || gameData.contestType === 'ROUND_ROBIN_HOME_AWAY') {
        return true;
      }
      
      // For other contest types, use the validator
      const validationResult = ContestValidator.canParticipantBeScheduled(
        participantId,
        gameData.contestType,
        participantStatuses,
        [] // We'll pass actual matches when we have them
      );
      return validationResult.canSchedule;
    });

    // Sort the final filtered results in ascending order
    return filtered.sort((a, b) => {
      const nameA = a.mode === 'TEAM' && a.team ? a.team.name : `${a.user.firstName} ${a.user.lastName}`;
      const nameB = b.mode === 'TEAM' && b.team ? b.team.name : `${b.user.firstName} ${b.user.lastName}`;
      return nameA.localeCompare(nameB);
    });
  };

  const getUniqueLevels = () => {
    const levels = [...new Set(registrations.map(reg => reg.level))];
    return levels.sort();
  };

  // Helper function to count matches for round placement (completed matches + active matches count towards next round)
  const getParticipantMatchCount = (participantId: string): number => {
    const participantStatus = participantStatuses.find(p => p.id === participantId);
    if (!participantStatus) return 0;
    
    // Start with completed matches from participant status
    let completedMatches = participantStatus.totalMatches || 0;
    
    // Count active matches directly from actual matches array (not template matches)
    let activeMatchCount = 0;
    
    actualMatches.forEach((match) => {
      // Skip completed matches (they're already counted in totalMatches)
      if (match.winnerId) {
        return;
      }
      
      let isParticipantInMatch = false;
      
      // Check participantA (could be regular participant or JSON for participants 1 and 2)
      if (match.participantAType === 'FOUR_PARTICIPANT_DATA' && match.participantAId) {
        try {
          const participantAData = JSON.parse(match.participantAId);
          if (participantAData.participant1Id === participantId ||
              participantAData.participant2Id === participantId) {
            isParticipantInMatch = true;
          }
        } catch (e) {
          // If parsing fails, ignore
        }
      } else if (match.participantAId === participantId) {
        isParticipantInMatch = true;
      }
      
      // Check participantB (could be regular participant or JSON for participants 3 and 4)
      if (match.participantBType === 'FOUR_PARTICIPANT_DATA' && match.participantBId) {
        try {
          const participantBData = JSON.parse(match.participantBId);
          if (participantBData.participant3Id === participantId ||
              participantBData.participant4Id === participantId) {
            isParticipantInMatch = true;
          }
        } catch (e) {
          // If parsing fails, ignore
        }
      } else if (match.participantBId === participantId) {
        isParticipantInMatch = true;
      }
      
      // Count this active match if participant is involved
      if (isParticipantInMatch) {
        activeMatchCount++;
      }
    });
    
    // Active matches count towards the next round
    // So we add them to completed matches for round placement
    const totalCount = completedMatches + activeMatchCount;
    
    return totalCount;
  };

  // Function to get the sequential match occurrence number for a participant across ALL dates
  const getParticipantTimelineMatchCount = (participantId: string, participantType: string, currentTimeSlotId: string, timeWindow: any): number => {
    // Create a comprehensive list of all matches from all sources
    const allMatches: any[] = [];
    
    // Add matches from actualMatches (database - all dates)
    if (actualMatches && actualMatches.length > 0) {
      actualMatches.forEach(match => {
        if (match.slotId && match.slot?.startTime) {
          allMatches.push({
            id: match.id,
            slotId: match.slotId,
            participantAId: match.participantAId,
            participantAType: match.participantAType,
            participantBId: match.participantBId,
            participantBType: match.participantBType,
            participantCId: match.participantCId,
            participantCType: match.participantCType,
            participantDId: match.participantDId,
            participantDType: match.participantDType,
            startTime: new Date(match.slot.startTime),
            endTime: new Date(match.slot.endTime),
            timelineId: match.slot.timelineId,
            source: 'database'
          });
        }
      });
    }
    
    // Add matches from scheduledMatches (current view - might include unsaved matches)
    if (scheduledMatches && scheduledMatches.length > 0) {
      scheduledMatches.forEach(match => {
        // Only add if not already in database matches
        const existsInDB = allMatches.some(dbMatch => dbMatch.slotId === match.timeSlotId);
        if (!existsInDB) {
          const timeSlot = timeSlots.find(slot => slot.id === match.timeSlotId);
          if (timeSlot) {
            allMatches.push({
              id: match.id,
              slotId: match.timeSlotId,
              participantAId: match.participantAId,
              participantAType: match.participantAType,
              participantBId: match.participantBId,
              participantBType: match.participantBType,
              participantCId: match.participantCId,
              participantCType: match.participantCType,
              participantDId: match.participantDId,
              participantDType: match.participantDType,
              startTime: timeSlot.startTime,
              endTime: timeSlot.endTime,
              timelineId: timeSlot.timelineId,
              source: 'current'
            });
          }
        }
      });
    }
    
    // Filter matches where this participant appears and sort by time
    const participantMatches = allMatches
      .filter(match => {
        const isParticipantA = match.participantAId === participantId && match.participantAType === participantType;
        const isParticipantB = match.participantBId === participantId && match.participantBType === participantType;
        const isParticipantC = match.participantCId === participantId && match.participantCType === participantType;
        const isParticipantD = match.participantDId === participantId && match.participantDType === participantType;
        
        return isParticipantA || isParticipantB || isParticipantC || isParticipantD;
      })
      .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
    
    // Find the current match by matching time properties instead of slotId
    // For generated time windows, we need to match by startTime, endTime, and timelineId
    const currentMatchIndex = participantMatches.findIndex(match => {
      // If this is a database match, we can't directly match the slotId because formats are different
      // Instead, we match by time properties
      if (match.source === 'database') {
        // Check if the timeWindow.startTime matches the match.startTime
        // and timeWindow.endTime matches the match.endTime
        // and timeWindow.timelineId matches the match.timelineId
        return (
          timeWindow.startTime.getTime() === match.startTime.getTime() &&
          timeWindow.endTime.getTime() === match.endTime.getTime() &&
          timeWindow.timelineId === match.timelineId
        );
      } else {
        // For current matches, we can match by slotId
        return match.slotId === currentTimeSlotId;
      }
    });
    
    if (currentMatchIndex >= 0) {
      return currentMatchIndex + 1;
    }
    
    // Final fallback: return 0 to hide the badge if we can't match
    return 0;
  };

  // Function to check if a participant has a phone number
  const participantHasPhoneNumber = (participantId: string, participantType: string): boolean => {
    if (participantType === 'USER') {
      const registration = registrations.find(reg => reg.user?.id === participantId);
      return registration?.user?.phone ? true : false;
    } else if (participantType === 'TEAM') {
      const registration = registrations.find(reg => reg.team?.id === participantId);
      return registration?.team?.leader?.phone ? true : false;
    }
    return false;
  };

  // Helper function to group participants by rounds based on match count
  const getParticipantsByRounds = (filteredRegistrations: Registration[]) => {
    const roundGroups: {[key: number]: Registration[]} = {};
    
    filteredRegistrations.forEach(registration => {
      const participantId = registration.mode === 'TEAM' && registration.team ? registration.team.id : registration.user.id;
      const matchCount = getParticipantMatchCount(participantId);
      const round = matchCount + 1; // Round 1 = 0 matches, Round 2 = 1 match, etc.
      
      if (!roundGroups[round]) {
        roundGroups[round] = [];
      }
      roundGroups[round].push(registration);
    });
    
    return roundGroups;
  };

  // Helper function to check if a round section should be shown (collapsed by default)
  const isRoundSectionExpanded = (round: number): boolean => {
    return roundSectionStates[round] ?? false;
  };

  // Helper function to toggle round section visibility
  const toggleRoundSection = (round: number) => {
    setRoundSectionStates(prev => ({
      ...prev,
      [round]: !prev[round]
    }));
  };

  const getRegistrationStats = () => {
    const total = registrations.length;
    const individual = registrations.filter(reg => reg.mode === 'INDIVIDUAL').length;
    const team = registrations.filter(reg => reg.mode === 'TEAM').length;
    const complete = registrations.filter(reg => reg.isComplete).length;
    const incomplete = registrations.filter(reg => !reg.isComplete).length;
    const scheduled = matches.length;
    
    return { total, individual, team, complete, incomplete, scheduled };
  };

  const getAvailableDates = () => {
    if (!gameData?.category) return [];
    
    const dates = [];
    const startDate = new Date(gameData.category.startDate);
    const endDate = new Date(gameData.category.endDate);
    
    for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
      dates.push(new Date(date));
    }
    
    return dates;
  };

  const getFilteredTimeSlots = () => {
    if (!selectedDate) return [];
    
    const selectedDateObj = new Date(selectedDate);
    return timeSlots.filter(slot => {
      const slotDate = new Date(slot.startTime);
      return slotDate.toDateString() === selectedDateObj.toDateString();
    });
  };

  const getTimeWindows = () => {
    if (!gameData?.category || !selectedDate || !gameData.avgGameTime) return [];
    
    const selectedDateObj = new Date(selectedDate);
    
    // Validate that selectedDateObj is a valid date
    if (isNaN(selectedDateObj.getTime())) {
      console.error('Invalid selectedDate:', selectedDate);
      return [];
    }
    
    const timeWindows = [];
    const avgGameTimeMs = gameData.avgGameTime * 60 * 1000; // Convert minutes to milliseconds
    
    // Use real daily windows from category data
    const dailyWindows = gameData.category.dailyWindows || [];
    
    if (dailyWindows.length === 0) {
      // Fallback to default time windows if none configured (9 AM to 6 PM)
      const startTime = new Date(selectedDateObj);
      startTime.setHours(9, 0, 0, 0);
      
      const endTime = new Date(selectedDateObj);
      endTime.setHours(18, 0, 0, 0);
      
      // Break down the entire day into game-time slots
      let currentTime = new Date(startTime);
      let slotIndex = 0;
      
      while (currentTime < endTime) {
        const slotEnd = new Date(currentTime.getTime() + avgGameTimeMs);
        
        if (slotEnd <= endTime) {
          timeWindows.push({
            id: `${selectedDateObj.toDateString()}-${selectedTimeline}-${slotIndex}`,
            timelineId: selectedTimeline,
            startTime: new Date(currentTime),
            endTime: slotEnd,
            label: `${currentTime.toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
              hour12: true
            })} - ${slotEnd.toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
              hour12: true
            })}`
          });
        }
        
        currentTime = slotEnd;
        slotIndex++;
      }
    } else {
      // Use configured daily windows and break them down by average game time
      dailyWindows.forEach((window, windowIndex) => {
        const windowStart = new Date(selectedDateObj);
        const [startHour, startMinute] = window.start.split(':').map(Number);
        windowStart.setHours(startHour, startMinute, 0, 0);
        
        const windowEnd = new Date(selectedDateObj);
        const [endHour, endMinute] = window.end.split(':').map(Number);
        windowEnd.setHours(endHour, endMinute, 0, 0);
        
        // Break down this window into game-time slots
        let currentTime = new Date(windowStart);
        let slotIndex = 0;
        
        while (currentTime < windowEnd) {
          const slotEnd = new Date(currentTime.getTime() + avgGameTimeMs);
          
          if (slotEnd <= windowEnd) {
            timeWindows.push({
              id: `${selectedDateObj.toDateString()}-${selectedTimeline}-${windowIndex}-${slotIndex}`,
              timelineId: selectedTimeline,
              startTime: new Date(currentTime),
              endTime: slotEnd,
              label: `${currentTime.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
              })} - ${slotEnd.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
              })}`
            });
          }
          
          currentTime = slotEnd;
          slotIndex++;
        }
      });
    }
    
    return timeWindows;
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && (over.id.toString().startsWith('timeline-left-') || over.id.toString().startsWith('timeline-right-') ||
                 over.id.toString().startsWith('timeline-c-') || over.id.toString().startsWith('timeline-d-'))) {
      const isLeftSide = over.id.toString().startsWith('timeline-left-');
      const isRightSide = over.id.toString().startsWith('timeline-right-');
      const isCSlot = over.id.toString().startsWith('timeline-c-');
      const isDSlot = over.id.toString().startsWith('timeline-d-');
      
      let side: 'A' | 'B' | 'C' | 'D';
      let timeSlotId: string;
      
      if (isLeftSide) {
        side = 'A';
        timeSlotId = over.id.toString().replace('timeline-left-', '');
      } else if (isRightSide) {
        side = 'B';
        timeSlotId = over.id.toString().replace('timeline-right-', '');
      } else if (isCSlot) {
        side = 'C';
        timeSlotId = over.id.toString().replace('timeline-c-', '');
      } else {
        side = 'D';
        timeSlotId = over.id.toString().replace('timeline-d-', '');
      }
      const registration = registrations.find(reg => reg.id === active.id);
      
      if (registration) {
        try {
          // Find the corresponding time window to get start/end times
          const generatedTimeWindows = getTimeWindows();
          const timeWindow = generatedTimeWindows.find((tw: any) => tw.id === timeSlotId);
          if (!timeWindow) {
            console.error('Time window not found for slot:', timeSlotId);
            setActiveId(null);
            return;
          }

          // Validate that timeWindow has valid dates
          if (isNaN(timeWindow.startTime.getTime()) || isNaN(timeWindow.endTime.getTime())) {
            console.error('Invalid dates in timeWindow:', timeWindow);
            showError('Invalid time slot selected. Please try again.', 'Invalid Time Slot');
            setActiveId(null);
            return;
          }

          // Determine participant type and ID
          const participantType = registration.mode === 'TEAM' ? 'TEAM' : 'USER';
          const participantId = registration.mode === 'TEAM' && registration.team
            ? registration.team.id
            : registration.user.id;

          // Check if there's already a match for this time slot and validate against self-scheduling
          const existingMatch = scheduledMatches.find(match => match.timeSlotId === timeSlotId);
          if (existingMatch) {
            // For 1v1v1v1 format, check if the specific slot position is already occupied
            if (gameData?.contestType === 'SINGLE_ELIMINATION_1V1V1V1') {
              let isSlotOccupied = false;
              
              if (side === 'A' || side === 'B') {
                // Check participantAId JSON data
                if (existingMatch.participantAType === 'FOUR_PARTICIPANT_DATA' && existingMatch.participantAId && existingMatch.participantAId !== 'TBD') {
                  try {
                    const participantAData = JSON.parse(existingMatch.participantAId);
                    if (side === 'A' && participantAData.participant1Id && participantAData.participant1Id !== 'TBD') {
                      isSlotOccupied = true;
                    }
                    if (side === 'B' && participantAData.participant2Id && participantAData.participant2Id !== 'TBD') {
                      isSlotOccupied = true;
                    }
                  } catch (e) {
                    // If JSON parsing fails, continue with validation
                  }
                }
              } else {
                // Check participantBId JSON data for sides C and D
                if (existingMatch.participantBType === 'FOUR_PARTICIPANT_DATA' && existingMatch.participantBId && existingMatch.participantBId !== 'TBD') {
                  try {
                    const participantBData = JSON.parse(existingMatch.participantBId);
                    if (side === 'C' && participantBData.participant3Id && participantBData.participant3Id !== 'TBD') {
                      isSlotOccupied = true;
                    }
                    if (side === 'D' && participantBData.participant4Id && participantBData.participant4Id !== 'TBD') {
                      isSlotOccupied = true;
                    }
                  } catch (e) {
                    // If JSON parsing fails, continue with validation
                  }
                }
              }
              
              if (isSlotOccupied) {
                showError('This slot position is already occupied by another participant', 'Slot Already Occupied');
                setActiveId(null);
                return;
              }
            } else {
              // Original validation for 2-participant matches
              if ((side === 'A' && existingMatch.participantAId && existingMatch.participantAId !== 'TBD') ||
                  (side === 'B' && existingMatch.participantBId && existingMatch.participantBId !== 'TBD')) {
                showError('This slot position is already occupied by another participant', 'Slot Already Occupied');
                setActiveId(null);
                return;
              }
            }
            
            // Check all other participants in the match to prevent self-scheduling
            const otherParticipantIds = [
              side !== 'A' ? existingMatch.participantAId : null,
              side !== 'B' ? existingMatch.participantBId : null,
              side !== 'C' ? existingMatch.participantCId : null,
              side !== 'D' ? existingMatch.participantDId : null
            ].filter(id => id && id !== 'TBD');
            
            if (otherParticipantIds.includes(participantId)) {
              showError('A participant cannot be scheduled to play against themselves', 'Self-Scheduling Not Allowed');
              setActiveId(null);
              return;
            }
          }

          // Validate participant can be scheduled (client-side check)
          const participantStatus = participantStatuses.find(p => p.id === participantId);
          if (participantStatus && gameData?.contestType) {
            const validationResult = ContestValidator.canParticipantBeScheduled(
              participantId,
              gameData.contestType,
              participantStatuses,
              scheduledMatches.map(m => ({
                id: m.id,
                participantAId: m.participantAId || '',
                participantBId: m.participantBId || '',
                participantCId: m.participantCId || '',
                participantDId: m.participantDId || '',
                winnerId: m.winnerId,
                isCompleted: !!m.winnerId,
                contestType: gameData.contestType
              }))
            );

            if (!validationResult.canSchedule) {
              showError(`Cannot schedule participant: ${validationResult.reason}`, 'Scheduling Validation');
              setActiveId(null);
              return;
            }
          }

          // Make API call to create/update match in real-time
          const response = await apiCall(`/api/admin/games/${gameId}/matches`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              timeSlotId,
              participantId,
              participantType,
              side,
              startTime: timeWindow.startTime.toISOString(),
              endTime: timeWindow.endTime.toISOString(),
              timelineId: selectedTimeline,
              overrideConflicts
            }),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to create/update match');
          }

          const result = await response.json();
          
          // Update local state
          const participantName = registration.mode === 'TEAM' && registration.team
            ? registration.team.name
            : formatParticipantName(registration.user.firstName, registration.user.lastName);
          
          // Check if there's already a match for this time slot
          const existingMatchIndex = scheduledMatches.findIndex(match => match.timeSlotId === timeSlotId);
          
          if (existingMatchIndex >= 0) {
            // Update existing match
            const updatedMatches = [...scheduledMatches];
            const participantId = registration.mode === 'TEAM' && registration.team
              ? registration.team.id
              : registration.user.id;
            const participantType = registration.mode === 'TEAM' ? 'TEAM' : 'USER';
            
            if (side === 'A') {
              updatedMatches[existingMatchIndex].participantA = participantName;
              updatedMatches[existingMatchIndex].registrationAId = registration.id;
              updatedMatches[existingMatchIndex].participantAId = participantId;
              updatedMatches[existingMatchIndex].participantAType = participantType;
            } else if (side === 'B') {
              updatedMatches[existingMatchIndex].participantB = participantName;
              updatedMatches[existingMatchIndex].registrationBId = registration.id;
              updatedMatches[existingMatchIndex].participantBId = participantId;
              updatedMatches[existingMatchIndex].participantBType = participantType;
            } else if (side === 'C') {
              updatedMatches[existingMatchIndex].participantC = participantName;
              updatedMatches[existingMatchIndex].registrationCId = registration.id;
              updatedMatches[existingMatchIndex].participantCId = participantId;
              updatedMatches[existingMatchIndex].participantCType = participantType;
            } else if (side === 'D') {
              updatedMatches[existingMatchIndex].participantD = participantName;
              updatedMatches[existingMatchIndex].registrationDId = registration.id;
              updatedMatches[existingMatchIndex].participantDId = participantId;
              updatedMatches[existingMatchIndex].participantDType = participantType;
            }
            setScheduledMatches(updatedMatches);
          } else {
            // Create new match
            const participantId = registration.mode === 'TEAM' && registration.team
              ? registration.team.id
              : registration.user.id;
            const participantType = registration.mode === 'TEAM' ? 'TEAM' : 'USER';
            
            const newMatch = {
              id: result.match.id,
              participantA: side === 'A' ? participantName : '',
              participantB: side === 'B' ? participantName : '',
              participantC: side === 'C' ? participantName : '',
              participantD: side === 'D' ? participantName : '',
              registrationAId: side === 'A' ? registration.id : '',
              registrationBId: side === 'B' ? registration.id : '',
              registrationCId: side === 'C' ? registration.id : '',
              registrationDId: side === 'D' ? registration.id : '',
              participantAId: side === 'A' ? participantId : '',
              participantBId: side === 'B' ? participantId : '',
              participantCId: side === 'C' ? participantId : '',
              participantDId: side === 'D' ? participantId : '',
              participantAType: side === 'A' ? participantType : '',
              participantBType: side === 'B' ? participantType : '',
              participantCType: side === 'C' ? participantType : '',
              participantDType: side === 'D' ? participantType : '',
              timeSlotId
            };
            setScheduledMatches(prev => [...prev, newMatch]);
          }
          
          // Add registration to scheduled list
          setScheduledRegistrationIds(prev => new Set([...prev, registration.id]));
          
          // Reload matches to update participant statuses
          await loadExistingMatches();

        } catch (error) {
          console.error('Error creating/updating match:', error);
          const errorMessage = error instanceof Error ? error.message : 'Failed to create/update match';
          console.log('Calling showError with message:', errorMessage);
          try {
            showError(errorMessage, 'Scheduling Error');
            console.log('showError called successfully');
          } catch (alertError) {
            console.error('Error calling showError:', alertError);
            // Fallback to browser alert
            alert(`Scheduling Error: ${errorMessage}`);
          }
        }
      }
    }
    
    setActiveId(null);
  };

  // Click handlers for participant selection
  const handleParticipantClick = (registrationId: string) => {
    // Don't allow clicks if data is still loading
    if (loading || !gameData) {
      return;
    }

    // Check if participant can be scheduled based on contest type
    const registration = registrations.find(reg => reg.id === registrationId);
    if (registration && gameData) {
      const participant = {
        id: registration.mode === 'TEAM' && registration.team ? registration.team.id : registration.user.id,
        name: registration.mode === 'TEAM' && registration.team ? registration.team.name : formatParticipantName(registration.user.firstName, registration.user.lastName),
        type: registration.mode === 'TEAM' ? 'team' as const : 'user' as const,
        level: registration.level,
        isEliminated: false, // This would be updated from match results
        wins: 0,
        losses: 0,
        score: 0
      };

      const validationResult = ContestValidator.canParticipantBeScheduled(
        participant.id,
        gameData.contestType,
        participantStatuses,
        [] // We'll pass actual matches when we have them
      );
      const canSchedule = validationResult.canSchedule;

      if (!canSchedule) {
        showError(validationResult.reason || getContestTypeMessage(gameData.contestType), 'Scheduling Validation');
        return;
      }
    }
    
    setSelectedParticipant(selectedParticipant === registrationId ? null : registrationId);
  };

  const getContestTypeMessage = (contestType: string): string => {
    const contestInfo = ContestValidator.getContestTypeInfo(contestType);
    return `${contestInfo.name}: This participant cannot be scheduled at this time.`;
  };

  const handleTimeSlotClick = async (timeSlotId: string, isLeftSide: boolean, side?: 'A' | 'B' | 'C' | 'D') => {
    if (selectedParticipant) {
      const registration = registrations.find(reg => reg.id === selectedParticipant);
      
      if (registration) {
        try {
          // Find the corresponding time window to get start/end times
          const generatedTimeWindows = getTimeWindows();
          const timeWindow = generatedTimeWindows.find((tw: any) => tw.id === timeSlotId);
          if (!timeWindow) {
            console.error('Time window not found for slot:', timeSlotId);
            return;
          }

          // Validate that timeWindow has valid dates
          if (isNaN(timeWindow.startTime.getTime()) || isNaN(timeWindow.endTime.getTime())) {
            console.error('Invalid dates in timeWindow:', timeWindow);
            showError('Invalid time slot selected. Please try again.', 'Invalid Time Slot');
            return;
          }

          // Determine participant type and ID
          const participantType = registration.mode === 'TEAM' ? 'TEAM' : 'USER';
          const participantId = registration.mode === 'TEAM' && registration.team
            ? registration.team.id
            : registration.user.id;

          // Check if there's already a match for this time slot and validate against self-scheduling
          const existingMatch = scheduledMatches.find(match => match.timeSlotId === timeSlotId);
          if (existingMatch) {
            const otherParticipantId = isLeftSide ? existingMatch.participantBId : existingMatch.participantAId;
            if (otherParticipantId && otherParticipantId !== 'TBD' && otherParticipantId === participantId) {
              showError('A participant cannot be scheduled to play against themselves', 'Self-Scheduling Not Allowed');
              setSelectedParticipant(null);
              return;
            }
          }

          // Validate participant can be scheduled (client-side check)
          const participantStatus = participantStatuses.find(p => p.id === participantId);
          if (participantStatus && gameData?.contestType) {
            const validationResult = ContestValidator.canParticipantBeScheduled(
              participantId,
              gameData.contestType,
              participantStatuses,
              scheduledMatches.map(m => ({
                id: m.id,
                participantAId: m.participantAId || '',
                participantBId: m.participantBId || '',
                winnerId: m.winnerId,
                isCompleted: !!m.winnerId,
                contestType: gameData.contestType
              }))
            );

            if (!validationResult.canSchedule) {
              showError(`Cannot schedule participant: ${validationResult.reason}`, 'Scheduling Validation');
              setSelectedParticipant(null);
              return;
            }
          }

          // Make API call to create/update match
          const response = await apiCall(`/api/admin/games/${gameId}/matches`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              timeSlotId,
              participantId,
              participantType,
              side: side || (isLeftSide ? 'A' : 'B'),
              startTime: timeWindow.startTime.toISOString(),
              endTime: timeWindow.endTime.toISOString(),
              timelineId: selectedTimeline,
              overrideConflicts
            }),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to create/update match');
          }

          // Clear selection and reload data
          setSelectedParticipant(null);
          await loadScheduleData();
        } catch (error) {
          console.error('Error scheduling match:', error);
          const errorMessage = error instanceof Error ? error.message : 'Failed to schedule match';
          console.log('Calling showError with message:', errorMessage);
          try {
            showError(errorMessage, 'Scheduling Error');
            console.log('showError called successfully');
          } catch (alertError) {
            console.error('Error calling showError:', alertError);
            // Fallback to browser alert
            alert(`Scheduling Error: ${errorMessage}`);
          }
        }
      }
    }
  };

  // Update participant statuses after winner changes
  const updateParticipantStatuses = (match: ScheduledMatch, winnerId: string | undefined, participantId: string, side: 'A' | 'B' | 'C' | 'D') => {
    setParticipantStatuses(prev => {
      return prev.map(participant => {
        // Get all participant IDs from the match
        const participantAId = match.participantAId;
        const participantBId = match.participantBId;
        const participantCId = match.participantCId;
        const participantDId = match.participantDId;
        
        // Check if this participant is involved in the match
        if (participant.id === participantAId || participant.id === participantBId ||
            participant.id === participantCId || participant.id === participantDId) {
          // For 1 Loser mode in 1v1v1v1, invert the winner logic
          const isOneLoserMode = gameData?.contestType === 'SINGLE_ELIMINATION_1V1V1V1' && gameData?.oneLoserMode;
          
          const isWinner = isOneLoserMode
            ? participant.id !== winnerId  // In 1 Loser mode, NOT being the winnerId means you won
            : participant.id === winnerId; // Normal mode, being the winnerId means you won
          
          const wasWinner = isOneLoserMode
            ? participant.id !== match.winnerId  // In 1 Loser mode, NOT being the winnerId means you were the winner
            : participant.id === match.winnerId; // Normal mode, being the winnerId means you were the winner
          
          // Calculate new stats
          let newWins = participant.wins;
          let newLosses = participant.losses;
          let newTotalMatches = participant.totalMatches;
          let newIsEliminated = participant.isEliminated;
          let newHasActiveMatch = participant.hasActiveMatch;
          
          if (winnerId) {
            // Setting a winner
            if (!match.winnerId) {
              // Match was previously incomplete, now has a winner
              newTotalMatches = participant.totalMatches + 1;
              newHasActiveMatch = false;
              
              if (isWinner) {
                newWins = participant.wins + 1;
                newIsEliminated = false; // Winner is not eliminated
              } else {
                newLosses = participant.losses + 1;
                newIsEliminated = true; // Loser is eliminated in single elimination
              }
            } else if (wasWinner !== isWinner) {
              // Winner changed from one participant to another
              if (isWinner) {
                // This participant is now the winner
                newWins = participant.wins + 1;
                newLosses = Math.max(0, participant.losses - 1);
                newIsEliminated = false;
              } else {
                // This participant is no longer the winner
                newWins = Math.max(0, participant.wins - 1);
                newLosses = participant.losses + 1;
                newIsEliminated = true;
              }
            }
          } else {
            // Clearing winner (match becomes incomplete again)
            if (match.winnerId) {
              // Match was previously complete, now incomplete
              newTotalMatches = Math.max(0, participant.totalMatches - 1);
              newHasActiveMatch = true;
              
              if (wasWinner) {
                newWins = Math.max(0, participant.wins - 1);
              } else {
                newLosses = Math.max(0, participant.losses - 1);
              }
              newIsEliminated = false; // No one is eliminated if match is incomplete
            }
          }
          
          return {
            ...participant,
            wins: newWins,
            losses: newLosses,
            totalMatches: newTotalMatches,
            isEliminated: newIsEliminated,
            hasActiveMatch: newHasActiveMatch
          };
        }
        
        return participant;
      });
    });
  };

  // Handle winner toggle
  const handleWinnerToggle = async (match: ScheduledMatch, side: 'A' | 'B' | 'C' | 'D') => {
    // Prevent multiple simultaneous updates for the same match
    if (updatingWinner === match.id) return;
    
    const registration = registrations.find(reg => {
      switch (side) {
        case 'A': return reg.id === match.registrationAId;
        case 'B': return reg.id === match.registrationBId;
        case 'C': return reg.id === match.registrationCId;
        case 'D': return reg.id === match.registrationDId;
        default: return false;
      }
    });
    
    if (!registration) return;

    const participantName = registration.mode === 'TEAM' && registration.team
      ? registration.team.name
      : formatParticipantName(registration.user.firstName, registration.user.lastName);

    // For scoring contests, show score dialog
    if (gameData?.contestType === 'SCORING') {
      setScoreDialogData({
        match,
        side,
        participantName
      });
      setScoreInput('');
      setShowScoreDialog(true);
      return;
    }
    
    try {
      setUpdatingWinner(match.id);

      const participantId = registration.mode === 'TEAM' && registration.team
        ? registration.team.id
        : registration.user.id;
      const participantType = registration.mode === 'TEAM' ? 'TEAM' : 'USER';

      // Toggle winner - if already winner, clear winner; otherwise set as winner
      const isCurrentWinner = match.winnerId === participantId;
      const winnerId = isCurrentWinner ? undefined : participantId;
      const winnerType = isCurrentWinner ? undefined : participantType;

      console.log('Winner toggle:', {
        matchId: match.id,
        participantId,
        isCurrentWinner,
        winnerId,
        winnerType,
        currentWinnerId: match.winnerId
      });

      // Make API call to update winner
      const response = await apiCall(`/api/admin/games/${gameId}/matches`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          matchId: match.id,
          winnerId,
          winnerType
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update winner');
      }

      // Update local state immediately
      setScheduledMatches(prev => {
        const updatedMatches = prev.map(m =>
          m.id === match.id
            ? { ...m, winnerId, winnerType }
            : m
        );
        
        console.log('Updated match state:', {
          matchId: match.id,
          oldWinnerId: match.winnerId,
          newWinnerId: winnerId,
          updatedMatch: updatedMatches.find(m => m.id === match.id)
        });
        
        return updatedMatches;
      });

      // Update participant statuses for single elimination and 1v1v1v1 with 1 Loser mode
      if (gameData?.contestType === 'SINGLE_ELIMINATION' ||
          (gameData?.contestType === 'SINGLE_ELIMINATION_1V1V1V1' && gameData?.oneLoserMode)) {
        updateParticipantStatuses(match, winnerId, participantId, side);
      }

      // Reload the schedule data to reflect changes in registration availability
      await loadScheduleData();

    } catch (error) {
      console.error('Error updating winner:', error);
      // TODO: Show error message to user
    } finally {
      setUpdatingWinner(null);
    }
  };

  // Handle score submission for scoring contests
  const handleScoreSubmit = async () => {
    if (!scoreDialogData || !scoreInput.trim()) return;

    const { match, side } = scoreDialogData;
    const registration = registrations.find(reg =>
      reg.id === (side === 'A' ? match.registrationAId : match.registrationBId)
    );
    
    if (!registration) return;

    try {
      setUpdatingWinner(match.id);

      const participantId = registration.mode === 'TEAM' && registration.team
        ? registration.team.id
        : registration.user.id;
      const participantType = registration.mode === 'TEAM' ? 'TEAM' : 'USER';

      // Make API call to update winner with score
      const response = await apiCall(`/api/admin/games/${gameId}/matches`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          matchId: match.id,
          winnerId: participantId,
          winnerType: participantType,
          scoreNotes: scoreInput.trim()
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update winner and score');
      }

      // Update local state immediately
      setScheduledMatches(prev => {
        const updatedMatches = prev.map(m =>
          m.id === match.id
            ? { ...m, winnerId: participantId, winnerType: participantType, scoreNotes: scoreInput.trim() }
            : m
        );
        
        return updatedMatches;
      });

      // Close dialog
      setShowScoreDialog(false);
      setScoreDialogData(null);
      setScoreInput('');

      // Reload the schedule data to reflect changes in registration availability
      await loadScheduleData();

    } catch (error) {
      console.error('Error updating winner and score:', error);
      // TODO: Show error message to user
    } finally {
      setUpdatingWinner(null);
    }
  };

  // Handle unscheduling a participant
  const handleUnschedule = async (match: ScheduledMatch, side: 'A' | 'B' | 'C' | 'D') => {
    try {
      console.log('Unscheduling participant:', {
        matchId: match.id,
        side,
        winnerId: match.winnerId
      });

      // Only allow unscheduling if no winner is decided
      if (match.winnerId) {
        console.log('Cannot unschedule - winner already decided');
        return;
      }

      // Make API call to unschedule participant
      const response = await apiCall(`/api/admin/games/${gameId}/matches?matchId=${match.id}&side=${side}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to unschedule participant');
      }

      // Reload the schedule data to reflect changes
      await loadScheduleData();
    } catch (error) {
      console.error('Error unscheduling participant:', error);
    }
  };

  // Handle unscheduling a participant from score dialog (allows unscheduling winners)
  const handleUnscheduleFromScoreDialog = async (match: ScheduledMatch, side: 'A' | 'B' | 'C' | 'D') => {
    try {
      console.log('Unscheduling participant from score dialog:', {
        matchId: match.id,
        side,
        winnerId: match.winnerId
      });

      // Make API call to unschedule participant (no winner check)
      const response = await apiCall(`/api/admin/games/${gameId}/matches?matchId=${match.id}&side=${side}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to unschedule participant');
      }

      // Reload the schedule data to reflect changes
      await loadScheduleData();
    } catch (error) {
      console.error('Error unscheduling participant:', error);
      showError('Failed to unschedule participant. Please try again.', 'Unschedule Error');
    }
  };

  // Handle resetting all matches for this game across all dates and time windows
  const handleResetAll = async () => {
    try {
      console.log('Resetting all matches for game:', gameId);
      
      // Get all matches for this game from ALL timelines (not just current view)
      const allMatchesResponse = await apiCall(`/api/admin/games/${gameId}/matches`);
      if (!allMatchesResponse.ok) {
        showError('Failed to get match information. Please try again.', 'Data Loading Error');
        return;
      }
      
      const allMatchesData = await allMatchesResponse.json();
      const allMatches = allMatchesData.matches || [];
      
      // Filter out concluded matches (those with winners)
      const matchesToReset = allMatches.filter((match: any) => {
        // For all contest types, if there's a winnerId, the match is concluded
        return !match.winnerId;
      });
      
      if (matchesToReset.length === 0) {
        showError('No matches to reset. All scheduled matches have concluded.', 'Reset Information');
        return;
      }

      // Single confirmation with all details
      if (!confirm(`Are you sure you want to reset ALL matches for this game?\n\nThis will reset ${matchesToReset.length} non-concluded match(es) across all dates and time windows for this game.\n\nThis action cannot be undone.`)) {
        return;
      }
      
      // Delete all non-concluded matches by calling the API to delete entire matches
      console.log('Attempting to delete matches:', matchesToReset.map((m: any) => ({ id: m.id, contestType: gameData?.contestType })));
      
      const deletePromises = matchesToReset.map(async (match: any) => {
        console.log(`Deleting match ${match.id} for contest type ${gameData?.contestType}`);
        const response = await apiCall(`/api/admin/games/${gameId}/matches?matchId=${match.id}`, {
          method: 'DELETE',
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Failed to delete match ${match.id}:`, errorText);
          throw new Error(`Failed to delete match ${match.id}: ${errorText}`);
        }
        
        console.log(`Successfully deleted match ${match.id}`);
        return response;
      });

      const results = await Promise.allSettled(deletePromises);
      
      // Check for any failures
      const failures = results.filter(result => result.status === 'rejected');
      if (failures.length > 0) {
        console.error('Some matches failed to delete:', failures);
        showError(`Failed to reset ${failures.length} match(es). Please try again.`, 'Reset Error');
      } else {
        console.log(`Successfully deleted all ${matchesToReset.length} matches`);
        showError(`Successfully reset ${matchesToReset.length} match(es) for this game across all dates and time windows.`, 'Reset Success');
      }

      // Reload the schedule data to reflect changes
      await loadScheduleData();

    } catch (error) {
      console.error('Error resetting all matches:', error);
      showError('Failed to reset matches. Please try again.', 'Reset Error');
    }
  };

  // Function to resend match notification
  const handleResendNotification = async (matchId: string, participantName: string) => {
    try {
      const response = await apiCall(`/api/admin/games/${gameId}/matches/${matchId}/resend-notification`, {
        method: 'POST'
      });

      if (response.ok) {
        showError(`Match notification resent successfully to ${participantName}`, 'Notification Sent');
      } else {
        const error = await response.json();
        showError(error.error || 'Failed to resend notification', 'Notification Error');
      }
    } catch (error) {
      console.error('Error resending notification:', error);
      showError('Failed to resend notification. Please try again.', 'Notification Error');
    }
  };

  // Draggable Registration Component
  const DraggableRegistration = ({ registration }: { registration: Registration }) => {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({ id: registration.id });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.5 : 1,
    };

    const isSelected = selectedParticipant === registration.id;
    
    // Get participant status for contest type validation
    const participantId = registration.mode === 'TEAM' && registration.team
      ? registration.team.id
      : registration.user.id;
    
    const participantStatus = participantStatuses.find(p => p.id === participantId);
    const isEliminated = participantStatus?.isEliminated || false;
    const hasActiveMatch = participantStatus?.hasActiveMatch || false;
    // Check if data is still loading
    const isDataLoading = loading || !gameData;
    
    // For single elimination, use participant status instead of scheduled registration IDs
    // For Round Robin, allow participants with active matches to be scheduled
    const canSchedule = registration.isComplete && !isEliminated && !isDataLoading &&
      (gameData?.contestType === 'ROUND_ROBIN' || gameData?.contestType === 'ROUND_ROBIN_HOME_AWAY' || !hasActiveMatch);

    // Determine visual state based on contest type and participant status
    let statusColor = 'bg-slate-800/50 border-slate-600';
    let statusIcon = <GripVertical className="h-4 w-4 text-slate-400" />;
    let statusBadge = '';

    if (isDataLoading) {
      statusColor = 'bg-slate-800/20 border-slate-700/30 opacity-50';
      statusIcon = <Clock className="h-4 w-4 text-slate-500" />;
      statusBadge = 'Loading...';
    } else if (!registration.isComplete) {
      statusColor = 'bg-slate-800/30 border-slate-700/50 opacity-60';
      statusIcon = <X className="h-4 w-4 text-slate-500" />;
      statusBadge = 'Incomplete';
    } else if (isEliminated) {
      statusColor = 'bg-red-900/30 border-red-700/50 opacity-70';
      statusIcon = <X className="h-4 w-4 text-red-400" />;
      statusBadge = 'Eliminated';
    } else if (hasActiveMatch) {
      statusColor = 'bg-yellow-900/30 border-yellow-700/50';
      statusIcon = <Clock className="h-4 w-4 text-yellow-400" />;
      statusBadge = 'Active Match';
    }
    
    return (
      <Card
        ref={setNodeRef}
        style={style}
        className={`${statusColor} ${
          canSchedule && !isDataLoading ? 'hover:bg-slate-800/70 cursor-pointer' : 'cursor-not-allowed'
        } transition-colors ${
          isSelected ? 'ring-2 ring-blue-400 bg-blue-900/20' : ''
        }`}
        onClick={() => handleParticipantClick(registration.id)}
      >
        <CardContent className="p-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 flex-1 min-w-0">
              <div className="flex items-center space-x-1">
                {statusIcon}
                <div className="h-6 w-6 rounded-full bg-slate-700 flex items-center justify-center">
                  {registration.mode === 'TEAM' ? (
                    <Users className="h-3 w-3 text-blue-400" />
                  ) : (
                    <User className="h-3 w-3 text-green-400" />
                  )}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-white text-xs">
                  {registration.mode === 'TEAM' && registration.team
                    ? registration.team.name
                    : formatParticipantName(registration.user.firstName, registration.user.lastName)
                  }
                </div>
                {statusBadge && (
                  <div className="flex items-center space-x-1 mt-0.5" style={{ fontSize: '10px' }}>
                    <span className={`px-1 py-0.5 rounded ${
                      isEliminated ? 'bg-red-500/20 text-red-400' :
                      hasActiveMatch ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-slate-500/20 text-slate-400'
                    }`} style={{ fontSize: '9px' }}>
                      {statusBadge}
                    </span>
                  </div>
                )}
                {registration.team && (
                  <div className="text-slate-500 mt-0.5" style={{ fontSize: '10px' }}>
                    <div className="flex items-center space-x-1">
                      <span>{registration.team.actualSize} members</span>
                      {registration.team.actualSize < registration.team.requiredSize && (
                        <span className="text-red-400">({registration.team.requiredSize - registration.team.actualSize} needed)</span>
                      )}
                    </div>
                  </div>
                )}
                {participantStatus && (participantStatus.wins > 0 || participantStatus.losses > 0) && (
                  <div className="text-slate-500 mt-0.5" style={{ fontSize: '10px' }}>
                    W: {participantStatus.wins} L: {participantStatus.losses}
                  </div>
                )}
              </div>
            </div>
            
            {/* Vertical Level Tag */}
            <div className="ml-2 flex-shrink-0 h-full flex items-center">
              <div
                className={`px-0.5 py-1 rounded text-sm font-medium border ${getLevelColor(registration.level).bg} ${getLevelColor(registration.level).text} ${getLevelColor(registration.level).border}`}
              >
                {formatLevelInitial(registration.level)}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  // Droppable Timeline Slot Component with Left/Right Drop Zones
  const DroppableTimeSlot = ({ timeWindow }: { timeWindow: any }) => {
    const leftDroppable = useDroppable({
      id: `timeline-left-${timeWindow.id}`,
    });
    
    const rightDroppable = useDroppable({
      id: `timeline-right-${timeWindow.id}`,
    });

    const cDroppable = useDroppable({
      id: `timeline-c-${timeWindow.id}`,
    });

    const dDroppable = useDroppable({
      id: `timeline-d-${timeWindow.id}`,
    });

    // Find existing match for this time slot
    const existingMatch = scheduledMatches.find(match => match.timeSlotId === timeWindow.id);

    return (
      <div className="bg-slate-700/50 rounded-lg border-2 border-slate-600 min-h-[100px] p-3 relative">
        {/* Resend Match Notification Button - positioned on the left */}
        {existingMatch && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleResendNotification(existingMatch.id, 'all participants');
            }}
            className="absolute top-2 left-2 w-8 h-8 bg-blue-500 hover:bg-blue-600 text-white rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95 shadow-lg border-2 border-slate-800 z-40"
            title="Resend Match Notification to All Participants"
          >
            <Mail className="h-4 w-4" />
          </button>
        )}
        
        <div className="flex items-center justify-center mb-3">
          <span className="text-sm font-medium text-slate-300">
            {timeWindow.label}
          </span>
        </div>
        
        {/* Drop Zones - 1 for SCORING, 2 for regular, 4 for 1v1v1v1 */}
        <div className={`flex flex-col ${
          gameData?.contestType === 'SCORING'
            ? 'sm:grid sm:grid-cols-1'
            : gameData?.contestType === 'SINGLE_ELIMINATION_1V1V1V1'
              ? 'sm:grid sm:grid-cols-2 lg:grid-cols-4'
              : 'sm:grid sm:grid-cols-2'
        } gap-2 sm:gap-3 min-h-[60px] sm:min-h-[80px]`}>
          {/* Left Drop Zone */}
          <div
            ref={leftDroppable.setNodeRef}
            className={`border-2 border-dashed rounded-md p-2 transition-colors flex items-center justify-center min-h-[60px] sm:min-h-[80px] ${
              leftDroppable.isOver
                ? 'border-blue-400 bg-blue-400/10'
                : 'border-slate-500 hover:border-blue-400'
            } ${
              selectedParticipant && !existingMatch?.participantA
                ? 'cursor-pointer hover:bg-blue-400/5'
                : ''
            }`}
            onClick={loading ? undefined : () => !existingMatch?.participantA && handleTimeSlotClick(timeWindow.id, true)}
          >
            {existingMatch?.participantA ? (
              <div className="w-full relative">
                {/* Top Action Bar - Match Count Badge and Call/Email Button */}
                <div className="absolute -top-2 -left-2 flex items-center space-x-1 z-30">
                  {/* Match Count Badge */}
                  {(() => {
                    const matchCount = getParticipantTimelineMatchCount(existingMatch.participantAId || '', existingMatch.participantAType || '', timeWindow.id, timeWindow);
                    if (matchCount > 0) {
                      return (
                        <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold border-2 border-slate-800 shadow-lg">
                          {matchCount}
                        </div>
                      );
                    }
                    return null;
                  })()}
                  
                  {/* Call/Email Button */}
                  {(() => {
                    const hasPhone = participantHasPhoneNumber(existingMatch.participantAId || '', existingMatch.participantAType || '');
                    const registration = registrations.find(reg => {
                      if (existingMatch.participantAType === 'TEAM') {
                        return reg.mode === 'TEAM' && reg.team?.id === existingMatch.participantAId;
                      } else if (existingMatch.participantAType === 'USER') {
                        return reg.mode === 'INDIVIDUAL' && reg.user?.id === existingMatch.participantAId;
                      } else {
                        // Fallback for backward compatibility
                        return (reg.mode === 'TEAM' && reg.team?.id === existingMatch.participantAId) ||
                               (reg.mode === 'INDIVIDUAL' && reg.user?.id === existingMatch.participantAId);
                      }
                    });
                    
                    if (!registration) return null;
                    
                    const phoneNumber = existingMatch.participantAType === 'USER'
                      ? registration.user?.phone
                      : registration.team?.leader?.phone;
                      
                    const email = existingMatch.participantAType === 'USER'
                      ? registration.user?.email
                      : registration.team?.leader?.email;
                    
                    return (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (hasPhone && phoneNumber) {
                            window.open(`https://wa.me/${phoneNumber.replace(/[^0-9]/g, '')}`, '_blank');
                          } else if (email) {
                            window.open(`mailto:${email}`, '_blank');
                          }
                        }}
                        className="w-6 h-6 bg-green-500 hover:bg-green-600 text-white rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95 shadow-sm border-2 border-slate-800"
                        title={hasPhone && phoneNumber ? "Call via WhatsApp" : "Send Email"}
                      >
                        {hasPhone && phoneNumber ? (
                          <Phone className="h-3 w-3" />
                        ) : (
                          <span className="text-xs font-bold">@</span>
                        )}
                      </button>
                    );
                  })()}
                  
                </div>
                <button
                  onClick={loading ? undefined : () => handleWinnerToggle(existingMatch, 'A')}
                  disabled={loading || updatingWinner === existingMatch.id}
                  className={`text-xs sm:text-sm font-medium text-center p-1 rounded transition-colors w-full ${
                    updatingWinner === existingMatch.id
                      ? 'opacity-50 cursor-not-allowed'
                      : ''
                  } ${
                    // In 1 Loser mode, winner means loser (inverted logic)
                    gameData?.contestType === 'SINGLE_ELIMINATION_1V1V1V1' && gameData?.oneLoserMode
                      ? (existingMatch.winnerId && existingMatch.participantAId && existingMatch.winnerId === existingMatch.participantAId
                          ? 'text-red-100 bg-gradient-to-r from-red-500/60 to-red-700/60 border border-red-600/50'
                          : existingMatch.winnerId && existingMatch.participantAId && existingMatch.winnerId !== existingMatch.participantAId
                          ? 'text-white bg-gradient-to-r from-green-400/60 to-green-600/60 border border-green-500/50 shadow-lg'
                          : 'text-white hover:bg-slate-600/50')
                      : (existingMatch.winnerId && existingMatch.participantAId && existingMatch.winnerId === existingMatch.participantAId
                          ? 'text-white bg-gradient-to-r from-yellow-400/60 to-yellow-600/60 border border-yellow-500/50 shadow-lg'
                          : existingMatch.winnerId && existingMatch.participantAId && existingMatch.winnerId !== existingMatch.participantAId
                          ? 'text-red-100 bg-gradient-to-r from-red-500/60 to-red-700/60 border border-red-600/50'
                          : 'text-white hover:bg-slate-600/50')
                  }`}
                >
                  <div className="flex items-center justify-between w-full h-full">
                    <div className="flex-1 min-w-0 flex flex-col items-center justify-center space-y-1">
                      <div className="flex items-center space-x-1 flex-wrap">
                        {existingMatch.winnerId && existingMatch.participantAId && existingMatch.winnerId === existingMatch.participantAId && (
                          gameData?.contestType === 'SINGLE_ELIMINATION_1V1V1V1' && gameData?.oneLoserMode
                            ? <X className="h-3 w-3 text-red-400 flex-shrink-0" />
                            : <Trophy className="h-3 w-3 text-yellow-400 flex-shrink-0" />
                        )}
                        {existingMatch.winnerId && existingMatch.participantAId && existingMatch.winnerId !== existingMatch.participantAId && gameData?.contestType === 'SINGLE_ELIMINATION_1V1V1V1' && gameData?.oneLoserMode && (
                          <Trophy className="h-3 w-3 text-green-400 flex-shrink-0" />
                        )}
                        <span className="truncate min-w-0 font-medium">
                          {reformatExistingParticipantName(existingMatch.participantA, existingMatch.participantAId || '', existingMatch.participantAType || '', registrations)}
                        </span>
                      </div>
                      {/* Score display for scoring contests */}
                      {gameData?.contestType === 'SCORING' && existingMatch.scoreNotes && existingMatch.winnerId === existingMatch.participantAId && (
                        <div className="text-xs text-yellow-400 font-semibold bg-yellow-400/10 px-2 py-0.5 rounded border border-yellow-400/30">
                          Score: {existingMatch.scoreNotes}
                        </div>
                      )}
                      {(() => {
                        const registration = registrations.find(reg => {
                          if (existingMatch.participantAType === 'TEAM') {
                            return reg.mode === 'TEAM' && reg.team?.id === existingMatch.participantAId;
                          } else if (existingMatch.participantAType === 'USER') {
                            return reg.mode === 'INDIVIDUAL' && reg.user?.id === existingMatch.participantAId;
                          } else {
                            // Fallback for backward compatibility
                            return (reg.mode === 'TEAM' && reg.team?.id === existingMatch.participantAId) ||
                                   (reg.mode === 'INDIVIDUAL' && reg.user?.id === existingMatch.participantAId);
                          }
                        });
                        
                        if (!registration) return null;
                        
                        return (
                          <div className="flex flex-col items-center space-y-0.5">
                            {registration.mode === 'TEAM' && registration.team?.members && registration.team.members.length > 0 && (
                              <div className="flex flex-wrap gap-0.5 justify-center max-w-full">
                                {registration.team.members.slice(0, 2).map((member) => (
                                  <span
                                    key={member.id}
                                    className="inline-block px-1 py-0.5 bg-slate-600/50 text-slate-300 rounded text-xs truncate max-w-[60px]"
                                    title={`${member.firstName} ${member.lastName}`}
                                  >
                                    {formatParticipantName(member.firstName || '', member.lastName || '')}
                                  </span>
                                ))}
                                {registration.team.members.length > 2 && (
                                  <span
                                    className="inline-block px-1 py-0.5 bg-slate-500/50 text-slate-400 rounded text-xs"
                                    title={registration.team.members.slice(2).map(m => `${m.firstName} ${m.lastName}`).join(', ')}
                                  >
                                    +{registration.team.members.length - 2}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                    {(() => {
                      const registration = registrations.find(reg => {
                        if (existingMatch.participantAType === 'TEAM') {
                          return reg.mode === 'TEAM' && reg.team?.id === existingMatch.participantAId;
                        } else if (existingMatch.participantAType === 'USER') {
                          return reg.mode === 'INDIVIDUAL' && reg.user?.id === existingMatch.participantAId;
                        } else {
                          // Fallback for backward compatibility
                          return (reg.mode === 'TEAM' && reg.team?.id === existingMatch.participantAId) ||
                                 (reg.mode === 'INDIVIDUAL' && reg.user?.id === existingMatch.participantAId);
                        }
                      });
                      
                      if (!registration) return null;
                      
                      return (
                        <div className="ml-2 flex-shrink-0 h-full flex items-center space-x-1">
                          {/* Level Badge */}
                          <div
                            className={`px-1.5 py-2 rounded-md text-sm font-medium border shadow-sm ${getLevelColor(registration.level).bg} ${getLevelColor(registration.level).text} ${getLevelColor(registration.level).border}`}
                          >
                            {formatLevelInitial(registration.level)}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </button>
                {!existingMatch.winnerId && (
                  <button
                    onClick={loading ? undefined : (e) => {
                      e.stopPropagation();
                      handleUnschedule(existingMatch, 'A');
                    }}
                    disabled={loading}
                    className="absolute -top-1 -right-1 w-5 h-5 bg-red-500/80 hover:bg-red-500 text-white rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95 z-20 shadow-sm"
                    title="Unschedule participant"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            ) : (
              <div className="text-xs text-slate-400 text-center">
                {leftDroppable.isOver
                  ? 'Drop here'
                  : selectedParticipant
                    ? 'Click to schedule'
                    : window.innerWidth < 640 ? 'A' : 'Team A'
                }
              </div>
            )}
          </div>

          {/* Right Drop Zone - Hidden for Scoring Contest */}
          {gameData?.contestType !== 'SCORING' && (
            <div
              ref={rightDroppable.setNodeRef}
              className={`border-2 border-dashed rounded-md p-2 transition-colors flex items-center justify-center min-h-[60px] sm:min-h-[80px] ${
                rightDroppable.isOver
                  ? 'border-blue-400 bg-blue-400/10'
                  : 'border-slate-500 hover:border-blue-400'
              } ${
                selectedParticipant && !existingMatch?.participantB
                  ? 'cursor-pointer hover:bg-blue-400/5'
                  : ''
              }`}
              onClick={loading ? undefined : () => !existingMatch?.participantB && handleTimeSlotClick(timeWindow.id, false)}
            >
            {existingMatch?.participantB ? (
              <div className="w-full relative">
                {/* Top Action Bar - Match Count Badge and Call/Email Button */}
                <div className="absolute -top-2 -left-2 flex items-center space-x-1 z-30">
                  {/* Match Count Badge */}
                  {(() => {
                    const matchCount = getParticipantTimelineMatchCount(existingMatch.participantBId || '', existingMatch.participantBType || '', timeWindow.id, timeWindow);
                    if (matchCount > 0) {
                      return (
                        <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold border-2 border-slate-800 shadow-lg">
                          {matchCount}
                        </div>
                      );
                    }
                    return null;
                  })()}
                  
                  {/* Call/Email Button */}
                  {(() => {
                    const hasPhone = participantHasPhoneNumber(existingMatch.participantBId || '', existingMatch.participantBType || '');
                    const registration = registrations.find(reg => {
                      if (existingMatch.participantBType === 'TEAM') {
                        return reg.mode === 'TEAM' && reg.team?.id === existingMatch.participantBId;
                      } else if (existingMatch.participantBType === 'USER') {
                        return reg.mode === 'INDIVIDUAL' && reg.user?.id === existingMatch.participantBId;
                      } else {
                        // Fallback for backward compatibility
                        return (reg.mode === 'TEAM' && reg.team?.id === existingMatch.participantBId) ||
                               (reg.mode === 'INDIVIDUAL' && reg.user?.id === existingMatch.participantBId);
                      }
                    });
                    
                    if (!registration) return null;
                    
                    const phoneNumber = existingMatch.participantBType === 'USER'
                      ? registration.user?.phone
                      : registration.team?.leader?.phone;
                      
                    const email = existingMatch.participantBType === 'USER'
                      ? registration.user?.email
                      : registration.team?.leader?.email;
                    
                    return (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (hasPhone && phoneNumber) {
                            window.open(`https://wa.me/${phoneNumber.replace(/[^0-9]/g, '')}`, '_blank');
                          } else if (email) {
                            window.open(`mailto:${email}`, '_blank');
                          }
                        }}
                        className="w-6 h-6 bg-green-500 hover:bg-green-600 text-white rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95 shadow-sm border-2 border-slate-800"
                        title={hasPhone && phoneNumber ? "Call via WhatsApp" : "Send Email"}
                      >
                        {hasPhone && phoneNumber ? (
                          <Phone className="h-3 w-3" />
                        ) : (
                          <span className="text-xs font-bold">@</span>
                        )}
                      </button>
                    );
                  })()}
                  
                </div>
                <button
                  onClick={loading ? undefined : () => handleWinnerToggle(existingMatch, 'B')}
                  disabled={loading || updatingWinner === existingMatch.id}
                  className={`text-xs sm:text-sm font-medium text-center p-1 rounded transition-colors w-full ${
                    updatingWinner === existingMatch.id
                      ? 'opacity-50 cursor-not-allowed'
                      : ''
                  } ${
                    // In 1 Loser mode, winner means loser (inverted logic)
                    gameData?.contestType === 'SINGLE_ELIMINATION_1V1V1V1' && gameData?.oneLoserMode
                      ? (existingMatch.winnerId && existingMatch.participantBId && existingMatch.winnerId === existingMatch.participantBId
                          ? 'text-red-100 bg-gradient-to-r from-red-500/60 to-red-700/60 border border-red-600/50'
                          : existingMatch.winnerId && existingMatch.participantBId && existingMatch.winnerId !== existingMatch.participantBId
                          ? 'text-white bg-gradient-to-r from-green-400/60 to-green-600/60 border border-green-500/50 shadow-lg'
                          : 'text-white hover:bg-slate-600/50')
                      : (existingMatch.winnerId && existingMatch.participantBId && existingMatch.winnerId === existingMatch.participantBId
                          ? 'text-white bg-gradient-to-r from-yellow-400/60 to-yellow-600/60 border border-yellow-500/50 shadow-lg'
                          : existingMatch.winnerId && existingMatch.participantBId && existingMatch.winnerId !== existingMatch.participantBId
                          ? 'text-red-100 bg-gradient-to-r from-red-500/60 to-red-700/60 border border-red-600/50'
                          : 'text-white hover:bg-slate-600/50')
                  }`}
                >
                  <div className="flex items-center justify-between w-full h-full">
                    <div className="flex-1 min-w-0 flex flex-col items-center justify-center space-y-1">
                      <div className="flex items-center space-x-1 flex-wrap">
                        {existingMatch.winnerId && existingMatch.participantBId && existingMatch.winnerId === existingMatch.participantBId && (
                          gameData?.contestType === 'SINGLE_ELIMINATION_1V1V1V1' && gameData?.oneLoserMode
                            ? <X className="h-3 w-3 text-red-400 flex-shrink-0" />
                            : <Trophy className="h-3 w-3 text-yellow-400 flex-shrink-0" />
                        )}
                        {existingMatch.winnerId && existingMatch.participantBId && existingMatch.winnerId !== existingMatch.participantBId && gameData?.contestType === 'SINGLE_ELIMINATION_1V1V1V1' && gameData?.oneLoserMode && (
                          <Trophy className="h-3 w-3 text-green-400 flex-shrink-0" />
                        )}
                        <span className="truncate min-w-0 font-medium">
                          {reformatExistingParticipantName(existingMatch.participantB, existingMatch.participantBId || '', existingMatch.participantBType || '', registrations)}
                        </span>
                      </div>
                      {(() => {
                        const registration = registrations.find(reg => {
                          if (existingMatch.participantBType === 'TEAM') {
                            return reg.mode === 'TEAM' && reg.team?.id === existingMatch.participantBId;
                          } else if (existingMatch.participantBType === 'USER') {
                            return reg.mode === 'USER' && reg.user.id === existingMatch.participantBId;
                          } else {
                            // Fallback for backward compatibility
                            return (reg.mode === 'TEAM' && reg.team?.id === existingMatch.participantBId) ||
                                   (reg.mode === 'USER' && reg.user.id === existingMatch.participantBId);
                          }
                        });
                        if (!registration) return null;
                        
                        return (
                          <div className="flex flex-col items-center space-y-0.5">
                            {registration.mode === 'TEAM' && registration.team?.members && registration.team.members.length > 0 && (
                              <div className="flex flex-wrap gap-0.5 justify-center max-w-full">
                                {registration.team.members.slice(0, 2).map((member) => (
                                  <span
                                    key={member.id}
                                    className="inline-block px-1 py-0.5 bg-slate-600/50 text-slate-300 rounded text-xs truncate max-w-[60px]"
                                    title={`${member.firstName} ${member.lastName}`}
                                  >
                                    {formatParticipantName(member.firstName || '', member.lastName || '')}
                                  </span>
                                ))}
                                {registration.team.members.length > 2 && (
                                  <span
                                    className="inline-block px-1 py-0.5 bg-slate-500/50 text-slate-400 rounded text-xs"
                                    title={registration.team.members.slice(2).map(m => `${m.firstName} ${m.lastName}`).join(', ')}
                                  >
                                    +{registration.team.members.length - 2}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                    {(() => {
                      const registration = registrations.find(reg => {
                        if (existingMatch.participantBType === 'TEAM') {
                          return reg.mode === 'TEAM' && reg.team?.id === existingMatch.participantBId;
                        } else if (existingMatch.participantBType === 'USER') {
                          return reg.mode === 'INDIVIDUAL' && reg.user?.id === existingMatch.participantBId;
                        } else {
                          // Fallback for backward compatibility
                          return (reg.mode === 'TEAM' && reg.team?.id === existingMatch.participantBId) ||
                                 (reg.mode === 'INDIVIDUAL' && reg.user?.id === existingMatch.participantBId);
                        }
                      });
                      
                      if (!registration) return null;
                      
                      return (
                        <div className="ml-2 flex-shrink-0 h-full flex items-center space-x-1">
                          {/* Level Badge */}
                          <div
                            className={`px-1.5 py-2 rounded-md text-sm font-medium border shadow-sm ${getLevelColor(registration.level).bg} ${getLevelColor(registration.level).text} ${getLevelColor(registration.level).border}`}
                          >
                            {formatLevelInitial(registration.level)}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </button>
                {!existingMatch.winnerId && (
                  <button
                    onClick={loading ? undefined : (e) => {
                      e.stopPropagation();
                      handleUnschedule(existingMatch, 'B');
                    }}
                    disabled={loading}
                    className="absolute -top-1 -right-1 w-5 h-5 bg-red-500/80 hover:bg-red-500 text-white rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95 z-20 shadow-sm"
                    title="Unschedule participant"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            ) : (
              <div className="text-xs text-slate-400 text-center">
                {rightDroppable.isOver
                  ? 'Drop here'
                  : selectedParticipant
                    ? 'Click to schedule'
                    : window.innerWidth < 640 ? 'B' : 'Team B'
                }
              </div>
            )}
          </div>
          )}

          {/* Additional Drop Zones for 1v1v1v1 format */}
          {gameData?.contestType === 'SINGLE_ELIMINATION_1V1V1V1' && (
            <>
              {/* Participant C Drop Zone */}
              <div
                ref={cDroppable.setNodeRef}
                className={`border-2 border-dashed rounded-md p-2 transition-colors flex items-center justify-center min-h-[60px] sm:min-h-[80px] cursor-pointer ${
                  cDroppable.isOver
                    ? 'border-blue-400 bg-blue-400/10'
                    : 'border-slate-500 hover:border-blue-400 hover:bg-blue-400/5'
                }`}
                onClick={loading ? undefined : () => !existingMatch?.participantC && handleTimeSlotClick(timeWindow.id, false, 'C')}
              >
                {existingMatch?.participantC ? (
                  <div className="w-full relative">
                    {/* Top Action Bar - Match Count Badge and Call/Email Button */}
                    <div className="absolute -top-2 -left-2 flex items-center space-x-1 z-30">
                      {/* Match Count Badge */}
                      {(() => {
                        const matchCount = getParticipantTimelineMatchCount(existingMatch.participantCId || '', existingMatch.participantCType || '', timeWindow.id, timeWindow);
                        if (matchCount > 0) {
                          return (
                            <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold border-2 border-slate-800 shadow-lg">
                              {matchCount}
                            </div>
                          );
                        }
                        return null;
                      })()}
                      
                      {/* Call/Email Button */}
                      {(() => {
                        const hasPhone = participantHasPhoneNumber(existingMatch.participantCId || '', existingMatch.participantCType || '');
                        const registration = registrations.find(reg => {
                          if (existingMatch.participantCType === 'TEAM') {
                            return reg.mode === 'TEAM' && reg.team?.id === existingMatch.participantCId;
                          } else if (existingMatch.participantCType === 'USER') {
                            return reg.mode === 'INDIVIDUAL' && reg.user?.id === existingMatch.participantCId;
                          } else {
                            // Fallback for backward compatibility
                            return (reg.mode === 'TEAM' && reg.team?.id === existingMatch.participantCId) ||
                                   (reg.mode === 'INDIVIDUAL' && reg.user?.id === existingMatch.participantCId);
                          }
                        });
                        
                        if (!registration) return null;
                        
                        const phoneNumber = existingMatch.participantCType === 'USER'
                          ? registration.user?.phone
                          : registration.team?.leader?.phone;
                          
                        const email = existingMatch.participantCType === 'USER'
                          ? registration.user?.email
                          : registration.team?.leader?.email;
                        
                        return (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (hasPhone && phoneNumber) {
                                window.open(`https://wa.me/${phoneNumber.replace(/[^0-9]/g, '')}`, '_blank');
                              } else if (email) {
                                window.open(`mailto:${email}`, '_blank');
                              }
                            }}
                            className="w-6 h-6 bg-green-500 hover:bg-green-600 text-white rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95 shadow-sm border-2 border-slate-800"
                            title={hasPhone && phoneNumber ? "Call via WhatsApp" : "Send Email"}
                          >
                            {hasPhone && phoneNumber ? (
                              <Phone className="h-3 w-3" />
                            ) : (
                              <span className="text-xs font-bold">@</span>
                            )}
                          </button>
                        );
                      })()}
                      
                    </div>
                    <button
                      onClick={loading ? undefined : () => handleWinnerToggle(existingMatch, 'C')}
                      disabled={loading || updatingWinner === existingMatch.id}
                      className={`text-xs sm:text-sm font-medium text-center p-1 rounded transition-colors w-full ${
                        updatingWinner === existingMatch.id
                          ? 'opacity-50 cursor-not-allowed'
                          : ''
                      } ${
                        // In 1 Loser mode, winner means loser (inverted logic)
                        gameData?.oneLoserMode
                          ? (existingMatch.winnerId && existingMatch.participantCId && existingMatch.winnerId === existingMatch.participantCId
                              ? 'text-red-100 bg-gradient-to-r from-red-500/60 to-red-700/60 border border-red-600/50'
                              : existingMatch.winnerId && existingMatch.participantCId && existingMatch.winnerId !== existingMatch.participantCId
                              ? 'text-white bg-gradient-to-r from-green-400/60 to-green-600/60 border border-green-500/50 shadow-lg'
                              : 'text-white hover:bg-slate-600/50')
                          : (existingMatch.winnerId && existingMatch.participantCId && existingMatch.winnerId === existingMatch.participantCId
                              ? 'text-white bg-gradient-to-r from-yellow-400/60 to-yellow-600/60 border border-yellow-500/50 shadow-lg'
                              : existingMatch.winnerId && existingMatch.participantCId && existingMatch.winnerId !== existingMatch.participantCId
                              ? 'text-red-100 bg-gradient-to-r from-red-500/60 to-red-700/60 border border-red-600/50'
                              : 'text-white hover:bg-slate-600/50')
                      }`}
                    >
                      <div className="flex items-center justify-between w-full h-full">
                        <div className="flex-1 min-w-0 flex flex-col items-center justify-center space-y-1">
                          <div className="flex items-center space-x-1 flex-wrap">
                            {existingMatch.winnerId && existingMatch.participantCId && existingMatch.winnerId === existingMatch.participantCId && (
                              gameData?.oneLoserMode
                                ? <X className="h-3 w-3 text-red-400 flex-shrink-0" />
                                : <Trophy className="h-3 w-3 text-yellow-400 flex-shrink-0" />
                            )}
                            {existingMatch.winnerId && existingMatch.participantCId && existingMatch.winnerId !== existingMatch.participantCId && gameData?.oneLoserMode && (
                              <Trophy className="h-3 w-3 text-green-400 flex-shrink-0" />
                            )}
                            <span className="truncate min-w-0 font-medium">
                              {reformatExistingParticipantName(existingMatch.participantC || '', existingMatch.participantCId || '', existingMatch.participantCType || '', registrations)}
                            </span>
                          </div>
                          {/* Score display for scoring contests - N/A for 1v1v1v1 format */}
                          {(() => {
                            const registration = registrations.find(reg => {
                              if (existingMatch.participantCType === 'TEAM') {
                                return reg.mode === 'TEAM' && reg.team?.id === existingMatch.participantCId;
                              } else if (existingMatch.participantCType === 'USER') {
                                return reg.mode === 'INDIVIDUAL' && reg.user?.id === existingMatch.participantCId;
                              } else {
                                // Fallback for backward compatibility
                                return (reg.mode === 'TEAM' && reg.team?.id === existingMatch.participantCId) ||
                                       (reg.mode === 'INDIVIDUAL' && reg.user?.id === existingMatch.participantCId);
                              }
                            });
                            
                            if (!registration) return null;
                            
                            return (
                              <div className="flex flex-col items-center space-y-0.5">
                                {registration.mode === 'TEAM' && registration.team?.members && registration.team.members.length > 0 && (
                                  <div className="flex flex-wrap gap-0.5 justify-center max-w-full">
                                    {registration.team.members.slice(0, 2).map((member) => (
                                      <span
                                        key={member.id}
                                        className="inline-block px-1 py-0.5 bg-slate-600/50 text-slate-300 rounded text-xs truncate max-w-[60px]"
                                        title={`${member.firstName} ${member.lastName}`}
                                      >
                                        {formatParticipantName(member.firstName || '', member.lastName || '')}
                                      </span>
                                    ))}
                                    {registration.team.members.length > 2 && (
                                      <span
                                        className="inline-block px-1 py-0.5 bg-slate-500/50 text-slate-400 rounded text-xs"
                                        title={registration.team.members.slice(2).map(m => `${m.firstName} ${m.lastName}`).join(', ')}
                                      >
                                        +{registration.team.members.length - 2}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                        {(() => {
                          const registration = registrations.find(reg => {
                            if (existingMatch.participantCType === 'TEAM') {
                              return reg.mode === 'TEAM' && reg.team?.id === existingMatch.participantCId;
                            } else if (existingMatch.participantCType === 'USER') {
                              return reg.mode === 'INDIVIDUAL' && reg.user?.id === existingMatch.participantCId;
                            } else {
                              // Fallback for backward compatibility
                              return (reg.mode === 'TEAM' && reg.team?.id === existingMatch.participantCId) ||
                                     (reg.mode === 'INDIVIDUAL' && reg.user?.id === existingMatch.participantCId);
                            }
                          });
                          
                          if (!registration) return null;
                          
                          return (
                            <div className="ml-2 flex-shrink-0 h-full flex items-center space-x-1">
                              {/* Level Badge */}
                              <div
                                className={`px-1.5 py-2 rounded-md text-sm font-medium border shadow-sm ${getLevelColor(registration.level).bg} ${getLevelColor(registration.level).text} ${getLevelColor(registration.level).border}`}
                              >
                                {formatLevelInitial(registration.level)}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </button>
                    {!existingMatch.winnerId && (
                      <button
                        onClick={loading ? undefined : (e) => {
                          e.stopPropagation();
                          handleUnschedule(existingMatch, 'C');
                        }}
                        disabled={loading}
                        className="absolute -top-1 -right-1 w-5 h-5 bg-red-500/80 hover:bg-red-500 text-white rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95 z-20 shadow-sm"
                        title="Unschedule participant"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-slate-400 text-center">
                    {selectedParticipant ? 'Click to schedule' : 'Player C'}
                  </div>
                )}
              </div>

              {/* Participant D Drop Zone */}
              <div
                ref={dDroppable.setNodeRef}
                className={`border-2 border-dashed rounded-md p-2 transition-colors flex items-center justify-center min-h-[60px] sm:min-h-[80px] cursor-pointer ${
                  dDroppable.isOver
                    ? 'border-blue-400 bg-blue-400/10'
                    : 'border-slate-500 hover:border-blue-400 hover:bg-blue-400/5'
                }`}
                onClick={loading ? undefined : () => !existingMatch?.participantD && handleTimeSlotClick(timeWindow.id, false, 'D')}
              >
                {existingMatch?.participantD ? (
                  <div className="w-full relative">
                    {/* Top Action Bar - Match Count Badge and Call/Email Button */}
                    <div className="absolute -top-2 -left-2 flex items-center space-x-1 z-30">
                      {/* Match Count Badge */}
                      {(() => {
                        const matchCount = getParticipantTimelineMatchCount(existingMatch.participantDId || '', existingMatch.participantDType || '', timeWindow.id, timeWindow);
                        if (matchCount > 0) {
                          return (
                            <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold border-2 border-slate-800 shadow-lg">
                              {matchCount}
                            </div>
                          );
                        }
                        return null;
                      })()}
                      
                      {/* Call/Email Button */}
                      {(() => {
                        const hasPhone = participantHasPhoneNumber(existingMatch.participantDId || '', existingMatch.participantDType || '');
                        const registration = registrations.find(reg => {
                          if (existingMatch.participantDType === 'TEAM') {
                            return reg.mode === 'TEAM' && reg.team?.id === existingMatch.participantDId;
                          } else if (existingMatch.participantDType === 'USER') {
                            return reg.mode === 'INDIVIDUAL' && reg.user?.id === existingMatch.participantDId;
                          } else {
                            // Fallback for backward compatibility
                            return (reg.mode === 'TEAM' && reg.team?.id === existingMatch.participantDId) ||
                                   (reg.mode === 'INDIVIDUAL' && reg.user?.id === existingMatch.participantDId);
                          }
                        });
                        
                        if (!registration) return null;
                        
                        const phoneNumber = existingMatch.participantDType === 'USER'
                          ? registration.user?.phone
                          : registration.team?.leader?.phone;
                          
                        const email = existingMatch.participantDType === 'USER'
                          ? registration.user?.email
                          : registration.team?.leader?.email;
                        
                        return (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (hasPhone && phoneNumber) {
                                window.open(`https://wa.me/${phoneNumber.replace(/[^0-9]/g, '')}`, '_blank');
                              } else if (email) {
                                window.open(`mailto:${email}`, '_blank');
                              }
                            }}
                            className="w-6 h-6 bg-green-500 hover:bg-green-600 text-white rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95 shadow-sm border-2 border-slate-800"
                            title={hasPhone && phoneNumber ? "Call via WhatsApp" : "Send Email"}
                          >
                            {hasPhone && phoneNumber ? (
                              <Phone className="h-3 w-3" />
                            ) : (
                              <span className="text-xs font-bold">@</span>
                            )}
                          </button>
                        );
                      })()}
                      
                    </div>
                    <button
                      onClick={loading ? undefined : () => handleWinnerToggle(existingMatch, 'D')}
                      disabled={loading || updatingWinner === existingMatch.id}
                      className={`text-xs sm:text-sm font-medium text-center p-1 rounded transition-colors w-full ${
                        updatingWinner === existingMatch.id
                          ? 'opacity-50 cursor-not-allowed'
                          : ''
                      } ${
                        // In 1 Loser mode, winner means loser (inverted logic)
                        gameData?.oneLoserMode
                          ? (existingMatch.winnerId && existingMatch.participantDId && existingMatch.winnerId === existingMatch.participantDId
                              ? 'text-red-100 bg-gradient-to-r from-red-500/60 to-red-700/60 border border-red-600/50'
                              : existingMatch.winnerId && existingMatch.participantDId && existingMatch.winnerId !== existingMatch.participantDId
                              ? 'text-white bg-gradient-to-r from-green-400/60 to-green-600/60 border border-green-500/50 shadow-lg'
                              : 'text-white hover:bg-slate-600/50')
                          : (existingMatch.winnerId && existingMatch.participantDId && existingMatch.winnerId === existingMatch.participantDId
                              ? 'text-white bg-gradient-to-r from-yellow-400/60 to-yellow-600/60 border border-yellow-500/50 shadow-lg'
                              : existingMatch.winnerId && existingMatch.participantDId && existingMatch.winnerId !== existingMatch.participantDId
                              ? 'text-red-100 bg-gradient-to-r from-red-500/60 to-red-700/60 border border-red-600/50'
                              : 'text-white hover:bg-slate-600/50')
                      }`}
                    >
                      <div className="flex items-center justify-between w-full h-full">
                        <div className="flex-1 min-w-0 flex flex-col items-center justify-center space-y-1">
                          <div className="flex items-center space-x-1 flex-wrap">
                            {existingMatch.winnerId && existingMatch.participantDId && existingMatch.winnerId === existingMatch.participantDId && (
                              gameData?.oneLoserMode
                                ? <X className="h-3 w-3 text-red-400 flex-shrink-0" />
                                : <Trophy className="h-3 w-3 text-yellow-400 flex-shrink-0" />
                            )}
                            {existingMatch.winnerId && existingMatch.participantDId && existingMatch.winnerId !== existingMatch.participantDId && gameData?.oneLoserMode && (
                              <Trophy className="h-3 w-3 text-green-400 flex-shrink-0" />
                            )}
                            <span className="truncate min-w-0 font-medium">
                              {reformatExistingParticipantName(existingMatch.participantD || '', existingMatch.participantDId || '', existingMatch.participantDType || '', registrations)}
                            </span>
                          </div>
                          {(() => {
                            const registration = registrations.find(reg => {
                              if (existingMatch.participantDType === 'TEAM') {
                                return reg.mode === 'TEAM' && reg.team?.id === existingMatch.participantDId;
                              } else if (existingMatch.participantDType === 'USER') {
                                return reg.mode === 'INDIVIDUAL' && reg.user?.id === existingMatch.participantDId;
                              } else {
                                // Fallback for backward compatibility
                                return (reg.mode === 'TEAM' && reg.team?.id === existingMatch.participantDId) ||
                                       (reg.mode === 'INDIVIDUAL' && reg.user?.id === existingMatch.participantDId);
                              }
                            });
                            
                            if (!registration) return null;
                            
                            return (
                              <div className="flex flex-col items-center space-y-0.5">
                                {registration.mode === 'TEAM' && registration.team?.members && registration.team.members.length > 0 && (
                                  <div className="flex flex-wrap gap-0.5 justify-center max-w-full">
                                    {registration.team.members.slice(0, 2).map((member) => (
                                      <span
                                        key={member.id}
                                        className="inline-block px-1 py-0.5 bg-slate-600/50 text-slate-300 rounded text-xs truncate max-w-[60px]"
                                        title={`${member.firstName} ${member.lastName}`}
                                      >
                                        {formatParticipantName(member.firstName || '', member.lastName || '')}
                                      </span>
                                    ))}
                                    {registration.team.members.length > 2 && (
                                      <span
                                        className="inline-block px-1 py-0.5 bg-slate-500/50 text-slate-400 rounded text-xs"
                                        title={registration.team.members.slice(2).map(m => `${m.firstName} ${m.lastName}`).join(', ')}
                                      >
                                        +{registration.team.members.length - 2}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                        {(() => {
                          const registration = registrations.find(reg => {
                            if (existingMatch.participantDType === 'TEAM') {
                              return reg.mode === 'TEAM' && reg.team?.id === existingMatch.participantDId;
                            } else if (existingMatch.participantDType === 'USER') {
                              return reg.mode === 'INDIVIDUAL' && reg.user?.id === existingMatch.participantDId;
                            } else {
                              // Fallback for backward compatibility
                              return (reg.mode === 'TEAM' && reg.team?.id === existingMatch.participantDId) ||
                                     (reg.mode === 'INDIVIDUAL' && reg.user?.id === existingMatch.participantDId);
                            }
                          });
                          
                          if (!registration) return null;
                          
                          return (
                            <div className="ml-2 flex-shrink-0 h-full flex items-center space-x-1">
                              {/* Level Badge */}
                              <div
                                className={`px-1.5 py-2 rounded-md text-sm font-medium border shadow-sm ${getLevelColor(registration.level).bg} ${getLevelColor(registration.level).text} ${getLevelColor(registration.level).border}`}
                              >
                                {formatLevelInitial(registration.level)}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </button>
                    {!existingMatch.winnerId && (
                      <button
                        onClick={loading ? undefined : (e) => {
                          e.stopPropagation();
                          handleUnschedule(existingMatch, 'D');
                        }}
                        disabled={loading}
                        className="absolute -top-1 -right-1 w-5 h-5 bg-red-500/80 hover:bg-red-500 text-white rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95 z-20 shadow-sm"
                        title="Unschedule participant"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-slate-400 text-center">
                    {selectedParticipant ? 'Click to schedule' : 'Player D'}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* VS indicator when teams are assigned */}
        {gameData?.contestType === 'SINGLE_ELIMINATION_1V1V1V1' ? (
          // Show "1v1v1v1" when all 4 participants are assigned
          existingMatch?.participantA && existingMatch?.participantB && existingMatch?.participantC && existingMatch?.participantD && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span className="text-xs text-green-400 bg-green-600 px-2 py-1 rounded shadow-lg">
                1v1v1v1
              </span>
            </div>
          )
        ) : (
          // Original VS indicator for 2-participant matches
          existingMatch?.participantA && existingMatch?.participantB && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none sm:inset-0 top-5 sm:top-auto">
              <span className="text-xs text-green-400 bg-green-600 px-2 py-1 rounded shadow-lg">
                VS
              </span>
            </div>
          )
        )}
      </div>
    );
  };

  // Remove the full-screen loading overlay - we now show disabled participant cards during loading

  if (!gameData) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
        <Card className="w-full max-w-md bg-slate-800 border-slate-700">
          <CardContent className="p-8 text-center">
            {loading ? (
              <>
                <RefreshCw className="h-8 w-8 mx-auto mb-4 text-blue-400 animate-spin" />
                <p className="text-white mb-4">Loading game data...</p>
              </>
            ) : (
              <>
                <AlertCircle className="h-8 w-8 mx-auto mb-4 text-red-400" />
                <p className="text-white mb-4">Failed to load game data</p>
                <Button onClick={onClose} variant="outline">Close</Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  const stats = getRegistrationStats();

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-0 sm:p-4 z-50">
      <div className="relative w-full h-full sm:max-w-7xl sm:h-[95vh] bg-slate-900 sm:rounded-lg border-0 sm:border sm:border-slate-700 flex flex-col">
        {/* Loading Overlay */}
        {loading && (
          <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-50 sm:rounded-lg">
            <div className="text-center">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-400" />
              <p className="text-white">Loading data...</p>
            </div>
          </div>
        )}
        {/* Header */}
        <div className="bg-slate-800 border-b border-slate-700 p-3 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="text-lg sm:text-2xl font-bold text-white flex items-center">
                <Calendar className="h-5 w-5 sm:h-6 sm:w-6 mr-2 sm:mr-3 text-blue-400 flex-shrink-0" />
                <span className="truncate">Schedule: {gameData.name}</span>
              </h2>
              <p className="text-slate-300 mt-1 text-sm sm:text-base">
                {contestTypeLabels[gameData.contestType as keyof typeof contestTypeLabels]} •
                {gameData.typeFormat} • {gameData.avgGameTime} min/game
              </p>
            </div>
            <div className="flex items-center space-x-2 flex-shrink-0">
              {onShowRegistrations && (
                <Button
                  onClick={loading ? undefined : onShowRegistrations}
                  disabled={loading}
                  variant="outline"
                  size="sm"
                  className={`text-blue-400 border-blue-400/30 hover:bg-blue-400/10 hover:border-blue-400/50 ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <Users className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Registrations</span>
                </Button>
              )}
              <Button
                onClick={loading ? undefined : handleResetAll}
                disabled={loading}
                variant="outline"
                size="sm"
                className={`text-red-400 border-red-400/30 hover:bg-red-400/10 hover:border-red-400/50 ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <RotateCcw className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Reset All</span>
              </Button>
              <Button
                onClick={loading ? undefined : onClose}
                disabled={loading}
                variant="outline"
                size="sm"
                className={loading ? 'opacity-50 cursor-not-allowed' : ''}
              >
                <X className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Close</span>
              </Button>
            </div>
          </div>
        </div>


        {/* Content */}
        <div className="flex flex-col lg:flex-row flex-1 min-h-0">
          {/* Left Panel - Registrations */}
          <div
            className={`w-full lg:w-1/4 border-b lg:border-b-0 lg:border-r border-slate-700 flex flex-col lg:max-h-none`}
            style={{
              maxHeight: showRegistrationSection
                ? (isDesktop ? 'none' : `${mobileRegistrationHeight}vh`)
                : 'none'
            }}
          >
            <div className="p-2 sm:p-3 border-b border-slate-700">
              <div className="relative">
                <div className="flex items-center justify-between mb-2">
                  <button
                    onClick={loading ? undefined : () => setShowRegistrationSection(!showRegistrationSection)}
                    disabled={loading}
                    className={`flex items-center text-base sm:text-lg font-semibold text-white hover:text-blue-400 transition-colors ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <Users className="h-4 w-4 sm:h-5 sm:w-5 mr-2 text-green-400 flex-shrink-0" />
                    <span className="truncate">Registrations ({stats.total})</span>
                    {showRegistrationSection ? (
                      <ChevronDown className="h-4 w-4 ml-2 text-slate-400" />
                    ) : (
                      <ChevronRight className="h-4 w-4 ml-2 text-slate-400" />
                    )}
                  </button>
                  
                  {/* Rules Info Icon - Right Aligned */}
                  {showRegistrationSection && (
                    <div className="relative">
                      <div
                        className="group cursor-pointer"
                        onMouseEnter={() => setRulesExpanded(true)}
                        onMouseLeave={() => setRulesExpanded(false)}
                      >
                        <AlertCircle className="h-4 w-4 text-blue-400 hover:text-blue-300 transition-colors" />
                        
                        {/* Absolutely positioned tooltip */}
                        <div className={`absolute top-6 right-0 z-50 w-80 bg-slate-800 border border-blue-500/30 rounded-lg shadow-xl transition-all duration-200 ${rulesExpanded ? 'opacity-100 visible' : 'opacity-0 invisible'}`}>
                          <div className="p-4">
                            <div className="flex items-center mb-2">
                              <Info className="h-4 w-4 mr-2 text-blue-400 flex-shrink-0" />
                              <h4 className="text-sm font-medium text-blue-300">
                                {contestTypeLabels[gameData.contestType as keyof typeof contestTypeLabels]} Rules
                              </h4>
                            </div>
                            <p className="text-xs text-blue-200 leading-relaxed mb-2">
                              {ContestValidator.getContestTypeInfo(gameData.contestType).description}
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {ContestValidator.getContestTypeInfo(gameData.contestType).rules.map((rule, index) => (
                                <span key={index} className="inline-flex items-center px-2 py-1 bg-blue-500/20 text-blue-200 text-xs rounded">
                                  {rule}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Stats - Hide for individual games as teams are not required */}
              {showRegistrationSection && gameData.typeFormat !== '1v1' && gameData.typeFormat !== 'Individual' && (
                <>
                  <div className="hidden sm:grid grid-cols-2 gap-2 mb-3 sm:mb-4">
                    <div className="bg-slate-800/50 rounded-lg p-2 text-center">
                      <div className="text-xs sm:text-sm text-slate-400">Complete</div>
                      <div className="text-base sm:text-lg font-bold text-green-400">{stats.complete}</div>
                    </div>
                    <div className="bg-slate-800/50 rounded-lg p-2 text-center">
                      <div className="text-xs sm:text-sm text-slate-400">Incomplete</div>
                      <div className="text-base sm:text-lg font-bold text-red-400">{stats.incomplete}</div>
                    </div>
                  </div>
                  
                  {stats.incomplete > 0 && (
                    <div className="hidden sm:block mb-3 sm:mb-4 p-2 bg-red-500/10 border border-red-500/30 rounded-lg">
                      <p className="text-xs text-red-300">
                        ⚠️ {stats.incomplete} incomplete team(s) cannot be scheduled
                      </p>
                    </div>
                  )}
                </>
              )}

              {/* Search and Filters */}
              {showRegistrationSection && (
                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-3 w-3 sm:h-4 sm:w-4 text-slate-400" />
                    <Input
                      placeholder="Search registrations..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-8 sm:pl-10 bg-slate-800 border-slate-600 text-sm"
                    />
                  </div>
                  
                  <div>
                    <select
                      value={levelFilter}
                      onChange={(e) => setLevelFilter(e.target.value)}
                      className="w-full bg-slate-800 border-slate-600 text-sm text-white rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="All">All Levels</option>
                      {getUniqueLevels().map(level => (
                        <option key={level} value={level}>{level}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* Registration List */}
            {showRegistrationSection && (
              <div ref={registrationListRef} className="flex-1 overflow-y-auto p-2 sm:p-3 space-y-2">
              {/* For individual games, show all registrations without Complete/Incomplete sections */}
              {(() => {
                const filteredRegistrations = getFilteredRegistrations();
                const roundGroups = getParticipantsByRounds(filteredRegistrations);
                const sortedRounds = Object.keys(roundGroups).map(Number).sort((a, b) => a - b);
                
                return (
                  <>
                    {sortedRounds.map(round => {
                      const roundParticipants = roundGroups[round];
                      const isExpanded = isRoundSectionExpanded(round);
                      
                      if (roundParticipants.length === 0) return null;
                      
                      return (
                        <div key={round}>
                          <button
                            onClick={loading ? undefined : () => toggleRoundSection(round)}
                            disabled={loading}
                            className={`w-full flex items-center justify-between p-2 bg-slate-800/50 rounded border border-slate-600 hover:bg-slate-800/70 transition-colors ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            <div className="flex items-center space-x-1.5">
                              <Trophy className="h-3.5 w-3.5 text-blue-400" />
                              <span className="font-medium text-white text-sm">
                                Round {round} ({roundParticipants.length})
                              </span>
                              <span className="text-xs text-slate-500">
                                {round === 1 ? '0 matches' : `${round - 1} match${round - 1 !== 1 ? 'es' : ''}`}
                              </span>
                            </div>
                            {isExpanded ? (
                              <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                            )}
                          </button>
                          
                          {isExpanded && (
                            <div className="mt-2 space-y-2">
                              {roundParticipants.map((registration) => (
                                <DraggableRegistration key={registration.id} registration={registration} />
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    
                    {sortedRounds.length === 0 && (
                      <div className="text-center py-8 text-slate-400">
                        <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>No participants available</p>
                        <p className="text-xs">Try adjusting your filters</p>
                      </div>
                    )}
                  </>
                );
              })()}
              
              {getFilteredRegistrations().length === 0 && (
                <div className="text-center py-8 text-slate-400">
                  <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No registrations found</p>
                  <p className="text-xs">Try adjusting your filters</p>
                </div>
              )}
              </div>
            )}
          </div>

          {/* Mobile Resize Handle */}
          {showRegistrationSection && (
            <div
              className="lg:hidden h-3 bg-slate-600 hover:bg-slate-500 cursor-ns-resize flex items-center justify-center transition-colors select-none"
              onMouseDown={handleMouseDown}
              onTouchStart={handleMouseDown}
              style={{
                cursor: 'ns-resize',
                touchAction: 'none'
              }}
            >
              <div className="w-12 h-1 bg-slate-400 rounded-full"></div>
            </div>
          )}

          {/* Right Panel - Schedule Editor */}
          <div className="flex-1 flex flex-col max-h-[70vh] lg:max-h-none">
            <div className="p-2 sm:p-4 border-b border-slate-700">
              <div className="flex items-center justify-between mb-1 sm:mb-2">
                <h3 className="text-base sm:text-lg font-semibold text-white flex items-center">
                  <Calendar className="h-4 w-4 sm:h-5 sm:w-5 mr-1 sm:mr-2 text-blue-400" />
                  <span className="hidden sm:inline">Match Schedule</span>
                  <span className="sm:hidden">Schedule</span>
                </h3>
                
                {/* Date Filter */}
                {gameData?.category && (
                  <div className="flex items-center space-x-3">
                    <select
                      value={selectedDate}
                      onChange={loading ? undefined : (e) => {
                        setSelectedDate(e.target.value);
                        // Scroll timeline to top when changing date
                        if (timelineContainerRef.current) {
                          timelineContainerRef.current.scrollTop = 0;
                        }
                      }}
                      disabled={loading}
                      className={`bg-slate-800 border border-slate-600 rounded-md px-2 sm:px-3 py-1 text-white text-xs sm:text-sm min-w-[100px] sm:min-w-[140px] ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {getAvailableDates().map(date => (
                        <option key={date.toISOString()} value={date.toISOString()}>
                          {date.toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </option>
                      ))}
                    </select>
                    
                    {/* Admin Override Toggle */}
                    <div className="flex items-center">
                      <div className={`flex items-center rounded-lg border transition-all duration-200 ${
                        overrideConflicts
                          ? 'bg-orange-500/10 border-orange-500/30 shadow-sm'
                          : 'bg-slate-800/50 border-slate-600 hover:border-slate-500'
                      } ${
                        // Mobile: compact padding, Desktop: normal padding
                        'px-2 py-1.5 sm:px-3 sm:py-2'
                      }`}>
                        <div className="flex items-center space-x-1.5 sm:space-x-2">
                          {/* Icon - hidden on very small screens */}
                          <div className="hidden xs:block">
                            {overrideConflicts ? (
                              <ShieldCheck className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-orange-400" />
                            ) : (
                              <Shield className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-slate-400" />
                            )}
                          </div>
                          
                          <label className="flex items-center space-x-1.5 sm:space-x-2 cursor-pointer">
                            {/* Toggle Switch */}
                            <div className="relative">
                              <input
                                type="checkbox"
                                checked={overrideConflicts}
                                onChange={loading ? undefined : (e) => setOverrideConflicts(e.target.checked)}
                                disabled={loading}
                                className="sr-only"
                              />
                              <div className={`rounded-full transition-all duration-300 shadow-inner ${
                                overrideConflicts
                                  ? 'bg-gradient-to-r from-orange-500 to-orange-400 shadow-orange-500/20'
                                  : 'bg-slate-600 hover:bg-slate-500'
                              } ${
                                // Mobile: smaller toggle, Desktop: normal size
                                'w-8 h-4 sm:w-11 sm:h-6'
                              }`}>
                                <div className={`bg-white rounded-full shadow-lg transform transition-all duration-300 flex items-center justify-center ${
                                  overrideConflicts ? 'shadow-orange-200/50' : ''
                                } ${
                                  // Mobile: smaller knob and positioning
                                  overrideConflicts
                                    ? 'w-3.5 h-3.5 translate-x-3.5 sm:w-5 sm:h-5 sm:translate-x-5'
                                    : 'w-3.5 h-3.5 translate-x-0.5 sm:w-5 sm:h-5'
                                } mt-0.25 sm:mt-0.5`}>
                                  {overrideConflicts && (
                                    <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-orange-500 rounded-full"></div>
                                  )}
                                </div>
                              </div>
                            </div>
                            
                            {/* Text Labels */}
                            <div className="flex flex-col">
                              <span className={`font-medium whitespace-nowrap transition-colors duration-200 ${
                                overrideConflicts ? 'text-orange-300' : 'text-slate-300'
                              } ${
                                // Mobile: smaller text, Desktop: normal size
                                'text-xs sm:text-sm'
                              }`}>
                                {/* Mobile: shorter text, Desktop: full text */}
                                <span className="sm:hidden">Override</span>
                                <span className="hidden sm:inline">Override Conflicts</span>
                              </span>
                              {/* Status text - hidden on mobile */}
                              <span className="hidden sm:block text-xs text-slate-500 whitespace-nowrap">
                                {overrideConflicts ? 'Conflicts bypassed' : 'Normal validation'}
                              </span>
                            </div>
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex-1 flex flex-col min-h-0">
              {selectedDate ? (
                <div className="flex-1 flex flex-col p-1 sm:p-2 min-h-0">
                  {/* Timeline Interface */}
                  <div className="flex-1 flex flex-col bg-slate-800/30 rounded border border-slate-600 min-h-0">
                    <div className="p-2 sm:p-3 border-b border-slate-600">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-white font-medium text-sm">
                          Timeline - {new Date(selectedDate).toLocaleDateString('en-US', {
                            weekday: 'long',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </h4>
                        
                        {/* Timeline Tabs/Dropdown */}
                        {gameData.simultaneousGames > 1 && (
                          <div className="flex items-center space-x-1.5">
                            <span className="text-xs text-slate-400">Court:</span>
                            {gameData.simultaneousGames <= 2 ? (
                              <div className="flex bg-slate-700 rounded p-0.5">
                                {Array.from({ length: gameData.simultaneousGames }, (_, index) => {
                                  const timelineId = index + 1;
                                  return (
                                    <button
                                      key={timelineId}
                                      onClick={loading ? undefined : () => {
                                        setSelectedTimeline(timelineId);
                                        // Scroll timeline to top when changing court
                                        if (timelineContainerRef.current) {
                                          timelineContainerRef.current.scrollTop = 0;
                                        }
                                      }}
                                      disabled={loading}
                                      className={`px-2 py-0.5 text-xs font-medium rounded transition-colors ${
                                        selectedTimeline === timelineId
                                          ? 'bg-blue-500 text-white'
                                          : 'text-slate-300 hover:text-white hover:bg-slate-600'
                                      } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    >
                                      Court {timelineId}
                                    </button>
                                  );
                                })}
                              </div>
                            ) : (
                              <select
                                value={selectedTimeline}
                                onChange={loading ? undefined : (e) => {
                                  setSelectedTimeline(parseInt(e.target.value));
                                  // Scroll timeline to top when changing court
                                  if (timelineContainerRef.current) {
                                    timelineContainerRef.current.scrollTop = 0;
                                  }
                                }}
                                disabled={loading}
                                className={`bg-slate-700 border border-slate-600 rounded px-2 py-0.5 text-white text-xs min-w-[80px] ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                              >
                                {Array.from({ length: gameData.simultaneousGames }, (_, index) => {
                                  const timelineId = index + 1;
                                  return (
                                    <option key={timelineId} value={timelineId}>
                                      Court {timelineId}
                                    </option>
                                  );
                                })}
                              </select>
                            )}
                          </div>
                        )}
                      </div>
                      
                    </div>
                    
                    <div ref={timelineContainerRef} className="flex-1 overflow-y-auto p-1 sm:p-2 space-y-2 min-h-0" style={{ touchAction: 'pan-y', WebkitOverflowScrolling: 'touch', minHeight: '0px', maxHeight: '70vh' }}>
                      <div className="pb-8 sm:pb-2">
                        {getTimeWindows().map((timeWindow) => (
                          <div key={timeWindow.id} className="mb-2">
                            <DroppableTimeSlot timeWindow={timeWindow} />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-slate-400">
                  <div className="text-center">
                    <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="text-lg mb-2">Select a date to view timeline</p>
                    <p className="text-sm">Choose a date from the dropdown to start scheduling</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
      
      {/* Score Input Dialog for Scoring Contest */}
      {showScoreDialog && scoreDialogData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">Enter Score</CardTitle>
              <CardDescription className="text-slate-400">
                Enter the score for {scoreDialogData.participantName}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Score
                </label>
                <Input
                  type="number"
                  value={scoreInput}
                  onChange={(e) => setScoreInput(e.target.value)}
                  placeholder="Enter score..."
                  className="bg-slate-700 border-slate-600 text-white"
                  min="0"
                  step="0.1"
                  autoFocus
                />
              </div>
              <div className="flex space-x-2">
                <Button
                  onClick={loading ? undefined : handleScoreSubmit}
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                  disabled={loading || !scoreInput.trim()}
                >
                  Submit Score
                </Button>
                <Button
                  onClick={loading ? undefined : async () => {
                    if (scoreDialogData) {
                      await handleUnscheduleFromScoreDialog(scoreDialogData.match, scoreDialogData.side);
                      setShowScoreDialog(false);
                      setScoreDialogData(null);
                      setScoreInput('');
                    }
                  }}
                  disabled={loading}
                  variant="destructive"
                  className="flex-1"
                >
                  <X className="h-4 w-4 mr-1" />
                  Unschedule
                </Button>
                <Button
                  onClick={loading ? undefined : () => {
                    setShowScoreDialog(false);
                    setScoreDialogData(null);
                    setScoreInput('');
                  }}
                  disabled={loading}
                  variant="outline"
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      
      <DragOverlay>
        {activeId ? (
          <div className="bg-slate-800 border border-blue-400 rounded-lg p-3 shadow-lg">
            <div className="text-white text-sm font-medium">
              {(() => {
                const registration = registrations.find(reg => reg.id === activeId);
                return registration?.mode === 'TEAM' && registration.team
                  ? registration.team.name
                  : registration ? formatParticipantName(registration.user.firstName, registration.user.lastName) : '';
              })()}
            </div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAlert } from "@/contexts/AlertContext";
import {
  Users,
  Calendar,
  Clock,
  Trophy,
  Target,
  Search,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  X,
  User,
  GripVertical,
  Lock,
  Trash2
} from "lucide-react";
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
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import {
  useDroppable,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

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
    avatarUrl?: string;
  };
  team?: {
    id: string;
    name: string;
    isComplete: boolean;
    requiredSize: number;
    actualSize: number;
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
  category?: {
    startDate: string;
    endDate: string;
    dailyWindows: Array<{
      start: string;
      end: string;
    }>;
  };
}

interface ScheduledMatch {
  id: string;
  participantA: string;
  participantB: string;
  participantC?: string;
  participantD?: string;
  registrationAId: string;
  registrationBId: string;
  registrationCId?: string;
  registrationDId?: string;
  participantAId?: string;
  participantBId?: string;
  participantCId?: string;
  participantDId?: string;
  participantAType?: string;
  participantBType?: string;
  participantCType?: string;
  participantDType?: string;
  timeSlotId: string;
  winnerId?: string;
  winnerType?: string;
}

interface UserRestrictedGameSchedulingInterfaceProps {
  gameId: string;
  onClose: () => void;
  apiCall: (url: string, options?: RequestInit) => Promise<Response>;
  currentUser: any;
  userRegistration: {
    level: string;
    mode: string;
    teamName?: string;
    teamMembers?: { id: string; name: string; email: string }[];
    isTeamLead?: boolean;
  };
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

export default function UserRestrictedGameSchedulingInterface({
  gameId,
  onClose,
  apiCall,
  currentUser,
  userRegistration
}: UserRestrictedGameSchedulingInterfaceProps) {
  const { showError } = useAlert();
  const [loading, setLoading] = useState(true);
  const [gameData, setGameData] = useState<GameData | null>(null);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [selectedDate, setSelectedDate] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [scheduledMatches, setScheduledMatches] = useState<ScheduledMatch[]>([]);
  const [scheduledRegistrationIds, setScheduledRegistrationIds] = useState<Set<string>>(new Set());
  const [selectedTimeline, setSelectedTimeline] = useState<number>(1);
  const [userTeamId, setUserTeamId] = useState<string | null>(null);
  const [selectedParticipant, setSelectedParticipant] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    loadScheduleData();
  }, [gameId]);

  useEffect(() => {
    // Detect if device is mobile
    const checkMobile = () => {
      const mobile = window.innerWidth < 768 || 'ontouchstart' in window;
      console.log('Mobile detection:', { width: window.innerWidth, touchSupport: 'ontouchstart' in window, isMobile: mobile });
      setIsMobile(mobile);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (gameData?.category && selectedDate === '') {
      const dates = getAvailableDates();
      if (dates.length > 0) {
        setSelectedDate(dates[0].toISOString());
      }
    }
  }, [gameData]);

  useEffect(() => {
    if (gameId && selectedTimeline && selectedDate) {
      loadExistingMatches();
    }
  }, [selectedTimeline, selectedDate]);

  // Auto-select the first available participant when registrations change
  useEffect(() => {
    const schedulableRegs = getSchedulableUserRegistrations();
    if (schedulableRegs.length > 0 && !selectedParticipant) {
      // Auto-select the first available registration
      setSelectedParticipant(schedulableRegs[0].id);
    } else if (schedulableRegs.length === 0 && selectedParticipant) {
      // Clear selection if no schedulable registrations are available
      setSelectedParticipant(null);
    } else if (selectedParticipant && !schedulableRegs.find(reg => reg.id === selectedParticipant)) {
      // If currently selected participant is no longer available, select the first available one
      if (schedulableRegs.length > 0) {
        setSelectedParticipant(schedulableRegs[0].id);
      } else {
        setSelectedParticipant(null);
      }
    }
  }, [registrations, scheduledRegistrationIds, selectedParticipant]);

  const canUserInteractWithRegistration = (registration: Registration): boolean => {
    if (userRegistration.mode === 'TEAM') {
      // Only team leader can schedule matches for the team
      return registration.team?.name === userRegistration.teamName && userRegistration.isTeamLead === true;
    } else {
      // Individual users can schedule their own matches
      return registration.user.id === currentUser.id;
    }
  };

  const getUserRegistrations = (): Registration[] => {
    return registrations.filter(reg =>
      canUserInteractWithRegistration(reg)
    );
  };

  const getSchedulableUserRegistrations = (): Registration[] => {
    return registrations.filter(reg =>
      canUserInteractWithRegistration(reg) &&
      !scheduledRegistrationIds.has(reg.id) &&
      reg.isComplete
    );
  };

  const loadScheduleData = async () => {
    setLoading(true);
    try {
      const response = await apiCall(`/api/games/${gameId}/user-schedule`);
      if (response.ok) {
        const data = await response.json();
        setGameData(data.game);
        setRegistrations(data.registrations);

        if (userRegistration.mode === 'TEAM') {
          const userTeam = data.registrations.find((reg: Registration) => 
            reg.team?.name === userRegistration.teamName
          );
          if (userTeam?.team) {
            setUserTeamId(userTeam.team.id);
          }
        }
      } else {
        console.error('Failed to load schedule data');
      }
    } catch (error) {
      console.error('Error loading schedule data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadExistingMatches = async () => {
    try {
      // Load matches from ALL timelines to prevent cross-timeline conflicts
      const response = await apiCall(`/api/games/${gameId}/user-matches`);
      if (response.ok) {
        const data = await response.json();
        console.log('Loading existing matches from all timelines:', data.matches?.length || 0);
        if (data.success && data.matches) {
          // Convert database matches to scheduled matches format
          const scheduledMatchesData: ScheduledMatch[] = [];
          const scheduledRegIds = new Set<string>();

          // Generate time windows for current timeline to match slot IDs
          const selectedDateObj = new Date(selectedDate);
          const timeWindows = getTimeWindows();
          console.log('Generated time windows for current timeline:', timeWindows.length);

          data.matches.forEach((match: any) => {
            if (match.slot) {
              const slotStart = new Date(match.slot.startTime);
              const slotEnd = new Date(match.slot.endTime);
              
              // Check if this match is for the current timeline and current date
              const isCurrentTimeline = match.slot.timelineId === selectedTimeline;
              const isCurrentDate = slotStart.toDateString() === selectedDateObj.toDateString();
              
              // Handle both regular 2-participant and 1v1v1v1 4-participant matches
              let regA, regB, regC, regD;
              let participantA = '', participantB = '', participantC = '', participantD = '';
              let participantAId = '', participantBId = '', participantCId = '', participantDId = '';
              let participantAType = '', participantBType = '', participantCType = '', participantDType = '';

              // Check if this is a 1v1v1v1 match by looking for JSON data
              const is1v1v1v1 = match.participantAType === 'FOUR_PARTICIPANT_DATA' ||
                               (match.participantAId && match.participantAId.startsWith('{'));

              if (is1v1v1v1) {
                // Handle 1v1v1v1 format with JSON storage
                try {
                  // Parse participants 1 and 2 from participantAId
                  const participantAData = JSON.parse(match.participantAId || '{}');
                  if (participantAData.participant1Id) {
                    participantAId = participantAData.participant1Id;
                    participantAType = participantAData.participant1Type;
                    regA = registrations.find(reg =>
                      (participantAType === 'TEAM' && reg.team?.id === participantAId) ||
                      (participantAType === 'USER' && reg.user.id === participantAId)
                    );
                    if (regA) {
                      participantA = regA.mode === 'TEAM' && regA.team
                        ? regA.team.name
                        : `${regA.user.firstName} ${regA.user.lastName}`;
                    }
                  }
                  
                  if (participantAData.participant2Id) {
                    participantBId = participantAData.participant2Id;
                    participantBType = participantAData.participant2Type;
                    regB = registrations.find(reg =>
                      (participantBType === 'TEAM' && reg.team?.id === participantBId) ||
                      (participantBType === 'USER' && reg.user.id === participantBId)
                    );
                    if (regB) {
                      participantB = regB.mode === 'TEAM' && regB.team
                        ? regB.team.name
                        : formatParticipantName(regB.user.firstName, regB.user.lastName);
                    }
                  }

                  // Parse participants 3 and 4 from participantBId
                  const participantBData = JSON.parse(match.participantBId || '{}');
                  if (participantBData.participant3Id) {
                    participantCId = participantBData.participant3Id;
                    participantCType = participantBData.participant3Type;
                    regC = registrations.find(reg =>
                      (participantCType === 'TEAM' && reg.team?.id === participantCId) ||
                      (participantCType === 'USER' && reg.user.id === participantCId)
                    );
                    if (regC) {
                      participantC = regC.mode === 'TEAM' && regC.team
                        ? regC.team.name
                        : formatParticipantName(regC.user.firstName, regC.user.lastName);
                    }
                  }
                  
                  if (participantBData.participant4Id) {
                    participantDId = participantBData.participant4Id;
                    participantDType = participantBData.participant4Type;
                    regD = registrations.find(reg =>
                      (participantDType === 'TEAM' && reg.team?.id === participantDId) ||
                      (participantDType === 'USER' && reg.user.id === participantDId)
                    );
                    if (regD) {
                      participantD = regD.mode === 'TEAM' && regD.team
                        ? regD.team.name
                        : formatParticipantName(regD.user.firstName, regD.user.lastName);
                    }
                  }
                } catch (error) {
                  console.error('Error parsing 1v1v1v1 match data:', error);
                }
              } else {
                // Handle regular 2-participant match
                participantAId = match.participantAId;
                participantBId = match.participantBId;
                participantAType = match.participantAType;
                participantBType = match.participantBType;

                regA = registrations.find(reg =>
                  (match.participantAType === 'TEAM' && reg.team?.id === match.participantAId) ||
                  (match.participantAType === 'USER' && reg.user.id === match.participantAId)
                );
                regB = registrations.find(reg =>
                  (match.participantBType === 'TEAM' && reg.team?.id === match.participantBId) ||
                  (match.participantBType === 'USER' && reg.user.id === match.participantBId)
                );

                if (regA) {
                  participantA = regA.mode === 'TEAM' && regA.team
                    ? regA.team.name
                    : formatParticipantName(regA.user.firstName, regA.user.lastName);
                }
                
                if (regB) {
                  participantB = regB.mode === 'TEAM' && regB.team
                    ? regB.team.name
                    : formatParticipantName(regB.user.firstName, regB.user.lastName);
                }
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
                  const matchData: ScheduledMatch = {
                    id: match.id,
                    participantA,
                    participantB,
                    registrationAId: regA?.id || '',
                    registrationBId: regB?.id || '',
                    participantAId,
                    participantBId: is1v1v1v1 ? match.participantBId : participantBId,
                    participantAType,
                    participantBType: is1v1v1v1 ? match.participantBType : participantBType,
                    timeSlotId: matchingWindow.id,
                    winnerId: match.winnerId,
                    winnerType: match.winnerType
                  };

                  // Add 1v1v1v1 specific fields
                  if (is1v1v1v1) {
                    matchData.participantC = participantC;
                    matchData.participantD = participantD;
                    matchData.registrationCId = regC?.id || '';
                    matchData.registrationDId = regD?.id || '';
                    matchData.participantCId = participantCId;
                    matchData.participantDId = participantDId;
                    matchData.participantCType = participantCType;
                    matchData.participantDType = participantDType;
                  }

                  scheduledMatchesData.push(matchData);
                }
              }
            }
          });

          console.log('Final scheduled matches data for current timeline:', scheduledMatchesData);
          console.log('Total scheduled registrations across all timelines:', scheduledRegIds.size);
          setScheduledMatches(scheduledMatchesData);
          setScheduledRegistrationIds(scheduledRegIds);
        }
      }
    } catch (error) {
      console.error('Error loading existing matches:', error);
    }
  };

  const getAvailableDates = (): Date[] => {
    if (!gameData?.category) return [];
    
    const startDate = new Date(gameData.category.startDate);
    const endDate = new Date(gameData.category.endDate);
    const dates: Date[] = [];
    
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      dates.push(new Date(currentDate));
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return dates;
  };

  const getTimeWindows = () => {
    if (!gameData?.category || !selectedDate || !gameData.avgGameTime) return [];

    const selectedDateObj = new Date(selectedDate);
    
    // Validate that selectedDateObj is a valid date
    if (isNaN(selectedDateObj.getTime())) {
      console.error('Invalid selectedDate:', selectedDate);
      return [];
    }
    
    const dailyWindows = gameData.category.dailyWindows || [{ start: '09:00', end: '17:00' }];
    const avgGameTimeMs = gameData.avgGameTime * 60000;
    const timeWindows: any[] = [];

    dailyWindows.forEach((window, windowIndex) => {
      const [startHour, startMinute] = window.start.split(':').map(Number);
      const [endHour, endMinute] = window.end.split(':').map(Number);
      
      const windowStart = new Date(selectedDateObj);
      windowStart.setHours(startHour, startMinute, 0, 0);
      
      const windowEnd = new Date(selectedDateObj);
      windowEnd.setHours(endHour, endMinute, 0, 0);
      
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

    return timeWindows;
  };

  const timeWindows = getTimeWindows();

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && (over.id.toString().startsWith('timeline-left-') ||
                 over.id.toString().startsWith('timeline-right-') ||
                 over.id.toString().startsWith('timeline-c-') ||
                 over.id.toString().startsWith('timeline-d-'))) {
      const isLeftSide = over.id.toString().startsWith('timeline-left-');
      const isRightSide = over.id.toString().startsWith('timeline-right-');
      const isCSlot = over.id.toString().startsWith('timeline-c-');
      const isDSlot = over.id.toString().startsWith('timeline-d-');
      
      let timeSlotId = '';
      let side: 'A' | 'B' | 'C' | 'D' = 'A';
      
      if (isLeftSide) {
        timeSlotId = over.id.toString().replace('timeline-left-', '');
        side = 'A';
      } else if (isRightSide) {
        timeSlotId = over.id.toString().replace('timeline-right-', '');
        side = 'B';
      } else if (isCSlot) {
        timeSlotId = over.id.toString().replace('timeline-c-', '');
        side = 'C';
      } else if (isDSlot) {
        timeSlotId = over.id.toString().replace('timeline-d-', '');
        side = 'D';
      }
      const registration = registrations.find(reg => reg.id === active.id);
      
      if (registration) {
        // Check if user can interact with this registration
        if (!canUserInteractWithRegistration(registration)) {
          if (userRegistration.mode === 'TEAM' && registration.team?.name === userRegistration.teamName) {
            showError('Only the team leader can schedule matches for this team', 'Permission Denied');
          } else {
            showError('You can only schedule your own team/registration', 'Permission Denied');
          }
          setActiveId(null);
          return;
        }

        // For scoring contests, only allow slot A
        if (gameData?.contestType === 'SCORING' && side !== 'A') {
          showError('For scoring contests, you can only assign to slot A', 'Invalid Assignment');
          setActiveId(null);
          return;
        }

        // For 1v1v1v1 format, allow all slots C and D
        if (gameData?.contestType === 'SINGLE_ELIMINATION_1V1V1V1' && (side === 'C' || side === 'D')) {
          // Additional slots are allowed for 1v1v1v1 format
        }

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

          // Check if there's already a match for this time slot and validate slot occupancy
          const existingMatch = scheduledMatches.find(match => match.timeSlotId === timeSlotId);
          if (existingMatch) {
            // For 1v1v1v1 format, check if the specific slot position is already occupied
            if (gameData?.contestType === 'SINGLE_ELIMINATION_1V1V1V1') {
              let isSlotOccupied = false;
              
              if (side === 'A' && existingMatch.participantA && existingMatch.participantA !== '') {
                isSlotOccupied = true;
              } else if (side === 'B' && existingMatch.participantB && existingMatch.participantB !== '') {
                isSlotOccupied = true;
              } else if (side === 'C' && existingMatch.participantC && existingMatch.participantC !== '') {
                isSlotOccupied = true;
              } else if (side === 'D' && existingMatch.participantD && existingMatch.participantD !== '') {
                isSlotOccupied = true;
              }
              
              if (isSlotOccupied) {
                showError('This slot position is already occupied by another participant', 'Slot Already Occupied');
                setActiveId(null);
                return;
              }
            } else {
              // Original validation for 2-participant matches
              if ((side === 'A' && existingMatch.participantA && existingMatch.participantA !== '') ||
                  (side === 'B' && existingMatch.participantB && existingMatch.participantB !== '')) {
                showError('This slot position is already occupied by another participant', 'Slot Already Occupied');
                setActiveId(null);
                return;
              }
            }
          }

          // Make API call to create/update match in real-time
          const response = await apiCall(`/api/games/${gameId}/user-matches`, {
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
              timelineId: selectedTimeline
            }),
          });

          if (!response.ok) {
            throw new Error('Failed to create/update match');
          }

          const result = await response.json();
          
          // Update local state
          const participantName = registration.mode === 'TEAM' && registration.team
            ? registration.team.name
            : `${registration.user.firstName} ${registration.user.lastName}`;
          
          // Check if there's already a match for this time slot
          const existingMatchIndex = scheduledMatches.findIndex(match => match.timeSlotId === timeSlotId);
          
          if (existingMatchIndex >= 0) {
            // Update existing match
            const updatedMatches = [...scheduledMatches];
            if (side === 'A') {
              updatedMatches[existingMatchIndex].participantA = participantName;
              updatedMatches[existingMatchIndex].registrationAId = registration.id;
            } else if (side === 'B') {
              updatedMatches[existingMatchIndex].participantB = participantName;
              updatedMatches[existingMatchIndex].registrationBId = registration.id;
            } else if (side === 'C') {
              updatedMatches[existingMatchIndex].participantC = participantName;
              updatedMatches[existingMatchIndex].registrationCId = registration.id;
            } else if (side === 'D') {
              updatedMatches[existingMatchIndex].participantD = participantName;
              updatedMatches[existingMatchIndex].registrationDId = registration.id;
            }
            setScheduledMatches(updatedMatches);
          } else {
            // Create new match
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
              timeSlotId
            };
            setScheduledMatches(prev => [...prev, newMatch]);
          }
          
          // Add registration to scheduled list
          setScheduledRegistrationIds(prev => new Set([...prev, registration.id]));

        } catch (error) {
          console.error('Error creating/updating match:', error);
          showError('Failed to schedule match. Please try again.', 'Scheduling Error');
        }
      }
    }
    
    setActiveId(null);
  };

  // Handle unscheduling a participant (user can only unschedule themselves)
  const handleUnschedule = async (match: any, side: 'A' | 'B' | 'C' | 'D') => {
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

      // Check if the match time has passed
      const timeWindow = getTimeWindows().find((tw: any) => tw.id === match.timeSlotId);
      if (timeWindow) {
        const matchTime = new Date(timeWindow.startTime);
        const now = new Date();
        if (matchTime <= now) {
          showError('Cannot unschedule - match time has already passed', 'Time Expired');
          return;
        }
      }

      // Make API call to unschedule participant
      const response = await apiCall(`/api/games/${gameId}/user-matches?matchId=${match.id}&side=${side}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to unschedule participant');
      }

      // Reload the schedule data to reflect changes
      await loadExistingMatches();
    } catch (error) {
      console.error('Error unscheduling participant:', error);
      showError('Failed to unschedule. Please try again.', 'Unschedule Error');
    }
  };

  const handleParticipantClick = (registrationId: string) => {
    console.log('handleParticipantClick called:', { registrationId, selectedParticipant });
    // Toggle selection - if clicking the same participant, deselect it, otherwise select the new one
    setSelectedParticipant(selectedParticipant === registrationId ? null : registrationId);
  };

  const handleTimeSlotClick = async (timeSlot: string, timeline: number, side: 'A' | 'B' | 'C' | 'D' = 'A') => {
    console.log('handleTimeSlotClick called:', { timeSlot, timeline, side, isMobile, selectedParticipant, selectedDate });
    // Enable assign functionality for both mobile and PC when a participant is selected
    if (selectedParticipant) {
      try {
        // Find the selected registration to get participant details
        const registration = registrations.find(reg => reg.id === selectedParticipant);
        if (!registration) {
          console.error('Selected registration not found');
          throw new Error('Selected registration not found');
        }

        // Check if user can interact with this registration
        if (!canUserInteractWithRegistration(registration)) {
          if (userRegistration.mode === 'TEAM' && registration.team?.name === userRegistration.teamName) {
            showError('Only the team leader can schedule matches for this team', 'Permission Denied');
          } else {
            showError('You can only schedule your own team/registration', 'Permission Denied');
          }
          return;
        }

        // For scoring contests, only allow slot A
        if (gameData?.contestType === 'SCORING' && side === 'B') {
          showError('For scoring contests, you can only assign to slot A', 'Invalid Assignment');
          return;
        }

        // Use the same time window system as drag-and-drop
        const generatedTimeWindows = getTimeWindows();
        
        // Find the time window that matches the clicked time slot
        // The timeSlot parameter is in format "HH:MM" (e.g., "09:00")
        const timeWindow = generatedTimeWindows.find((tw: any) => {
          // Match by timeline and start time
          const timeWindowStartTime = tw.startTime.toTimeString().slice(0, 5);
          return tw.timelineId === timeline && timeWindowStartTime === timeSlot;
        });

        if (!timeWindow) {
          console.error('Time window not found for slot:', { timeSlot, timeline });
          throw new Error('Time slot not found');
        }

        // Validate that timeWindow has valid dates
        if (isNaN(timeWindow.startTime.getTime()) || isNaN(timeWindow.endTime.getTime())) {
          console.error('Invalid dates in timeWindow:', timeWindow);
          throw new Error('Invalid time slot selected');
        }

        // Determine participant type and ID
        const participantType = registration.mode === 'TEAM' ? 'TEAM' : 'USER';
        const participantId = registration.mode === 'TEAM' && registration.team
          ? registration.team.id
          : registration.user.id;

        // Use the time window ID as timeSlotId (same as drag-and-drop)
        const timeSlotId = timeWindow.id;

        // Check if there's already a match for this time slot and validate against self-scheduling
        const existingMatch = scheduledMatches.find(match => match.timeSlotId === timeSlotId);
        if (existingMatch) {
          const otherParticipantId = side === 'A' ? existingMatch.participantBId : existingMatch.participantAId;
          if (otherParticipantId && otherParticipantId !== 'TBD' && otherParticipantId === participantId) {
            showError('You cannot be scheduled to play against yourself', 'Self-Scheduling Not Allowed');
            setSelectedParticipant(null);
            return;
          }
        }

        console.log('Attempting to schedule match:', {
          timeSlotId,
          participantId,
          participantType,
          side,
          startTime: timeWindow.startTime.toISOString(),
          endTime: timeWindow.endTime.toISOString(),
          timelineId: timeline,
        });

        // Use the user-specific API endpoint
        const response = await apiCall(`/api/games/${gameId}/user-matches`, {
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
            timelineId: timeline,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Failed to schedule match' }));
          console.error('API response error:', errorData);
          
          // Show specific error message from API
          showError(errorData.error || 'Failed to schedule match. Please try again.', 'Scheduling Conflict');
          return;
        }

        const result = await response.json();
        console.log('Match scheduled successfully:', result);

        // Update local state like drag-and-drop system does
        const participantName = registration.mode === 'TEAM' && registration.team
          ? registration.team.name
          : `${registration.user.firstName} ${registration.user.lastName}`;
        
        // Check if there's already a match for this time slot
        const existingMatchIndex = scheduledMatches.findIndex(match => match.timeSlotId === timeSlotId);
        
        if (existingMatchIndex >= 0) {
          // Update existing match
          const updatedMatches = [...scheduledMatches];
          if (side === 'A') {
            updatedMatches[existingMatchIndex].participantA = participantName;
            updatedMatches[existingMatchIndex].registrationAId = registration.id;
          } else if (side === 'B') {
            updatedMatches[existingMatchIndex].participantB = participantName;
            updatedMatches[existingMatchIndex].registrationBId = registration.id;
          } else if (side === 'C') {
            updatedMatches[existingMatchIndex].participantC = participantName;
            updatedMatches[existingMatchIndex].registrationCId = registration.id;
          } else if (side === 'D') {
            updatedMatches[existingMatchIndex].participantD = participantName;
            updatedMatches[existingMatchIndex].registrationDId = registration.id;
          }
          setScheduledMatches(updatedMatches);
        } else {
          // Create new match
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
            timeSlotId
          };
          setScheduledMatches(prev => [...prev, newMatch]);
        }
        
        // Add registration to scheduled list
        setScheduledRegistrationIds(prev => new Set([...prev, registration.id]));
        
        setSelectedParticipant(null); // Clear selection after scheduling
      } catch (error) {
        console.error('Error scheduling match:', error);
        // Show user-friendly error message using alert system
        showError('Failed to schedule match. Please try again.', 'Scheduling Error');
      }
    } else {
      console.log('Conditions not met for scheduling:', { selectedParticipant });
    }
  };

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

    const canInteract = canUserInteractWithRegistration(registration);
    const isComplete = registration.isComplete;
    const canSchedule = canInteract && isComplete && !scheduledRegistrationIds.has(registration.id);
    const isSelected = selectedParticipant === registration.id;

    return (
      <Card
        ref={setNodeRef}
        style={style}
        className={`${
          canSchedule
            ? `bg-slate-800/50 border-slate-600 hover:bg-slate-800/70 cursor-pointer ${isSelected ? 'ring-2 ring-blue-500 bg-blue-900/30' : ''}`
            : !isComplete
            ? 'bg-red-900/20 border-red-600/50 opacity-70'
            : 'bg-slate-700/30 border-slate-600/50 opacity-60'
        } transition-colors ${isDragging ? 'shadow-lg' : ''}`}
        onPointerDown={(e) => {
          if (canSchedule) {
            // Always handle click for selection first
            e.preventDefault();
            e.stopPropagation();
            handleParticipantClick(registration.id);
          }
        }}
      >
        <CardContent className="p-2 sm:p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1">
              {canSchedule && <GripVertical className="h-3 w-3 sm:h-4 sm:w-4 text-slate-400 flex-shrink-0" />}
              {!canSchedule && <Lock className="h-3 w-3 sm:h-4 sm:w-4 text-slate-500 flex-shrink-0" />}
              <div className="h-6 w-6 sm:h-8 sm:w-8 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                {registration.mode === 'TEAM' ? (
                  <Users className="h-3 w-3 sm:h-4 sm:w-4 text-blue-400" />
                ) : (
                  <User className="h-3 w-3 sm:h-4 sm:w-4 text-blue-400" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-medium text-white text-xs sm:text-sm flex items-center flex-wrap gap-1 sm:gap-2">
                  <span className="truncate">
                    {registration.mode === 'TEAM' && registration.team
                      ? registration.team.name
                      : formatParticipantName(registration.user.firstName, registration.user.lastName)
                    }
                  </span>
                  {!isComplete && registration.mode === 'TEAM' && (
                    <span className="text-xs bg-red-500/20 text-red-400 px-1 sm:px-2 py-0.5 rounded whitespace-nowrap flex-shrink-0">
                      <span className="hidden sm:inline">INCOMPLETE TEAM</span>
                      <span className="sm:hidden">INCOMPLETE</span>
                    </span>
                  )}
                  {isComplete && scheduledRegistrationIds.has(registration.id) && (
                    <span className="text-xs bg-green-500/20 text-green-400 px-1 sm:px-2 py-0.5 rounded whitespace-nowrap flex-shrink-0">
                      <span className="hidden sm:inline">SCHEDULED</span>
                      <span className="sm:hidden">SCHEDULED</span>
                    </span>
                  )}
                  {!canInteract && isComplete && userRegistration.mode === 'TEAM' && registration.team?.name === userRegistration.teamName && (
                    <span className="text-xs bg-yellow-500/20 text-yellow-400 px-1 sm:px-2 py-0.5 rounded whitespace-nowrap flex-shrink-0">
                      <span className="hidden sm:inline">TEAM LEADER ONLY</span>
                      <span className="sm:hidden">LEADER ONLY</span>
                    </span>
                  )}
                  {!canInteract && isComplete && !(userRegistration.mode === 'TEAM' && registration.team?.name === userRegistration.teamName) && (
                    <span className="text-xs bg-slate-500/20 text-slate-400 px-1 sm:px-2 py-0.5 rounded whitespace-nowrap flex-shrink-0">
                      <span className="hidden sm:inline">OTHER TEAM</span>
                      <span className="sm:hidden">OTHER</span>
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  {registration.level} • {registration.mode}
                  {registration.mode === 'TEAM' && registration.team && (
                    <span className="ml-1">
                      • {registration.team.actualSize}/{registration.team.requiredSize} members
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  // Helper function to render a participant slot
  const renderParticipantSlot = (
    side: 'A' | 'B' | 'C' | 'D',
    droppable: any,
    participantName: string | undefined,
    registrationId: string | undefined,
    userInvolved: any,
    isWinner: boolean,
    timeWindow: any,
    existingMatch: any
  ) => {
    const sideLabels = {
      A: window.innerWidth < 640 ? 'A' : 'Team A',
      B: window.innerWidth < 640 ? 'B' : 'Team B',
      C: window.innerWidth < 640 ? 'C' : 'Team C',
      D: window.innerWidth < 640 ? 'D' : 'Team D'
    };

    return (
      <div
        ref={droppable.setNodeRef}
        className={`border-2 border-dashed rounded-md p-2 transition-colors flex items-center justify-center min-h-[60px] sm:min-h-[80px] ${
          droppable.isOver
            ? 'border-blue-400 bg-blue-400/10'
            : userInvolved
            ? 'border-blue-400/50 bg-blue-400/5'
            : `border-slate-500 hover:border-blue-400 ${selectedParticipant ? 'cursor-pointer' : ''}`
        }`}
        onClick={() => selectedParticipant && !participantName && handleTimeSlotClick(timeWindow.startTime.toTimeString().slice(0, 5), selectedTimeline, side)}
      >
        {participantName ? (
          <div className="w-full relative">
            <div className={`text-xs sm:text-sm font-medium text-center p-1 rounded transition-colors w-full flex items-center justify-between ${
              isWinner
                ? 'text-yellow-300 bg-yellow-500/20 border border-yellow-500/50'
                : userInvolved
                ? 'text-blue-300 bg-blue-500/10 border border-blue-500/30'
                : 'text-white hover:bg-slate-600/50'
            }`}>
              <div className="flex flex-col items-center space-y-0.5 flex-1">
                <div className="flex items-center justify-center space-x-1 flex-wrap">
                  {isWinner && (
                    <span className="text-xs flex-shrink-0">🏆</span>
                  )}
                  {userInvolved && !isWinner && (
                    <span className="text-xs flex-shrink-0">👤</span>
                  )}
                  <span className="truncate min-w-0">
                    {participantName && existingMatch ?
                      reformatExistingParticipantName(
                        participantName,
                        side === 'A' ? existingMatch.participantAId || '' :
                        side === 'B' ? existingMatch.participantBId || '' :
                        side === 'C' ? existingMatch.participantCId || '' :
                        existingMatch.participantDId || '',
                        side === 'A' ? existingMatch.participantAType || '' :
                        side === 'B' ? existingMatch.participantBType || '' :
                        side === 'C' ? existingMatch.participantCType || '' :
                        existingMatch.participantDType || '',
                        registrations
                      ) : participantName
                    }
                  </span>
                  {isWinner && (
                    <span className="text-xs bg-yellow-500/30 text-yellow-200 px-1 rounded whitespace-nowrap flex-shrink-0">WINNER</span>
                  )}
                </div>
                {(() => {
                  const registration = registrations.find(reg => reg.id === registrationId);
                  return (
                    <>
                      {registration?.mode === 'TEAM' && registration.team?.members && registration.team.members.length > 0 && (
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
                    </>
                  );
                })()}
              </div>
              {(() => {
                const registration = registrations.find(reg => reg.id === registrationId);
                if (!registration) return null;
                return (
                  <div className="ml-2 flex-shrink-0 h-full flex items-center">
                    <div
                      className={`px-1 py-2 rounded text-xs font-medium border ${getLevelColor(registration.level).bg} ${getLevelColor(registration.level).text} ${getLevelColor(registration.level).border}`}
                      style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
                    >
                      {registration.level}
                    </div>
                  </div>
                );
              })()}
            </div>
            {userInvolved && !existingMatch?.winnerId && (() => {
              const matchTime = new Date(timeWindow.startTime);
              const now = new Date();
              const canUnschedule = matchTime > now;
              
              return canUnschedule ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleUnschedule(existingMatch, side);
                  }}
                  className="absolute -top-1 -right-1 w-5 h-5 bg-red-500/80 hover:bg-red-500 text-white rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95 z-20 shadow-sm"
                  title="Remove yourself from this match"
                >
                  <X className="h-3 w-3" />
                </button>
              ) : !existingMatch?.winnerId ? (
                <div className="absolute -top-1 -right-1 w-5 h-5 bg-slate-500/50 text-slate-400 rounded-full flex items-center justify-center text-xs z-20 pointer-events-none">
                  <Clock className="h-2.5 w-2.5" />
                </div>
              ) : null;
            })()}
          </div>
        ) : (
          <div className="text-xs text-slate-400 text-center">
            {droppable.isOver
              ? 'Drop here'
              : selectedParticipant
              ? 'Tap to schedule'
              : gameData?.contestType === 'SCORING'
              ? (window.innerWidth < 640 ? 'Participant' : 'Participant Slot')
              : sideLabels[side]
            }
          </div>
        )}
      </div>
    );
  };

  // Droppable Timeline Slot Component with support for 2 or 4 participants
  const DroppableTimeSlot = ({ timeWindow }: { timeWindow: any }) => {
    const leftDroppable = useDroppable({
      id: `timeline-left-${timeWindow.id}`,
    });
    
    const rightDroppable = useDroppable({
      id: `timeline-right-${timeWindow.id}`,
    });

    const topDroppable = useDroppable({
      id: `timeline-c-${timeWindow.id}`,
    });
    
    const bottomDroppable = useDroppable({
      id: `timeline-d-${timeWindow.id}`,
    });

    // Find existing match for this time slot
    const existingMatch = scheduledMatches.find(match => match.timeSlotId === timeWindow.id);

    // Check if user is involved in this match (for all 4 participants)
    const userInvolvedA = existingMatch && existingMatch.registrationAId &&
      registrations.find(reg => reg.id === existingMatch.registrationAId && canUserInteractWithRegistration(reg));
    const userInvolvedB = existingMatch && existingMatch.registrationBId &&
      registrations.find(reg => reg.id === existingMatch.registrationBId && canUserInteractWithRegistration(reg));
    const userInvolvedC = existingMatch && existingMatch.registrationCId &&
      registrations.find(reg => reg.id === existingMatch.registrationCId && canUserInteractWithRegistration(reg));
    const userInvolvedD = existingMatch && existingMatch.registrationDId &&
      registrations.find(reg => reg.id === existingMatch.registrationDId && canUserInteractWithRegistration(reg));
    const userInvolved = userInvolvedA || userInvolvedB || userInvolvedC || userInvolvedD;

    // Winner detection logic - check both registration IDs and participant IDs
    const isWinnerA = existingMatch?.winnerId && (
      existingMatch.winnerId === existingMatch.registrationAId ||
      existingMatch.winnerId === existingMatch.participantAId
    );
    const isWinnerB = existingMatch?.winnerId && (
      existingMatch.winnerId === existingMatch.registrationBId ||
      existingMatch.winnerId === existingMatch.participantBId
    );
    const isWinnerC = existingMatch?.winnerId && (
      existingMatch.winnerId === existingMatch.registrationCId ||
      existingMatch.winnerId === existingMatch.participantCId
    );
    const isWinnerD = existingMatch?.winnerId && (
      existingMatch.winnerId === existingMatch.registrationDId ||
      existingMatch.winnerId === existingMatch.participantDId
    );
    const hasWinner = Boolean(existingMatch?.winnerId);
    const isConcluded = hasWinner;

    // Check if this is a 1v1v1v1 format
    const is1v1v1v1 = gameData?.contestType === 'SINGLE_ELIMINATION_1V1V1V1';

    // Debug logging for winner detection
    if (existingMatch?.winnerId) {
      console.log('Winner Detection Debug:', {
        winnerId: existingMatch.winnerId,
        registrationAId: existingMatch.registrationAId,
        registrationBId: existingMatch.registrationBId,
        registrationCId: existingMatch.registrationCId,
        registrationDId: existingMatch.registrationDId,
        participantAId: existingMatch.participantAId,
        participantBId: existingMatch.participantBId,
        participantCId: existingMatch.participantCId,
        participantDId: existingMatch.participantDId,
        isWinnerA,
        isWinnerB,
        isWinnerC,
        isWinnerD,
        participantA: existingMatch.participantA,
        participantB: existingMatch.participantB,
        participantC: existingMatch.participantC,
        participantD: existingMatch.participantD
      });
    }

    return (
      <div className={`rounded-lg border-2 min-h-[100px] p-3 relative ${
        isConcluded
          ? 'bg-green-500/10 border-green-500/50'
          : userInvolved
          ? 'bg-blue-500/10 border-blue-500/50'
          : 'bg-slate-700/50 border-slate-600'
      }`}>
        <div className="flex items-center justify-between mb-3">
          <span className={`text-sm font-medium ${
            isConcluded ? 'text-green-300' : userInvolved ? 'text-blue-300' : 'text-slate-300'
          }`}>
            {timeWindow.label}
          </span>
          <div className="flex items-center space-x-2">
            {isConcluded && (
              <span className="text-xs bg-green-500/20 text-green-300 px-2 py-0.5 rounded border border-green-500/30">
                CONCLUDED
              </span>
            )}
            {userInvolved && !isConcluded && (
              <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded border border-blue-500/30">
                YOUR MATCH
              </span>
            )}
            {userInvolved && isConcluded && (
              <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded border border-blue-500/30">
                YOUR MATCH
              </span>
            )}
            <span className="text-xs text-slate-400">
              {selectedParticipant ? 'Click side to assign selected team' : ''}
            </span>
          </div>
        </div>
        
        {/* Dynamic layout based on contest type */}
        <div className={`min-h-[60px] sm:min-h-[80px] ${
          gameData?.contestType === 'SCORING'
            ? 'flex flex-col gap-2 sm:gap-3'
            : is1v1v1v1
            ? 'grid grid-cols-2 gap-2 sm:gap-3'
            : 'flex flex-col gap-2 sm:gap-3 sm:grid sm:grid-cols-2'
        }`}>
          {/* Render participants based on contest type */}
          {is1v1v1v1 ? (
            <>
              {/* 4-participant layout for 1v1v1v1 */}
              {renderParticipantSlot('A', leftDroppable, existingMatch?.participantA, existingMatch?.registrationAId, userInvolvedA, !!isWinnerA, timeWindow, existingMatch)}
              {renderParticipantSlot('B', rightDroppable, existingMatch?.participantB, existingMatch?.registrationBId, userInvolvedB, !!isWinnerB, timeWindow, existingMatch)}
              {renderParticipantSlot('C', topDroppable, existingMatch?.participantC, existingMatch?.registrationCId, userInvolvedC, !!isWinnerC, timeWindow, existingMatch)}
              {renderParticipantSlot('D', bottomDroppable, existingMatch?.participantD, existingMatch?.registrationDId, userInvolvedD, !!isWinnerD, timeWindow, existingMatch)}
            </>
          ) : (
            <>
              {/* Standard 2-participant layout */}
              {renderParticipantSlot('A', leftDroppable, existingMatch?.participantA, existingMatch?.registrationAId, userInvolvedA, !!isWinnerA, timeWindow, existingMatch)}
              
              {/* VS indicator for 2-participant matches */}
              {gameData?.contestType !== 'SCORING' && existingMatch?.participantA && existingMatch?.participantB && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                  <span className={`text-xs px-2 py-1 rounded font-bold ${
                    isConcluded
                      ? 'text-green-300 bg-green-600/20 border border-green-500/30'
                      : userInvolved
                      ? 'text-blue-300 bg-blue-600/20 border border-blue-500/30'
                      : 'text-slate-400 bg-slate-600'
                  }`}>
                    VS
                  </span>
                </div>
              )}
              
              {/* Right participant for 2-participant matches */}
              {gameData?.contestType !== 'SCORING' && renderParticipantSlot('B', rightDroppable, existingMatch?.participantB, existingMatch?.registrationBId, userInvolvedB, !!isWinnerB, timeWindow, existingMatch)}
            </>
          )}
        </div>

      </div>
    );
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
        <Card className="w-full max-w-md bg-slate-800 border-slate-700">
          <CardContent className="p-8 text-center">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-400" />
            <p className="text-white">Loading schedule data...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!gameData) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
        <Card className="w-full max-w-md bg-slate-800 border-slate-700">
          <CardContent className="p-8 text-center">
            <AlertCircle className="h-8 w-8 mx-auto mb-4 text-red-400" />
            <p className="text-white mb-4">Failed to load game data</p>
            <Button onClick={onClose} variant="outline">Close</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const userRegs = getUserRegistrations();

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-0 sm:p-4 z-50">
        <div className="w-full h-full sm:max-w-7xl sm:h-[95vh] bg-slate-900 sm:rounded-lg border-0 sm:border sm:border-slate-700 flex flex-col relative">
          {/* Close button - Top right corner for mobile */}
          <Button
            onClick={onClose}
            variant="outline"
            size="sm"
            className="absolute top-2 right-2 z-10 sm:hidden bg-slate-800/90 border-slate-600 hover:bg-slate-700"
          >
            <X className="h-4 w-4" />
          </Button>
          
          {/* Header */}
          <div className="bg-slate-800 border-b border-slate-700 p-3 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="min-w-0 flex-1 pr-12 sm:pr-0">
                <h2 className="text-lg sm:text-2xl font-bold text-white flex items-center">
                  <Calendar className="h-5 w-5 sm:h-6 sm:w-6 mr-2 sm:mr-3 text-blue-400 flex-shrink-0" />
                  <span className="truncate">Schedule: {gameData.name}</span>
                </h2>
                <p className="text-slate-300 mt-1 text-sm sm:text-base">
                  {contestTypeLabels[gameData.contestType as keyof typeof contestTypeLabels]} •
                  {gameData.typeFormat} • {gameData.avgGameTime} min/game
                </p>
              </div>
              {/* Close button for desktop */}
              <div className="hidden sm:flex items-center justify-end">
                <Button onClick={onClose} variant="outline" size="sm">
                  <X className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Close</span>
                </Button>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="flex flex-col flex-1 min-h-0">
            {/* Auto-selection indicator */}
            {selectedParticipant && (
              <div className="p-3 sm:p-4 border-b border-slate-700 bg-slate-800/50">
                <div className="p-2 bg-blue-500/10 border border-blue-500/30 rounded-md">
                  <p className="text-xs sm:text-sm text-blue-300 flex items-center">
                    <Target className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                    Auto-selected: {(() => {
                      const reg = registrations.find(r => r.id === selectedParticipant);
                      return reg?.mode === 'TEAM' && reg.team ? reg.team.name : reg ? `${reg.user.firstName} ${reg.user.lastName}` : '';
                    })()} - Click a time slot to assign
                  </p>
                </div>
              </div>
            )}

            {/* Schedule Editor - Full Width */}
            <div className="flex-1 flex flex-col min-h-0">
              <div className="p-3 sm:p-4 border-b border-slate-700">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
                  <h3 className="text-base sm:text-lg font-semibold text-white flex items-center">
                    <Calendar className="h-4 w-4 sm:h-5 sm:w-5 mr-2 text-blue-400 flex-shrink-0" />
                    <span className="truncate">Match Schedule</span>
                  </h3>
                  
                  {/* Date Filter */}
                  {gameData?.category && (
                    <div className="grid grid-cols-4 sm:flex sm:flex-row sm:items-center gap-2">
                      <label className="col-span-1 text-xs sm:text-sm text-slate-400 whitespace-nowrap">Select Date:</label>
                      <select
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="col-span-3 bg-slate-800 border border-slate-600 rounded-md px-2 sm:px-3 py-1 text-white text-xs sm:text-sm min-w-[120px] sm:min-w-[140px]"
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
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex-1 flex flex-col min-h-0">
                {selectedDate ? (
                  <div className="flex-1 flex flex-col p-2 sm:p-4 min-h-0">
                    {/* Timeline Interface */}
                    <div className="flex-1 flex flex-col bg-slate-800/30 rounded-lg border border-slate-600 min-h-0">
                      <div className="p-3 sm:p-4 border-b border-slate-600">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4 mb-3 sm:mb-4">
                          <h4 className="text-white font-medium text-sm sm:text-base">
                            <span className="hidden sm:inline">Timeline - </span>
                            {new Date(selectedDate).toLocaleDateString('en-US', {
                              weekday: window.innerWidth < 640 ? 'short' : 'long',
                              month: window.innerWidth < 640 ? 'short' : 'long',
                              day: 'numeric'
                            })}
                          </h4>
                          
                          {/* Timeline Tabs/Dropdown */}
                          {gameData.simultaneousGames > 1 && (
                            <div className="flex items-center space-x-2">
                              <span className="text-sm text-slate-400">Court/Timeline:</span>
                              {gameData.simultaneousGames <= 2 ? (
                                <div className="flex bg-slate-700 rounded-lg p-1">
                                  {Array.from({ length: gameData.simultaneousGames }, (_, index) => {
                                    const timelineId = index + 1;
                                    return (
                                      <button
                                        key={timelineId}
                                        onClick={() => setSelectedTimeline(timelineId)}
                                        className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                                          selectedTimeline === timelineId
                                            ? 'bg-blue-500 text-white'
                                            : 'text-slate-300 hover:text-white hover:bg-slate-600'
                                        }`}
                                      >
                                        Court {timelineId}
                                      </button>
                                    );
                                  })}
                                </div>
                              ) : (
                                <select
                                  value={selectedTimeline}
                                  onChange={(e) => setSelectedTimeline(parseInt(e.target.value))}
                                  className="bg-slate-700 border border-slate-600 rounded-md px-3 py-1 text-white text-sm min-w-[100px]"
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
                      
                      <div className="flex-1 overflow-y-auto p-2 sm:p-4 space-y-3 min-h-0" style={{ touchAction: 'pan-y', WebkitOverflowScrolling: 'touch', maxHeight: 'calc(100vh - 300px)' }}>
                        {getTimeWindows().map((timeWindow) => (
                          <DroppableTimeSlot key={timeWindow.id} timeWindow={timeWindow} />
                        ))}
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
      
      <DragOverlay>
        {activeId ? (
          <div className="bg-slate-800 border border-blue-400 rounded-lg p-3 shadow-lg">
            <div className="text-white text-sm font-medium">
              {(() => {
                const registration = registrations.find(reg => reg.id === activeId);
                return registration?.mode === 'TEAM' && registration.team
                  ? registration.team.name
                  : registration ? `${registration.user.firstName} ${registration.user.lastName}` : '';
              })()}
            </div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
                  
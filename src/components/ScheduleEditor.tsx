
"use client";

import { useState } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import {
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, MapPin, Users, Trophy, AlertCircle, CheckCircle } from "lucide-react";

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
}

interface TimeSlot {
  id: string;
  startTime: Date;
  endTime: Date;
  venueId: string;
  venueName: string;
  courtId: string;
  courtName: string;
  matches: ScheduleMatch[];
}

interface ScheduleEditorProps {
  timeSlots: TimeSlot[];
  onScheduleChange: (updatedSlots: TimeSlot[]) => void;
}

function SortableMatch({ match }: { match: ScheduleMatch }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: match.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'conflict':
        return <AlertCircle className="h-4 w-4 text-red-400" />;
      case 'confirmed':
        return <CheckCircle className="h-4 w-4 text-green-400" />;
      default:
        return <Clock className="h-4 w-4 text-blue-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'conflict':
        return 'border-red-500/50 bg-red-500/10';
      case 'confirmed':
        return 'border-green-500/50 bg-green-500/10';
      default:
        return 'border-slate-600 bg-slate-700/50';
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`p-3 rounded-lg border cursor-move transition-colors ${getStatusColor(match.status)}`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          <Trophy className="h-4 w-4 text-orange-400" />
          <span className="font-medium text-white text-sm">{match.gameName}</span>
        </div>
        {getStatusIcon(match.status)}
      </div>
      
      <div className="text-sm text-slate-300 mb-2">
        <div className="flex items-center space-x-1">
          <Users className="h-3 w-3" />
          <span>{match.participantA} vs {match.participantB}</span>
        </div>
      </div>
      
      <div className="flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center space-x-1">
          <Clock className="h-3 w-3" />
          <span>
            {match.startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - 
            {match.endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
        <div className="flex items-center space-x-1">
          <MapPin className="h-3 w-3" />
          <span>{match.courtName}</span>
        </div>
      </div>
    </div>
  );
}

function TimeSlotColumn({ timeSlot, onMatchesChange }: { 
  timeSlot: TimeSlot; 
  onMatchesChange: (slotId: string, matches: ScheduleMatch[]) => void;
}) {
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over || active.id === over.id) return;
    
    const oldIndex = timeSlot.matches.findIndex(match => match.id === active.id);
    const newIndex = timeSlot.matches.findIndex(match => match.id === over.id);
    
    if (oldIndex !== -1 && newIndex !== -1) {
      const newMatches = arrayMove(timeSlot.matches, oldIndex, newIndex);
      onMatchesChange(timeSlot.id, newMatches);
    }
  };

  const formatTimeRange = (start: Date, end: Date) => {
    return `${start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  return (
    <Card className="bg-slate-800/50 border-slate-700 min-h-[400px]">
      <CardHeader className="pb-3">
        <CardTitle className="text-white text-lg flex items-center justify-between">
          <div>
            <div className="flex items-center space-x-2">
              <MapPin className="h-5 w-5 text-green-400" />
              <span>{timeSlot.venueName} - {timeSlot.courtName}</span>
            </div>
            <div className="text-sm text-slate-400 font-normal mt-1">
              {formatTimeRange(timeSlot.startTime, timeSlot.endTime)}
            </div>
          </div>
          <div className="text-sm text-slate-400">
            {timeSlot.matches.length} matches
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <SortableContext items={timeSlot.matches.map(m => m.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-3">
            {timeSlot.matches.map((match) => (
              <SortableMatch key={match.id} match={match} />
            ))}
            {timeSlot.matches.length === 0 && (
              <div className="text-center py-8 text-slate-400">
                <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No matches scheduled</p>
                <p className="text-xs">Drag matches here to schedule</p>
              </div>
            )}
          </div>
        </SortableContext>
      </CardContent>
    </Card>
  );
}

export default function ScheduleEditor({ timeSlots, onScheduleChange }: ScheduleEditorProps) {
  const [slots, setSlots] = useState<TimeSlot[]>(timeSlots);
  const [activeMatch, setActiveMatch] = useState<ScheduleMatch | null>(null);
  const [conflicts, setConflicts] = useState<string[]>([]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const matchId = event.active.id as string;
    const match = slots
      .flatMap(slot => slot.matches)
      .find(m => m.id === matchId);
    
    if (match) {
      setActiveMatch(match);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveMatch(null);

    if (!over) return;

    const matchId = active.id as string;
    const targetSlotId = over.id as string;

    // Find source and target slots
    const sourceSlot = slots.find(slot => 
      slot.matches.some(match => match.id === matchId)
    );
    const targetSlot = slots.find(slot => slot.id === targetSlotId);

    if (!sourceSlot || !targetSlot || sourceSlot.id === targetSlot.id) return;

    // Move match between slots
    const match = sourceSlot.matches.find(m => m.id === matchId);
    if (!match) return;

    const updatedSlots = slots.map(slot => {
      if (slot.id === sourceSlot.id) {
        return {
          ...slot,
          matches: slot.matches.filter(m => m.id !== matchId)
        };
      }
      if (slot.id === targetSlot.id) {
        // Update match timing to match the new slot
        const updatedMatch = {
          ...match,
          startTime: slot.startTime,
          endTime: slot.endTime,
          venueId: slot.venueId,
          venueName: slot.venueName,
          courtId: slot.courtId,
          courtName: slot.courtName
        };
        return {
          ...slot,
          matches: [...slot.matches, updatedMatch]
        };
      }
      return slot;
    });

    setSlots(updatedSlots);
    
    // Check for conflicts
    const newConflicts = detectConflicts(updatedSlots);
    setConflicts(newConflicts);
    
    // Update parent component
    onScheduleChange(updatedSlots);
  };

  const handleMatchesChange = (slotId: string, matches: ScheduleMatch[]) => {
    const updatedSlots = slots.map(slot => 
      slot.id === slotId ? { ...slot, matches } : slot
    );
    setSlots(updatedSlots);
    onScheduleChange(updatedSlots);
  };

  const detectConflicts = (timeSlots: TimeSlot[]): string[] => {
    const conflicts: string[] = [];
    const participantSchedule: { [key: string]: Date[] } = {};

    // Build participant schedule
    timeSlots.forEach(slot => {
      slot.matches.forEach(match => {
        [match.participantA, match.participantB].forEach(participant => {
          if (!participantSchedule[participant]) {
            participantSchedule[participant] = [];
          }
          participantSchedule[participant].push(match.startTime);
        });
      });
    });

    // Check for double bookings
    Object.entries(participantSchedule).forEach(([participant, times]) => {
      const sortedTimes = times.sort((a, b) => a.getTime() - b.getTime());
      for (let i = 1; i < sortedTimes.length; i++) {
        if (sortedTimes[i].getTime() === sortedTimes[i - 1].getTime()) {
          // Find matches with this conflict
          timeSlots.forEach(slot => {
            slot.matches.forEach(match => {
              if ((match.participantA === participant || match.participantB === participant) &&
                  match.startTime.getTime() === sortedTimes[i].getTime()) {
                conflicts.push(match.id);
              }
            });
          });
        }
      }
    });

    return conflicts;
  };

  const validateSchedule = () => {
    const newConflicts = detectConflicts(slots);
    setConflicts(newConflicts);
    
    // Update match statuses
    const updatedSlots = slots.map(slot => ({
      ...slot,
      matches: slot.matches.map(match => ({
        ...match,
        status: newConflicts.includes(match.id) ? 'conflict' as const : 'confirmed' as const
      }))
    }));
    
    setSlots(updatedSlots);
    onScheduleChange(updatedSlots);
  };

  const autoSchedule = () => {
    // Simple auto-scheduling algorithm
    const unscheduledMatches = slots.flatMap(slot => slot.matches);
    const emptySlots = slots.filter(slot => slot.matches.length === 0);
    
    let matchIndex = 0;
    const updatedSlots = slots.map(slot => {
      if (slot.matches.length === 0 && matchIndex < unscheduledMatches.length) {
        const match = unscheduledMatches[matchIndex];
        matchIndex++;
        return {
          ...slot,
          matches: [{
            ...match,
            startTime: slot.startTime,
            endTime: slot.endTime,
            venueId: slot.venueId,
            venueName: slot.venueName,
            courtId: slot.courtId,
            courtName: slot.courtName
          }]
        };
      }
      return slot;
    });
    
    setSlots(updatedSlots);
    onScheduleChange(updatedSlots);
  };

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button onClick={validateSchedule} variant="outline">
            <CheckCircle className="h-4 w-4 mr-2" />
            Validate Schedule
          </Button>
          <Button onClick={autoSchedule} className="codeninja-gradient">
            Auto Schedule
          </Button>
        </div>
        
        {conflicts.length > 0 && (
          <div className="flex items-center space-x-2 text-red-400">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">{conflicts.length} conflicts detected</span>
          </div>
        )}
      </div>

      {/* Schedule Grid */}
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {slots.map((timeSlot) => (
            <TimeSlotColumn
              key={timeSlot.id}
              timeSlot={timeSlot}
              onMatchesChange={handleMatchesChange}
            />
          ))}
        </div>

        <DragOverlay>
          {activeMatch ? (
            <div className="p-3 rounded-lg border border-blue-500 bg-blue-500/20 backdrop-blur-sm">
              <div className="flex items-center space-x-2 mb-2">
                <Trophy className="h-4 w-4 text-orange-400" />
                <span className="font-medium text-white text-sm">{activeMatch.gameName}</span>
              </div>
              <div className="text-sm text-slate-300">
                {activeMatch.participantA} vs {activeMatch.participantB}
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
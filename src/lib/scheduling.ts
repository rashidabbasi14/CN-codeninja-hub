// Contest types enum
export enum ContestType {
  SINGLE_ELIMINATION = 'SINGLE_ELIMINATION',
  ROUND_ROBIN = 'ROUND_ROBIN',
  SCORING = 'SCORING',
  SINGLE_ELIMINATION_1V1V1V1 = 'SINGLE_ELIMINATION_1V1V1V1'
}

export interface Participant {
  id: string;
  name: string;
  type: 'user' | 'team';
  level?: string;
  phone?: string | null;
  isEliminated?: boolean;
  wins?: number;
  losses?: number;
  score?: number;
}

export interface Match {
  id: string;
  participantA: Participant;
  participantB?: Participant; // Optional for scoring contests
  participantC?: Participant; // For 1v1v1v1 format
  participantD?: Participant; // For 1v1v1v1 format
  round?: number;
  position?: number;
  startTime?: Date;
  endTime?: Date;
  venueId?: string;
  courtId?: string;
  dependencies?: string[]; // Match IDs this match depends on
  winnerId?: string;
  winnerType?: string;
  isCompleted?: boolean;
}

// New interface for 1v1v1v1 match data storage
export interface FourParticipantMatchData {
  // For participantAId JSON storage (participants 1 and 2)
  participant1Id?: string;
  participant1Type?: string;
  participant2Id?: string;
  participant2Type?: string;
  // For participantBId JSON storage (participants 3 and 4)
  participant3Id?: string;
  participant3Type?: string;
  participant4Id?: string;
  participant4Type?: string;
}

export interface Tournament {
  id: string;
  name: string;
  contestType: ContestType;
  participants: Participant[];
  matches: Match[];
  settings: TournamentSettings;
}

export interface TournamentSettings {
  seedingMethod: 'Random' | 'By Registration Order' | 'Manual';
  groupSize?: number;
  rounds?: number;
  allowDraws: boolean;
  courtsRequiredPerMatch: number;
  minRestMinutes: number;
  backToBackAllowed: boolean;
}

export interface Venue {
  id: string;
  name: string;
  courts: Court[];
}

export interface Court {
  id: string;
  name: string;
  venueId: string;
}

export interface TimeSlot {
  start: Date;
  end: Date;
  venueId: string;
  courtId: string;
}

export class SchedulingEngine {
  /**
   * Generate matches based on contest type and participants
   */
  static generateMatches(
    participants: Participant[],
    contestType: ContestType,
    settings: TournamentSettings
  ): Match[] {
    switch (contestType) {
      case 'SINGLE_ELIMINATION':
        return this.generateSingleElimination(participants, settings);
      case 'SINGLE_ELIMINATION_1V1V1V1':
        return this.generateSingleElimination1v1v1v1(participants, settings);
      case 'ROUND_ROBIN':
        return this.generateRoundRobin(participants, settings);
      case 'SCORING':
        return this.generateScoring(participants, settings);
      default:
        throw new Error(`Unsupported contest type: ${contestType}`);
    }
  }

  /**
   * Check if a participant can be scheduled based on contest type and current state
   */
  static canParticipantBeScheduled(
    participant: Participant,
    contestType: ContestType,
    existingMatches: Match[] = []
  ): boolean {
    switch (contestType) {
      case 'SINGLE_ELIMINATION':
        return this.canScheduleInSingleElimination(participant, existingMatches);
      case 'SINGLE_ELIMINATION_1V1V1V1':
        return this.canScheduleInSingleElimination1v1v1v1(participant, existingMatches);
      case 'ROUND_ROBIN':
        return this.canScheduleInRoundRobin(participant, existingMatches);
      case 'SCORING':
        return this.canScheduleInScoring(participant, existingMatches);
      default:
        return true;
    }
  }

  /**
   * Get available participants for scheduling based on contest type
   */
  static getAvailableParticipants(
    allParticipants: Participant[],
    contestType: ContestType,
    existingMatches: Match[] = []
  ): Participant[] {
    return allParticipants.filter(participant =>
      this.canParticipantBeScheduled(participant, contestType, existingMatches)
    );
  }

  /**
   * Update participant status after match completion
   */
  static updateParticipantStatus(
    participants: Participant[],
    match: Match,
    contestType: ContestType
  ): Participant[] {
    if (!match.winnerId || !match.isCompleted) {
      return participants;
    }

    return participants.map(participant => {
      if (contestType === 'SINGLE_ELIMINATION') {
        // In single elimination, mark losers as eliminated
        if (participant.id === match.participantA.id || participant.id === match.participantB?.id) {
          if (participant.id !== match.winnerId) {
            return { ...participant, isEliminated: true, losses: (participant.losses || 0) + 1 };
          } else {
            return { ...participant, wins: (participant.wins || 0) + 1 };
          }
        }
      } else if (contestType === 'ROUND_ROBIN') {
        // In round robin, just track wins/losses
        if (participant.id === match.participantA.id || participant.id === match.participantB?.id) {
          if (participant.id === match.winnerId) {
            return { ...participant, wins: (participant.wins || 0) + 1 };
          } else {
            return { ...participant, losses: (participant.losses || 0) + 1 };
          }
        }
      } else if (contestType === 'SCORING') {
        // In scoring contests, update individual scores
        if (participant.id === match.participantA.id) {
          // Score would be updated separately through scoring system
          return participant;
        }
      }
      return participant;
    });
  }

  /**
   * Single Elimination specific logic
   */
  private static canScheduleInSingleElimination(
    participant: Participant,
    existingMatches: Match[]
  ): boolean {
    // Cannot schedule eliminated participants
    if (participant.isEliminated) {
      return false;
    }

    // Check if participant has any incomplete matches
    const hasIncompleteMatch = existingMatches.some(match =>
      (match.participantA.id === participant.id || match.participantB?.id === participant.id) &&
      !match.isCompleted
    );

    // Cannot schedule if already has an incomplete match
    return !hasIncompleteMatch;
  }

  /**
   * Round Robin specific logic
   */
  private static canScheduleInRoundRobin(
    participant: Participant,
    existingMatches: Match[]
  ): boolean {
    // In round robin, participants can be scheduled multiple times
    // Check if participant has any incomplete matches
    const hasIncompleteMatch = existingMatches.some(match =>
      (match.participantA.id === participant.id || match.participantB?.id === participant.id) &&
      !match.isCompleted
    );

    // Cannot schedule if already has an incomplete match (to avoid conflicts)
    return !hasIncompleteMatch;
  }

  /**
   * Scoring Contest specific logic
   */
  private static canScheduleInScoring(
    participant: Participant,
    existingMatches: Match[]
  ): boolean {
    // In scoring contests, participants can have multiple scoring sessions
    // Check if participant has any incomplete matches
    const hasIncompleteMatch = existingMatches.some(match =>
      match.participantA.id === participant.id && !match.isCompleted
    );

    // Cannot schedule if already has an incomplete scoring session
    return !hasIncompleteMatch;
  }

  /**
   * Single Elimination Tournament
   */
  private static generateSingleElimination(
    participants: Participant[],
    settings: TournamentSettings
  ): Match[] {
    if (participants.length < 2) {
      return [];
    }

    const seededParticipants = this.seedParticipants(participants, settings.seedingMethod);
    const matches: Match[] = [];
    
    // Calculate number of rounds needed
    const totalRounds = Math.ceil(Math.log2(seededParticipants.length));
    
    // Add BYEs if needed to make it a power of 2
    const nextPowerOf2 = Math.pow(2, totalRounds);
    const byes = nextPowerOf2 - seededParticipants.length;
    
    let currentRoundParticipants = [...seededParticipants];
    
    // Add BYE participants at strategic positions
    for (let i = 0; i < byes; i++) {
      currentRoundParticipants.push({
        id: `bye-${i}`,
        name: 'BYE',
        type: 'user'
      });
    }

    let matchId = 1;
    
    for (let round = 1; round <= totalRounds; round++) {
      const roundMatches: Match[] = [];
      const nextRoundParticipants: Participant[] = [];
      
      for (let i = 0; i < currentRoundParticipants.length; i += 2) {
        const participantA = currentRoundParticipants[i];
        const participantB = currentRoundParticipants[i + 1];
        
        // Skip if we don't have a pair
        if (!participantA || !participantB) {
          if (participantA) {
            nextRoundParticipants.push(participantA);
          }
          continue;
        }
        
        // Handle BYEs - participant with BYE automatically advances
        if (participantA.name === 'BYE') {
          nextRoundParticipants.push(participantB);
          continue;
        }
        if (participantB.name === 'BYE') {
          nextRoundParticipants.push(participantA);
          continue;
        }
        
        // Create actual match between real participants
        const match: Match = {
          id: `match-${matchId++}`,
          participantA,
          participantB,
          round,
          position: Math.floor(i / 2),
          dependencies: round > 1 ? [`match-${matchId - 2}`, `match-${matchId - 1}`] : undefined
        };
        
        roundMatches.push(match);
        
        // For next round, add a placeholder that will be filled by the winner
        nextRoundParticipants.push({
          id: `winner-of-match-${match.id}`,
          name: `Winner of ${participantA.name} vs ${participantB.name}`,
          type: 'user'
        });
      }
      
      matches.push(...roundMatches);
      
      // Prepare for next round
      currentRoundParticipants = nextRoundParticipants;
      
      // Stop if we have a winner (final round completed)
      if (currentRoundParticipants.length <= 1) {
        break;
      }
    }
    
    return matches;
  }

  /**
   * Round Robin Tournament
   */
  private static generateRoundRobin(
    participants: Participant[],
    settings: TournamentSettings
  ): Match[] {
    const matches: Match[] = [];
    let matchId = 1;
    
    // Generate all possible pairings
    for (let i = 0; i < participants.length; i++) {
      for (let j = i + 1; j < participants.length; j++) {
        matches.push({
          id: `match-${matchId++}`,
          participantA: participants[i],
          participantB: participants[j],
          round: 1
        });
      }
    }
    
    return matches;
  }

  /**
   * Scoring Contest - Individual scoring-based competition
   */
  private static generateScoring(
    participants: Participant[],
    settings: TournamentSettings
  ): Match[] {
    const matches: Match[] = [];
    let matchId = 1;
    
    // For scoring contests, create individual scoring sessions
    // Each participant gets their own scoring opportunity
    participants.forEach((participant, index) => {
      matches.push({
        id: `scoring-${matchId++}`,
        participantA: participant,
        participantB: undefined, // No opponent in scoring contests
        round: 1,
        position: index
      });
    });
    
    return matches;
  }

  /**
   * Single Elimination 1v1v1v1 - 4-participant single elimination
   */
  private static generateSingleElimination1v1v1v1(
    participants: Participant[],
    settings: TournamentSettings
  ): Match[] {
    const matches: Match[] = [];
    let matchId = 1;
    
    // For 1v1v1v1, we need groups of 4 participants
    // Each group creates one match with 4 participants
    for (let i = 0; i < participants.length; i += 4) {
      const group = participants.slice(i, i + 4);
      
      if (group.length === 4) {
        matches.push({
          id: `1v1v1v1-${matchId++}`,
          participantA: group[0],
          participantB: group[1],
          participantC: group[2],
          participantD: group[3],
          round: 1,
          position: Math.floor(i / 4)
        });
      }
    }
    
    return matches;
  }

  /**
   * Check if participant can be scheduled in 1v1v1v1 single elimination
   */
  private static canScheduleInSingleElimination1v1v1v1(
    participant: Participant,
    existingMatches: Match[]
  ): boolean {
    // Same rules as regular single elimination
    return this.canScheduleInSingleElimination(participant, existingMatches);
  }

  /**
   * Schedule matches to available time slots and courts
   */
  static scheduleMatches(
    matches: Match[],
    venues: Venue[],
    timeWindows: { start: Date; end: Date }[],
    avgGameTime: number,
    settings: TournamentSettings
  ): Match[] {
    const scheduledMatches = [...matches];
    const availableSlots = this.generateTimeSlots(venues, timeWindows, avgGameTime);
    
    // Sort matches by dependencies (matches with no dependencies first)
    const sortedMatches = this.topologicalSort(scheduledMatches);
    
    let slotIndex = 0;
    
    for (const match of sortedMatches) {
      if (slotIndex < availableSlots.length) {
        const slot = availableSlots[slotIndex];
        match.startTime = slot.start;
        match.endTime = slot.end;
        match.venueId = slot.venueId;
        match.courtId = slot.courtId;
        
        slotIndex++;
        
        // Check for participant conflicts and rest time
        if (!settings.backToBackAllowed) {
          // Skip slots if participants need rest
          slotIndex = this.skipSlotsForRest(
            slotIndex,
            availableSlots,
            match,
            settings.minRestMinutes
          );
        }
      }
    }
    
    return scheduledMatches;
  }

  /**
   * Helper methods
   */
  private static seedParticipants(
    participants: Participant[],
    method: string
  ): Participant[] {
    switch (method) {
      case 'Random':
        return this.shuffleArray([...participants]);
      case 'By Registration Order':
        return [...participants];
      case 'Manual':
        // Would require external seeding input
        return [...participants];
      default:
        return [...participants];
    }
  }

  private static shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  private static createGroups<T>(items: T[], groupSize: number): T[][] {
    const groups: T[][] = [];
    for (let i = 0; i < items.length; i += groupSize) {
      groups.push(items.slice(i, i + groupSize));
    }
    return groups;
  }

  private static generateTimeSlots(
    venues: Venue[],
    timeWindows: { start: Date; end: Date }[],
    avgGameTime: number
  ): TimeSlot[] {
    const slots: TimeSlot[] = [];
    
    for (const window of timeWindows) {
      for (const venue of venues) {
        for (const court of venue.courts) {
          let currentTime = new Date(window.start);
          
          while (currentTime < window.end) {
            const slotEnd = new Date(currentTime.getTime() + avgGameTime * 60000);
            
            if (slotEnd <= window.end) {
              slots.push({
                start: new Date(currentTime),
                end: slotEnd,
                venueId: venue.id,
                courtId: court.id
              });
            }
            
            currentTime = slotEnd;
          }
        }
      }
    }
    
    return slots;
  }

  private static topologicalSort(matches: Match[]): Match[] {
    // Simple sort by round for now
    return matches.sort((a, b) => (a.round || 0) - (b.round || 0));
  }

  private static skipSlotsForRest(
    currentIndex: number,
    slots: TimeSlot[],
    lastMatch: Match,
    minRestMinutes: number
  ): number {
    if (!lastMatch.endTime) return currentIndex;
    
    const restUntil = new Date(lastMatch.endTime.getTime() + minRestMinutes * 60000);
    
    while (currentIndex < slots.length && slots[currentIndex].start < restUntil) {
      currentIndex++;
    }
    
    return currentIndex;
  }
}
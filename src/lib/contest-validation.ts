// Contest type validation utilities for manual scheduling

export interface ParticipantStatus {
  id: string;
  name: string;
  type: 'user' | 'team';
  isEliminated: boolean;
  hasActiveMatch: boolean;
  wins: number;
  losses: number;
  totalMatches: number;
}

export interface MatchResult {
  id: string;
  participantAId: string;
  participantBId: string;
  participantCId?: string;
  participantDId?: string;
  winnerId?: string;
  isCompleted: boolean;
  contestType: string;
}

export class ContestValidator {
  /**
   * Check if a participant can be scheduled based on contest type and current status
   */
  static canParticipantBeScheduled(
    participantId: string,
    contestType: string,
    participantStatuses: ParticipantStatus[],
    existingMatches: MatchResult[]
  ): { canSchedule: boolean; reason?: string } {
    const participant = participantStatuses.find(p => p.id === participantId);
    if (!participant) {
      return { canSchedule: false, reason: 'Participant not found' };
    }

    switch (contestType) {
      case 'SINGLE_ELIMINATION':
        return this.validateSingleElimination(participant, existingMatches);
      
      case 'SINGLE_ELIMINATION_1V1V1V1':
        return this.validateSingleElimination1v1v1v1(participant, existingMatches);
      
      case 'ROUND_ROBIN':
        return this.validateRoundRobin(participant, existingMatches);
      
      case 'SCORING':
        return this.validateScoring(participant, existingMatches);
      
      default:
        return { canSchedule: true };
    }
  }

  /**
   * Single Elimination validation
   */
  private static validateSingleElimination(
    participant: ParticipantStatus,
    existingMatches: MatchResult[]
  ): { canSchedule: boolean; reason?: string } {
    // Cannot schedule eliminated participants
    if (participant.isEliminated) {
      return { 
        canSchedule: false, 
        reason: 'Participant has been eliminated and cannot be scheduled for new matches' 
      };
    }

    // Cannot schedule if participant has an active (incomplete) match
    if (participant.hasActiveMatch) {
      return { 
        canSchedule: false, 
        reason: 'Participant already has an incomplete match' 
      };
    }

    return { canSchedule: true };
  }

  /**
   * Round Robin validation
   */
  private static validateRoundRobin(
    participant: ParticipantStatus,
    existingMatches: MatchResult[]
  ): { canSchedule: boolean; reason?: string } {
    // In Round Robin, participants can have multiple concurrent matches
    // This is different from Single Elimination where only one match at a time is allowed
    return { canSchedule: true };
  }

  /**
   * Scoring Contest validation
   */
  private static validateScoring(
    participant: ParticipantStatus,
    existingMatches: MatchResult[]
  ): { canSchedule: boolean; reason?: string } {
    // Cannot schedule if participant has an active scoring session
    if (participant.hasActiveMatch) {
      return { 
        canSchedule: false, 
        reason: 'Participant already has an incomplete scoring session' 
      };
    }

    return { canSchedule: true };
  }

  /**
   * Single Elimination 1v1v1v1 validation
   */
  private static validateSingleElimination1v1v1v1(
    participant: ParticipantStatus,
    existingMatches: MatchResult[]
  ): { canSchedule: boolean; reason?: string } {
    // Same rules as regular single elimination
    return this.validateSingleElimination(participant, existingMatches);
  }

  /**
   * Check if two participants can be matched against each other
   */
  static canParticipantsBeMatched(
    participantAId: string,
    participantBId: string,
    contestType: string,
    participantStatuses: ParticipantStatus[],
    existingMatches: MatchResult[]
  ): { canMatch: boolean; reason?: string } {
    // Prevent a participant from being scheduled with itself
    if (participantAId === participantBId) {
      return {
        canMatch: false,
        reason: 'A participant cannot be scheduled to play against themselves'
      };
    }

    // Check if both participants can be scheduled individually
    const participantACheck = this.canParticipantBeScheduled(
      participantAId, contestType, participantStatuses, existingMatches
    );
    
    if (!participantACheck.canSchedule) {
      return { canMatch: false, reason: `Participant A: ${participantACheck.reason}` };
    }

    // For scoring contests, we don't need a second participant
    if (contestType === 'SCORING') {
      return { canMatch: true };
    }

    const participantBCheck = this.canParticipantBeScheduled(
      participantBId, contestType, participantStatuses, existingMatches
    );
    
    if (!participantBCheck.canSchedule) {
      return { canMatch: false, reason: `Participant B: ${participantBCheck.reason}` };
    }

    // Check if participants have already played against each other in Round Robin
    if (contestType === 'ROUND_ROBIN') {
      const havePlayedBefore = existingMatches.some(match =>
        (match.participantAId === participantAId && match.participantBId === participantBId) ||
        (match.participantAId === participantBId && match.participantBId === participantAId)
      );

      if (havePlayedBefore) {
        return {
          canMatch: false,
          reason: 'These participants have already played against each other in this round robin'
        };
      }
    }

    return { canMatch: true };
  }

  /**
   * Update participant status after a match is completed
   */
  static updateParticipantStatusAfterMatch(
    participantStatuses: ParticipantStatus[],
    matchResult: MatchResult
  ): ParticipantStatus[] {
    if (!matchResult.isCompleted || !matchResult.winnerId) {
      return participantStatuses;
    }

    return participantStatuses.map(participant => {
      // Update participant A
      if (participant.id === matchResult.participantAId) {
        const isWinner = participant.id === matchResult.winnerId;
        return {
          ...participant,
          wins: isWinner ? participant.wins + 1 : participant.wins,
          losses: !isWinner ? participant.losses + 1 : participant.losses,
          totalMatches: participant.totalMatches + 1,
          isEliminated: (matchResult.contestType === 'SINGLE_ELIMINATION' || matchResult.contestType === 'SINGLE_ELIMINATION_1V1V1V1') && !isWinner,
          hasActiveMatch: false
        };
      }

      // Update participant B (if exists)
      if (participant.id === matchResult.participantBId) {
        const isWinner = participant.id === matchResult.winnerId;
        return {
          ...participant,
          wins: isWinner ? participant.wins + 1 : participant.wins,
          losses: !isWinner ? participant.losses + 1 : participant.losses,
          totalMatches: participant.totalMatches + 1,
          isEliminated: (matchResult.contestType === 'SINGLE_ELIMINATION' || matchResult.contestType === 'SINGLE_ELIMINATION_1V1V1V1') && !isWinner,
          hasActiveMatch: false
        };
      }

      return participant;
    });
  }

  /**
   * Get contest type specific messages for UI
   */
  static getContestTypeInfo(contestType: string): {
    name: string;
    description: string;
    rules: string[];
  } {
    switch (contestType) {
      case 'SINGLE_ELIMINATION':
        return {
          name: 'Single Elimination',
          description: 'Players are eliminated after losing once',
          rules: [
            'Players who lose a match are eliminated',
            'Eliminated players cannot be scheduled for new matches',
            'Winners advance to the next round',
            'Only one player can have an active match at a time'
          ]
        };
      
      case 'ROUND_ROBIN':
        return {
          name: 'Round Robin',
          description: 'All players play against each other',
          rules: [
            'Each player plays against every other player once',
            'Players cannot play the same opponent twice',
            'Players can have multiple concurrent matches',
            'All matches must be completed'
          ]
        };
      
      case 'SCORING':
        return {
          name: 'Scoring Contest',
          description: 'Individual scoring-based competition',
          rules: [
            'Players compete individually for scores',
            'No direct opponents - players vs. the challenge',
            'Players can only have one active scoring session',
            'Multiple scoring rounds are allowed'
          ]
        };
      
      case 'SINGLE_ELIMINATION_1V1V1V1':
        return {
          name: 'Single Elimination 1v1v1v1',
          description: '4-player single elimination matches',
          rules: [
            'Four players compete in each match',
            'Only one winner advances from each match',
            'Eliminated players cannot be scheduled for new matches',
            'Players can only have one active match at a time'
          ]
        };
      
      default:
        return {
          name: 'Unknown Contest Type',
          description: 'Contest type not recognized',
          rules: []
        };
    }
  }
}
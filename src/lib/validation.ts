// Comprehensive validation utilities for the CodeNinja Hub application

import { z } from 'zod';

// Get allowed domain from environment
const getAllowedDomain = () => {
  return process.env.ALLOWED_EMAIL_DOMAIN || 'codeninjaconsulting.com';
};

// Email validation for CodeNinja domain
export const codeNinjaEmailSchema = z
  .string()
  .email('Invalid email format')
  .refine(
    (email) => {
      const allowedDomain = getAllowedDomain();
      return email.endsWith(`@${allowedDomain}`);
    },
    {
      message: `Email must be from @${getAllowedDomain()} domain`
    }
  );

// Password validation schema
export const passwordSchema = z.string()
  .min(6, 'Password must be at least 6 characters long')
  .max(128, 'Password must be less than 128 characters');

// User registration validation
export const userRegistrationSchema = z.object({
  email: codeNinjaEmailSchema,
  firstName: z.string().min(1, 'First name is required').max(50, 'First name too long'),
  lastName: z.string().min(1, 'Last name is required').max(50, 'Last name too long'),
  password: passwordSchema,
  confirmPassword: z.string(),
  gender: z.enum(['MALE', 'FEMALE']),
  age: z.number().min(16, 'Must be at least 16 years old').max(100, 'Invalid age').optional(),
  department: z.string().min(1, 'Department is required'),
  avatarUrl: z.string().url('Invalid avatar URL').optional(),
  privacyHideAge: z.boolean().default(false),
  privacyHideGender: z.boolean().default(false),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

// Login validation schema (without domain restriction)
export const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

// Password setup schema for existing users
export const passwordSetupSchema = z.object({
  password: passwordSchema,
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

// Category validation
export const categorySchema = z.object({
  name: z.string().min(1, 'Category name is required').max(100, 'Name too long'),
  gamesCountMode: z.enum(['Unlimited', 'Fixed']),
  startDate: z.date(),
  endDate: z.date(),
  dailyWindows: z.array(z.object({
    start: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid time format (HH:MM)'),
    end: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid time format (HH:MM)'),
  })),
  perPersonCap: z.number().min(1, 'Must allow at least 1 game per person').max(20, 'Too many games per person'),
  locationName: z.string().min(1, 'Location name is required').max(200, 'Location name too long'),
  locationMapsLink: z.string().url('Invalid maps URL').optional(),
}).refine(
  (data) => data.endDate >= data.startDate,
  'End date must be after start date'
);

// Game validation
export const gameSchema = z.object({
  name: z.string().min(1, 'Game name is required').max(100, 'Name too long'),
  categoryId: z.string().uuid('Invalid category ID'),
  weightage: z.number().min(1, 'Weightage must be at least 1').max(100, 'Weightage too high'),
  typeFormat: z.string().regex(/^\d+v\d+$/, 'Format must be like "1v1", "2v2", etc.'),
  avgGameTime: z.number().min(5, 'Game time must be at least 5 minutes').max(300, 'Game time too long'),
  levels: z.array(z.enum(['Beginner', 'Intermediate', 'Advanced'])).min(1, 'At least one level required'),
  contestType: z.enum([
    'Single Elimination',
    'Double Elimination',
    'Round Robin',
    'Round Robin (Home/Away)',
    'Group Stage → Knockout',
    'Swiss System',
    'Ladder',
    'Time-boxed League',
    'Friendly'
  ]),
  seedingMethod: z.enum(['Random', 'By Registration Order', 'Manual']),
  groupSize: z.number().min(2).max(8).optional(),
  rounds: z.number().min(1).max(20).optional(),
  allowDraws: z.boolean().default(false),
  courtsRequiredPerMatch: z.number().min(1).max(4).default(1),
  minRestMinutes: z.number().min(0).max(60).default(15),
  backToBackAllowed: z.boolean().default(false),
});

// Registration validation
export const registrationSchema = z.object({
  gameId: z.string().uuid('Invalid game ID'),
  level: z.enum(['Beginner', 'Intermediate', 'Advanced']),
  mode: z.enum(['individual', 'team']),
  teamName: z.string().min(1, 'Team name is required').max(50, 'Team name too long').optional(),
  teammates: z.array(codeNinjaEmailSchema).optional(),
  allowAutoAssign: z.boolean().default(false),
}).refine(
  (data) => {
    if (data.mode === 'team') {
      return data.teamName && data.teammates && data.teammates.length > 0;
    }
    return true;
  },
  'Team name and teammates are required for team registration'
);

// Post validation
export const postSchema = z.object({
  content: z.string().max(2000, 'Post content too long').optional(),
  mediaUrls: z.array(z.string().url('Invalid media URL')).max(4, 'Maximum 4 images allowed'),
}).refine(
  (data) => data.content?.trim() || data.mediaUrls.length > 0,
  'Post must have content or images'
);

// Comment validation
export const commentSchema = z.object({
  content: z.string().min(1, 'Comment cannot be empty').max(500, 'Comment too long'),
});

// News validation
export const newsSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  body: z.string().min(1, 'Body is required').max(5000, 'Body too long'),
  isPinned: z.boolean().default(false),
});


// Department validation
export const departmentSchema = z.object({
  name: z.string().min(1, 'Department name is required').max(100, 'Name too long'),
});

// Match result validation
export const matchResultSchema = z.object({
  matchId: z.string().uuid('Invalid match ID'),
  winnerId: z.string().uuid('Invalid winner ID'),
  scoreNotes: z.string().max(200, 'Score notes too long').optional(),
  isOvertime: z.boolean().default(false),
  isPenalty: z.boolean().default(false),
  isWalkover: z.boolean().default(false),
});

// Email template validation
export const emailTemplateSchema = z.object({
  name: z.string().min(1, 'Template name is required').max(100, 'Name too long'),
  scope: z.enum(['Global', 'Category', 'Game']),
  subject: z.string().min(1, 'Subject is required').max(200, 'Subject too long'),
  htmlContent: z.string().min(1, 'Content is required'),
  variables: z.array(z.string()).default([]),
});

// Validation helper functions
export function validateEmail(email: string): { valid: boolean; error?: string } {
  try {
    codeNinjaEmailSchema.parse(email);
    return { valid: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { valid: false, error: error.issues[0].message };
    }
    return { valid: false, error: 'Invalid email' };
  }
}

export function validateUserRegistration(data: any): { valid: boolean; errors?: string[] } {
  try {
    userRegistrationSchema.parse(data);
    return { valid: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { valid: false, errors: error.issues.map((e: any) => e.message) };
    }
    return { valid: false, errors: ['Validation failed'] };
  }
}

export function validateGameRegistration(data: any): { valid: boolean; errors?: string[] } {
  try {
    registrationSchema.parse(data);
    return { valid: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { valid: false, errors: error.issues.map((e: any) => e.message) };
    }
    return { valid: false, errors: ['Validation failed'] };
  }
}

// Business logic validation
export function validateScheduleConflict(
  newSlot: { start: Date; end: Date; participantIds: string[] },
  existingSlots: Array<{ start: Date; end: Date; participantIds: string[] }>
): { hasConflict: boolean; conflictingSlots: number[] } {
  const conflictingSlots: number[] = [];

  existingSlots.forEach((slot, index) => {
    // Check time overlap
    const timeOverlap = newSlot.start < slot.end && newSlot.end > slot.start;
    
    if (timeOverlap) {
      // Check participant overlap
      const participantOverlap = newSlot.participantIds.some(id => 
        slot.participantIds.includes(id)
      );
      
      if (participantOverlap) {
        conflictingSlots.push(index);
      }
    }
  });

  return {
    hasConflict: conflictingSlots.length > 0,
    conflictingSlots
  };
}

export function validateCategoryParticipationLimit(
  userId: string,
  categoryId: string,
  currentRegistrations: Array<{ userId: string; game: { categoryId: string } }>,
  categoryLimit: number
): { canRegister: boolean; currentCount: number } {
  const currentCount = currentRegistrations.filter(reg => 
    reg.userId === userId && reg.game.categoryId === categoryId
  ).length;

  return {
    canRegister: currentCount < categoryLimit,
    currentCount
  };
}

// File validation
export function validateImageFile(file: File): { valid: boolean; error?: string } {
  const maxSize = 5 * 1024 * 1024; // 5MB
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  
  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: 'Only JPEG, PNG, WebP, and GIF images are allowed'
    };
  }
  
  if (file.size > maxSize) {
    return {
      valid: false,
      error: 'File size must be less than 5MB'
    };
  }
  
  return { valid: true };
}

// Tournament bracket validation
export function validateTournamentBracket(
  participants: number,
  contestType: string
): { valid: boolean; error?: string; recommendedSize?: number } {
  switch (contestType) {
    case 'Single Elimination':
      // Must be power of 2 for clean brackets
      const isPowerOfTwo = (participants & (participants - 1)) === 0;
      if (!isPowerOfTwo) {
        const nextPowerOfTwo = Math.pow(2, Math.ceil(Math.log2(participants)));
        return {
          valid: false,
          error: 'Single elimination requires power of 2 participants',
          recommendedSize: nextPowerOfTwo
        };
      }
      break;
      
    case 'Round Robin':
    case 'Round Robin (League)':
      if (participants < 3) {
        return {
          valid: false,
          error: 'Round Robin requires at least 3 participants'
        };
      }
      if (participants > 16) {
        return {
          valid: false,
          error: 'Round Robin with more than 16 participants is impractical'
        };
      }
      break;
      
    case 'Scoring':
    case 'Scoring Contest':
      if (participants < 2) {
        return {
          valid: false,
          error: 'Scoring contest requires at least 2 participants'
        };
      }
      break;
  }
  
  return { valid: true };
}

// Comprehensive cross-game conflict detection
export interface ConflictDetectionOptions {
  participantId: string;
  participantType: 'USER' | 'TEAM';
  gameId: string;
  startTime: Date;
  endTime: Date;
  teamMembers?: Array<{ user: { id: string; firstName: string; lastName: string } }>;
}

export interface ConflictResult {
  hasConflict: boolean;
  conflictMessage?: string;
  conflictingGame?: string;
  conflictingMember?: string;
}

export async function validateCrossGameConflicts(
  options: ConflictDetectionOptions,
  prisma: any
): Promise<ConflictResult> {
  const { participantId, participantType, gameId, startTime, endTime, teamMembers } = options;
  
  console.log('🔍 validateCrossGameConflicts called with:', {
    participantId,
    participantType,
    gameId,
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString(),
    teamMembersCount: teamMembers?.length || 0
  });
  
  let teamMemberIds: string[] = [];
  
  // For team-based games, get all team member IDs
  if (participantType === 'TEAM' && teamMembers) {
    teamMemberIds = teamMembers.map(member => member.user.id);
  } else {
    teamMemberIds = [participantId]; // For individual games, check the user
  }

  // First, find all teams that any of our team members belong to
  const memberTeams = await prisma.team.findMany({
    where: {
      members: {
        some: {
          userId: { in: teamMemberIds }
        }
      },
      NOT: {
        id: participantType === 'TEAM' ? participantId : undefined // Exclude current team
      }
    },
    select: {
      id: true,
      name: true,
      members: {
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true
            }
          }
        }
      }
    }
  });

  // Get all participant IDs to check (individual users + team IDs)
  const allParticipantIds = [
    ...teamMemberIds, // Individual user IDs
    ...memberTeams.map((team: any) => team.id) // Team IDs where our members participate
  ];

  // Add the current participant ID (for both USER and TEAM types)
  // For USER type: participantId is the user ID (already in teamMemberIds, but ensure it's included)
  // For TEAM type: participantId is the team ID (needs to be added)
  if (participantType === 'TEAM') {
    allParticipantIds.push(participantId);
  } else {
    // For USER type, ensure the participantId is included (it should already be in teamMemberIds)
    if (!allParticipantIds.includes(participantId)) {
      allParticipantIds.push(participantId);
    }
  }

  console.log('🔍 Final participant IDs to check for conflicts:', {
    teamMemberIds,
    memberTeamIds: memberTeams.map((team: any) => team.id),
    allParticipantIds,
    participantType,
    originalParticipantId: participantId
  });

  // For 1v1v1v1 games, we need to get ALL matches and then parse JSON to find conflicts
  // because we can't do JSON parsing in the database query efficiently
  const crossGameConflicts = await prisma.match.findMany({
    where: {
      NOT: {
        gameId: gameId // Exclude current game
      }
    },
    include: {
      slot: true,
      game: {
        select: { name: true, contestType: true }
      }
    }
  });

  console.log('🔍 Found', crossGameConflicts.length, 'potential conflicting matches across all games');

  // Check for time overlaps with other games
  for (const conflictMatch of crossGameConflicts) {
    if (conflictMatch.slot) {
      const existingStart = new Date(conflictMatch.slot.startTime);
      const existingEnd = new Date(conflictMatch.slot.endTime);
      
      // Check if time windows overlap
      const hasOverlap = (startTime < existingEnd && endTime > existingStart);
      
      if (hasOverlap) {
        console.log('🔍 Time overlap detected, checking participants in match:', {
          conflictMatchId: conflictMatch.id,
          conflictGameName: conflictMatch.game.name,
          conflictGameType: conflictMatch.game.contestType,
          participantAId: conflictMatch.participantAId,
          participantBId: conflictMatch.participantBId,
          participantAType: conflictMatch.participantAType,
          participantBType: conflictMatch.participantBType
        });

        // Extract all participant IDs from the conflicting match (including 1v1v1v1 JSON data)
        const conflictingParticipantIds: string[] = [];
        
        // Handle regular participants
        if (conflictMatch.participantAId && conflictMatch.participantAType !== 'FOUR_PARTICIPANT_DATA') {
          conflictingParticipantIds.push(conflictMatch.participantAId);
        }
        if (conflictMatch.participantBId && conflictMatch.participantBType !== 'FOUR_PARTICIPANT_DATA') {
          conflictingParticipantIds.push(conflictMatch.participantBId);
        }
        
        // Handle 1v1v1v1 participants stored in JSON
        if (conflictMatch.participantAType === 'FOUR_PARTICIPANT_DATA' && conflictMatch.participantAId) {
          try {
            const participantAData = JSON.parse(conflictMatch.participantAId);
            if (participantAData.participant1Id) conflictingParticipantIds.push(participantAData.participant1Id);
            if (participantAData.participant2Id) conflictingParticipantIds.push(participantAData.participant2Id);
            console.log('🔍 Parsed participantA JSON:', participantAData);
          } catch (e) {
            console.warn('Failed to parse participantA JSON data:', conflictMatch.participantAId);
          }
        }
        
        if (conflictMatch.participantBType === 'FOUR_PARTICIPANT_DATA' && conflictMatch.participantBId) {
          try {
            const participantBData = JSON.parse(conflictMatch.participantBId);
            if (participantBData.participant3Id) conflictingParticipantIds.push(participantBData.participant3Id);
            if (participantBData.participant4Id) conflictingParticipantIds.push(participantBData.participant4Id);
            console.log('🔍 Parsed participantB JSON:', participantBData);
          } catch (e) {
            console.warn('Failed to parse participantB JSON data:', conflictMatch.participantBId);
          }
        }

        console.log('🔍 Extracted conflicting participant IDs:', conflictingParticipantIds);
        console.log('🔍 Checking against our participant IDs:', allParticipantIds);

        // Check if any of our participants are in the conflicting match
        const hasParticipantConflict = allParticipantIds.some(id => conflictingParticipantIds.includes(id));
        
        console.log('🔍 Has participant conflict:', hasParticipantConflict);
        
        if (hasParticipantConflict) {
          const formatTime = (date: Date) => date.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
          });

          // Find which team member has the conflict and get participant name
          let conflictingMember = '';
          const conflictingUserId = allParticipantIds.find(id => conflictingParticipantIds.includes(id));
          
          if (participantType === 'TEAM' && teamMembers) {
            const member = teamMembers.find(m => m.user.id === conflictingUserId);
            if (member) {
              conflictingMember = ` Team member "${member.user.firstName} ${member.user.lastName}" is`;
            } else {
              // Check if it's a team conflict (member is part of another team)
              const conflictingTeam = memberTeams.find((team: any) =>
                conflictingParticipantIds.includes(team.id)
              );
              if (conflictingTeam) {
                const conflictingTeamMember = conflictingTeam.members.find((m: any) =>
                  teamMemberIds.includes(m.user.id)
                );
                if (conflictingTeamMember) {
                  conflictingMember = ` Team member "${conflictingTeamMember.user.firstName} ${conflictingTeamMember.user.lastName}" is already committed to team "${conflictingTeam.name}" and`;
                }
              }
            }
          } else {
            // For individual participants, we need to get the participant's name
            // Since we have the conflicting user ID, we need to fetch their details
            if (conflictingUserId) {
              try {
                const conflictingUser = await prisma.user.findUnique({
                  where: { id: conflictingUserId },
                  select: { firstName: true, lastName: true }
                });
                
                if (conflictingUser) {
                  conflictingMember = ` Participant "${conflictingUser.firstName} ${conflictingUser.lastName}" is`;
                } else {
                  conflictingMember = ' The participant is';
                }
              } catch (error) {
                console.warn('Failed to fetch conflicting user details:', error);
                conflictingMember = ' The participant is';
              }
            } else {
              conflictingMember = ' The participant is';
            }
          }
          
          console.log('🚨 CONFLICT DETECTED! Returning conflict result');
          
          return {
            hasConflict: true,
            conflictMessage: `Time conflict detected!${conflictingMember} already scheduled for "${conflictMatch.game.name}" from ${formatTime(existingStart)} to ${formatTime(existingEnd)} on ${existingStart.toLocaleDateString()}. Please choose a different time slot.`,
            conflictingGame: conflictMatch.game.name,
            conflictingMember: conflictingMember.trim()
          };
        }
      }
    }
  }

  return { hasConflict: false };
}

export default {
  schemas: {
    userRegistration: userRegistrationSchema,
    category: categorySchema,
    game: gameSchema,
    registration: registrationSchema,
    post: postSchema,
    comment: commentSchema,
    news: newsSchema,
    department: departmentSchema,
    matchResult: matchResultSchema,
    emailTemplate: emailTemplateSchema,
  },
  validators: {
    validateEmail,
    validateUserRegistration,
    validateGameRegistration,
    validateScheduleConflict,
    validateCategoryParticipationLimit,
    validateImageFile,
    validateTournamentBracket,
    validateCrossGameConflicts,
  }
};
import { prisma } from '../prisma';
import { emailService } from './email-service';
import { generateMatchScheduledEmail, MatchScheduledProps } from '../../app/email-templates/match-scheduled-email';
import { EmailConfig } from '../config';

interface ParticipantInfo {
  id: string;
  name: string;
  type: 'USER' | 'TEAM';
  emails: string[];
}

interface MatchNotificationData {
  gameId: string;
  gameName: string;
  categoryName: string;
  contestType: string;
  matchDateTime: Date; // Changed from matchTime/matchDate strings to UTC Date object
  venueName?: string;
  courtName?: string;
  timelineName?: string;
  participantAId: string;
  participantAType: 'USER' | 'TEAM' | 'PLACEHOLDER' | 'FOUR_PARTICIPANT_DATA';
  participantBId: string;
  participantBType: 'USER' | 'TEAM' | 'PLACEHOLDER' | 'FOUR_PARTICIPANT_DATA';
  participantCId?: string;
  participantCType?: 'USER' | 'TEAM' | 'PLACEHOLDER';
  participantDId?: string;
  participantDType?: 'USER' | 'TEAM' | 'PLACEHOLDER';
  eventId?: string;
}

/**
 * Get participant information including email addresses
 */
async function getParticipantInfo(participantId: string, participantType: 'USER' | 'TEAM'): Promise<ParticipantInfo | null> {
  try {
    if (participantType === 'USER') {
      const user = await prisma.user.findUnique({
        where: { id: participantId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true
        }
      });

      if (!user) return null;

      return {
        id: user.id,
        name: `${user.firstName} ${user.lastName}`,
        type: 'USER',
        emails: [user.email]
      };
    } else if (participantType === 'TEAM') {
      const team = await prisma.team.findUnique({
        where: { id: participantId },
        include: {
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true
                }
              }
            }
          }
        }
      });

      if (!team) return null;

      const emails = team.members.map(member => member.user.email);

      return {
        id: team.id,
        name: team.name,
        type: 'TEAM',
        emails: emails
      };
    }

    return null;
  } catch (error) {
    console.error('Error getting participant info:', error);
    return null;
  }
}

/**
 * Send match scheduled notification emails to participants
 * Only sends when both participants are real (not TBD or placeholders)
 */
export async function sendMatchScheduledNotification(data: MatchNotificationData): Promise<void> {
  try {
    // Check if match scheduled emails are enabled
    const isEnabled = await EmailConfig.isMatchScheduledEnabled();
    if (!isEnabled) {
      console.log('Match scheduled email notifications are disabled in config');
      return;
    }

    // Collect all real participants for notification
    const participantsToNotify: ParticipantInfo[] = [];
    
    // Handle 1v1v1v1 format with JSON data
    if (data.contestType === 'SINGLE_ELIMINATION_1V1V1V1') {
      // For 1v1v1v1 format, we need ALL 4 participants to be real before sending emails
      let allParticipantsFound = true;
      const expectedParticipants = 4;
      
      // Parse participants from JSON data
      if (data.participantAType === 'FOUR_PARTICIPANT_DATA' && data.participantAId !== 'TBD') {
        try {
          const participantAData = JSON.parse(data.participantAId);
          if (participantAData.participant1Id && participantAData.participant1Type !== 'PLACEHOLDER') {
            const participant1 = await getParticipantInfo(participantAData.participant1Id, participantAData.participant1Type);
            if (participant1) participantsToNotify.push(participant1);
          }
          if (participantAData.participant2Id && participantAData.participant2Type !== 'PLACEHOLDER') {
            const participant2 = await getParticipantInfo(participantAData.participant2Id, participantAData.participant2Type);
            if (participant2) participantsToNotify.push(participant2);
          }
        } catch (error) {
          console.error('Error parsing participantAId JSON:', error);
          allParticipantsFound = false;
        }
      }
      
      if (data.participantBType === 'FOUR_PARTICIPANT_DATA' && data.participantBId !== 'TBD') {
        try {
          const participantBData = JSON.parse(data.participantBId);
          if (participantBData.participant3Id && participantBData.participant3Type !== 'PLACEHOLDER') {
            const participant3 = await getParticipantInfo(participantBData.participant3Id, participantBData.participant3Type);
            if (participant3) participantsToNotify.push(participant3);
          }
          if (participantBData.participant4Id && participantBData.participant4Type !== 'PLACEHOLDER') {
            const participant4 = await getParticipantInfo(participantBData.participant4Id, participantBData.participant4Type);
            if (participant4) participantsToNotify.push(participant4);
          }
        } catch (error) {
          console.error('Error parsing participantBId JSON:', error);
          allParticipantsFound = false;
        }
      }
      
      // Also check direct participant C and D if provided
      if (data.participantCId && data.participantCType && data.participantCType !== 'PLACEHOLDER') {
        const participantC = await getParticipantInfo(data.participantCId, data.participantCType);
        if (participantC) participantsToNotify.push(participantC);
      }
      if (data.participantDId && data.participantDType && data.participantDType !== 'PLACEHOLDER') {
        const participantD = await getParticipantInfo(data.participantDId, data.participantDType);
        if (participantD) participantsToNotify.push(participantD);
      }
      
      // For 1v1v1v1 format, only send emails if ALL 4 participants are found
      if (participantsToNotify.length !== expectedParticipants || !allParticipantsFound) {
        console.log(`Skipping email notification for 1v1v1v1 match - only ${participantsToNotify.length} of ${expectedParticipants} participants are real`);
        return;
      }
    } else {
      // Regular 2-participant format - need both participants to be real
      if (data.participantAId !== 'TBD' && data.participantAType !== 'PLACEHOLDER' && data.participantAType !== 'FOUR_PARTICIPANT_DATA') {
        const participantA = await getParticipantInfo(data.participantAId, data.participantAType);
        if (participantA) participantsToNotify.push(participantA);
      }
      if (data.participantBId !== 'TBD' && data.participantBType !== 'PLACEHOLDER' && data.participantBType !== 'FOUR_PARTICIPANT_DATA') {
        const participantB = await getParticipantInfo(data.participantBId, data.participantBType);
        if (participantB) participantsToNotify.push(participantB);
      }
      
      // For regular format, need both participants to be real
      if (participantsToNotify.length !== 2) {
        console.log(`Skipping email notification for regular match - only ${participantsToNotify.length} of 2 participants are real`);
        return;
      }
    }


    console.log(`Sending match scheduled notifications for ${data.gameName} to ${participantsToNotify.length} participants:`, {
      participants: participantsToNotify.map(p => p.name),
      matchDateTime: data.matchDateTime.toISOString()
    });

    // Send email to all participants
    for (let i = 0; i < participantsToNotify.length; i++) {
      const participant = participantsToNotify[i];
      // For each participant, create a list of opponents (all other participants)
      const opponents = participantsToNotify.filter((_, index) => index !== i);
      
      // For multi-participant matches, we'll use the first opponent for the email template
      // but mention it's a multi-participant match
      const primaryOpponent = opponents.length > 0 ? opponents[0] : participant; // fallback to self if no opponents
      
      await sendEmailToParticipant(data, participant, primaryOpponent, opponents);
    }

    console.log(`Successfully sent match scheduled notifications to ${participantsToNotify.length} participants`);

  } catch (error) {
    console.error('Error sending match scheduled notification:', error);
  }
}

/**
 * Send email to a specific participant
 */
async function sendEmailToParticipant(
  matchData: MatchNotificationData,
  participant: ParticipantInfo,
  opponent: ParticipantInfo,
  allOpponents?: ParticipantInfo[]
): Promise<void> {
  try {
    // Send email to all email addresses for this participant
    for (const email of participant.emails) {
      // Get user's timezone preference - for now use default timezone from environment
      // TODO: Add timezone field to User model for per-user timezone preferences
      const defaultTimezone = process.env.DEFAULT_USER_TIMEZONE || 'UTC';
      let userTimezone = defaultTimezone;
      
      // For teams, we'll use the default timezone as well
      // In the future, this could be enhanced to use team-specific or member-specific timezones
      
      // Format time and date in user's timezone
      const matchTime = matchData.matchDateTime.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
        timeZone: userTimezone
      });
      
      const matchDate = matchData.matchDateTime.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: userTimezone
      });

      // Get first name for personalization
      let firstName = 'Player';
      if (participant.type === 'USER') {
        const nameParts = participant.name.split(' ');
        firstName = nameParts[0] || 'Player';
      } else {
        // For teams, try to get the first name from the email or use team name
        firstName = participant.name;
      }

      const emailProps: MatchScheduledProps = {
        firstName,
        gameName: matchData.gameName,
        categoryName: matchData.categoryName,
        matchTime: matchTime, // Now formatted in user's timezone
        matchDate: matchDate, // Now formatted in user's timezone
        venueName: matchData.venueName,
        courtName: matchData.courtName,
        // For backward compatibility with 2-participant matches
        opponentName: opponent.name,
        opponentType: opponent.type === 'TEAM' ? 'team' : 'individual',
        // For multi-participant matches, pass all opponents
        opponents: allOpponents && allOpponents.length > 1 ?
          allOpponents.map(opp => ({
            name: opp.name,
            type: opp.type === 'TEAM' ? 'team' as const : 'individual' as const
          })) : undefined,
        participantName: participant.name,
        participantType: participant.type === 'TEAM' ? 'team' : 'individual',
        timelineName: matchData.timelineName,
        contestType: matchData.contestType,
        eventId: matchData.eventId,
        baseUrl: process.env.NEXTAUTH_URL || 'http://localhost:3000'
      };

      const emailHtml = generateMatchScheduledEmail(emailProps);
      const subject = `🎯 Match Scheduled: ${matchData.gameName} - ${matchDate} at ${matchTime}`;

      const success = await emailService.sendEmail(
        email,
        subject,
        emailHtml,
        {},
        'system'
      );

      if (success) {
        console.log(`✅ Match scheduled email sent to: ${email} (${participant.name}) - Time: ${matchTime} ${userTimezone}`);
      } else {
        console.error(`❌ Failed to send match scheduled email to: ${email} (${participant.name})`);
      }
    }
  } catch (error) {
    console.error(`Error sending email to participant ${participant.name}:`, error);
  }
}
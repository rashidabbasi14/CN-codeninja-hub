import { prisma } from '../prisma';
import { emailService } from './email-service';
import { generateGameReminderEmail, GameReminderEmailProps } from '../../app/email-templates';
import { EmailConfig } from '../config';

export class GameReminderService {

  /**
   * Helper function to extract participants from game registrations
   */
  private extractParticipants(registrations: any[]): Array<{
    email: string;
    firstName: string;
    lastName: string;
  }> {
    const participants = new Map<string, { email: string; firstName: string; lastName: string }>();

    registrations.forEach((registration) => {
      if (registration.team) {
        // Team registration
        registration.team.members.forEach((member: any) => {
          participants.set(member.user.email, {
            email: member.user.email,
            firstName: member.user.firstName,
            lastName: member.user.lastName,
          });
        });
      } else {
        // Individual registration
        participants.set(registration.user.email, {
          email: registration.user.email,
          firstName: registration.user.firstName,
          lastName: registration.user.lastName,
        });
      }
    });

    return Array.from(participants.values());
  }

  /**
   * Sends game reminder emails for specific slots
   * This is the worker function that handles actual email sending
   */
  async sendSlotReminders(slotData: {
    gameId: string;
    gameName: string;
    categoryName: string;
    slotId: string;
    startTime: Date;
    participants: Array<{
      email: string;
      firstName: string;
      lastName: string;
    }>;
  }, minutesBefore: number = 10): Promise<void> {
    try {
      if (slotData.participants.length === 0) {
        console.log(`No participants found for slot ${slotData.slotId} in game ${slotData.gameName}`);
        return;
      }

      // Get default timezone for formatting (will be overridden per user below)
      const defaultTimezone = process.env.DEFAULT_USER_TIMEZONE || 'UTC';
      
      // Format slot time for display in default timezone (for logging)
      const formattedTime = slotData.startTime.toLocaleString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: defaultTimezone,
        timeZoneName: 'short',
      });

      // Send reminder to each participant with their timezone
      const reminderPromises = slotData.participants.map(async (participant) => {
        // Format time in user's timezone (using default for now, can be enhanced later)
        const userTimezone = defaultTimezone; // TODO: Get from user preferences
        
        const userFormattedTime = slotData.startTime.toLocaleString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          timeZone: userTimezone,
          timeZoneName: 'short',
        });
        
        const reminderProps: GameReminderEmailProps = {
          firstName: participant.firstName,
          lastName: participant.lastName,
          email: participant.email,
          gameName: slotData.gameName,
          eventName: slotData.categoryName,
          eventDate: slotData.startTime.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            timeZone: userTimezone,
          }),
          eventTime: slotData.startTime.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            timeZone: userTimezone,
            timeZoneName: 'short',
          }),
          loginUrl: process.env.NEXTAUTH_URL || process.env.VERCEL_URL || 'http://localhost:3000',
          eventId: slotData.gameId,
        };

        const htmlContent = generateGameReminderEmail(reminderProps);

        return emailService.sendEmail(
          participant.email,
          `🏆 Reminder: ${slotData.gameName} starts in ${minutesBefore} minutes`,
          htmlContent,
          {},
          'system'
        );
      });

      await Promise.all(reminderPromises);
      
      console.log(`Sent ${slotData.participants.length} reminder emails for game "${slotData.gameName}" slot at ${formattedTime}`);
      console.log(`Participants: ${slotData.participants.map(p => `${p.firstName} ${p.lastName}`).join(', ')}`);
      
    } catch (error) {
      console.error('Failed to send slot reminders:', error);
      throw error;
    }
  }

  /**
   * Schedules game reminders by finding games that need reminders and orchestrating the sending
   * This is the cron job function that runs every minute
   */
  async scheduleGameReminders(minutesBefore: number = 10): Promise<void> {
    try {
      // Check if game reminders are enabled
      const gameRemindersEnabled = await EmailConfig.isGameRemindersEnabled();
      if (!gameRemindersEnabled) {
        console.log('Game reminders are disabled in configuration. Skipping reminder processing.');
        return;
      }

      const nowUTC = new Date();
      const targetTime = new Date(nowUTC.getTime() + minutesBefore * 60 * 1000);
      const windowStart = new Date(targetTime.getTime() - 30 * 1000); // 30 seconds before
      const windowEnd = new Date(targetTime.getTime() + 30 * 1000); // 30 seconds after
      
      // Get all games with slots starting in the target window, including participant data
      const upcomingGames = await prisma.game.findMany({
        where: {
          slots: {
            some: {
              startTime: {
                gte: windowStart,
                lte: windowEnd,
              },
            },
          },
        },
        include: {
          category: true,
          slots: {
            where: {
              startTime: {
                gte: windowStart,
                lte: windowEnd,
              },
            },
            select: {
              id: true,
              startTime: true,
              timelineId: true,
            },
          },
          registrations: {
            include: {
              user: true,
              team: {
                include: {
                  members: {
                    include: {
                      user: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (upcomingGames.length === 0) {
        console.log(`No games found starting in ${minutesBefore} minutes (UTC time: ${nowUTC.toISOString()})`);
        return;
      }

      // Process each game and its slots
      const reminderType = `${minutesBefore}_minute`;
      const slotsToProcess = [];
      
      for (const game of upcomingGames) {
        // Extract participants once per game
        const participants = this.extractParticipants(game.registrations);
        
        for (const slot of game.slots) {
          // Check if reminder already sent for this specific slot
          const existingReminder = await prisma.gameReminder.findFirst({
            where: {
              gameId: game.id,
              slotId: slot.id,
              reminderType: reminderType,
            },
          });

          if (!existingReminder) {
            slotsToProcess.push({
              gameId: game.id,
              gameName: game.name,
              categoryName: game.category.name,
              slotId: slot.id,
              startTime: slot.startTime,
              timelineId: slot.timelineId,
              participants: participants,
            });
          } else {
            console.log(`Reminder already sent for game ${game.name} slot ${slot.id}`);
          }
        }
      }

      if (slotsToProcess.length === 0) {
        console.log(`All reminders already sent for games starting in ${minutesBefore} minutes`);
        return;
      }

      // Send reminders for each slot that needs it
      const reminderPromises = slotsToProcess.map(async (slotInfo) => {
        try {
          await this.sendSlotReminders({
            gameId: slotInfo.gameId,
            gameName: slotInfo.gameName,
            categoryName: slotInfo.categoryName,
            slotId: slotInfo.slotId,
            startTime: slotInfo.startTime,
            participants: slotInfo.participants,
          }, minutesBefore);
          
          // Record that we sent this reminder for this specific slot
          await prisma.gameReminder.create({
            data: {
              gameId: slotInfo.gameId,
              slotId: slotInfo.slotId,
              reminderType: reminderType,
            },
          });
          
          return { gameId: slotInfo.gameId, gameName: slotInfo.gameName, slotId: slotInfo.slotId, success: true };
        } catch (error) {
          console.error(`Failed to send reminder for game ${slotInfo.gameName} slot ${slotInfo.slotId}:`, error);
          return { gameId: slotInfo.gameId, gameName: slotInfo.gameName, slotId: slotInfo.slotId, success: false, error };
        }
      });

      const results = await Promise.allSettled(reminderPromises);
      const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
      const failed = results.length - successful;

      console.log(`Game reminder summary: ${successful} successful, ${failed} failed out of ${slotsToProcess.length} game slots`);
      
    } catch (error) {
      console.error('Failed to schedule game reminders:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const gameReminderService = new GameReminderService();

// Export the standalone function for backward compatibility with cron jobs
export async function scheduleGameReminders(minutesBefore: number = 10) {
  return gameReminderService.scheduleGameReminders(minutesBefore);
}
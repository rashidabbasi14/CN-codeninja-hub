import * as cron from 'node-cron';
import { scheduleGameReminders } from './email/game-reminder';

/**
 * Cron Job Service for CodeNinja Hub
 * Handles automated scheduling of game reminders and other periodic tasks
 */
class CronService {
  private jobs: Map<string, cron.ScheduledTask> = new Map();
  private jobStatus: Map<string, boolean> = new Map();
  private isInitialized = false;

  /**
   * Initialize all cron jobs
   */
  initialize() {
    if (this.isInitialized) {
      console.log('Cron service already initialized');
      return;
    }

    try {
      // Game reminder job - runs every minute to check for games starting in 10 minutes
      const gameReminderJob = cron.schedule('* * * * *', async () => {
        try {
          await scheduleGameReminders(10); // 10 minutes before game starts
        } catch (error) {
          console.error('Game reminder cron job failed:', error);
        }
      }, {
        timezone: 'UTC'
      });

      this.jobs.set('gameReminders', gameReminderJob);

      // Optional: Additional reminder at 30 minutes before
      const earlyReminderJob = cron.schedule('*/5 * * * *', async () => {
        try {
          await scheduleGameReminders(30); // 30 minutes before game starts
        } catch (error) {
          console.error('Early game reminder cron job failed:', error);
        }
      }, {
        timezone: 'UTC'
      });

      this.jobs.set('earlyGameReminders', earlyReminderJob);

      // Cache cleanup job - runs every hour
      const cacheCleanupJob = cron.schedule('0 * * * *', () => {
        try {
          // Cache cleanup is already handled in cache.ts with setInterval
          // This is just a backup/additional cleanup if needed
        } catch (error) {
          console.error('Cache cleanup cron job failed:', error);
        }
      }, {
        timezone: 'UTC'
      });

      this.jobs.set('cacheCleanup', cacheCleanupJob);

      // Initialize in-memory status tracking
      this.jobs.forEach((job, name) => {
        this.jobStatus.set(name, false);
      });

      this.isInitialized = true;
      console.log('Cron service initialized with', this.jobs.size, 'jobs');
    } catch (error) {
      console.error('Failed to initialize cron service:', error);
      throw error;
    }
  }

  /**
   * Start a specific cron job
   */
  startJob(jobName: string): boolean {
    const job = this.jobs.get(jobName);
    if (job) {
      job.start();
      this.jobStatus.set(jobName, true);
      return true;
    }
    console.error(`Cron job not found: ${jobName}`);
    return false;
  }

  /**
   * Stop a specific cron job
   */
  stopJob(jobName: string): boolean {
    const job = this.jobs.get(jobName);
    if (job) {
      job.stop();
      this.jobStatus.set(jobName, false);
      return true;
    }
    console.error(`Cron job not found: ${jobName}`);
    return false;
  }

  /**
   * Start all cron jobs
   */
  startAll() {
    if (!this.isInitialized) {
      this.initialize();
    }

    let startedCount = 0;
    this.jobs.forEach((job, name) => {
      try {
        job.start();
        this.jobStatus.set(name, true);
        startedCount++;
      } catch (error) {
        console.error(`Failed to start cron job ${name}:`, error);
      }
    });

    return startedCount;
  }

  /**
   * Stop all cron jobs
   */
  stopAll() {
    let stoppedCount = 0;
    this.jobs.forEach((job, name) => {
      try {
        job.stop();
        this.jobStatus.set(name, false);
        stoppedCount++;
      } catch (error) {
        console.error(`Failed to stop cron job ${name}:`, error);
      }
    });

    return stoppedCount;
  }

  /**
   * Get status of all cron jobs
   */
  getStatus(): Record<string, boolean> {
    const status: Record<string, boolean> = {};
    this.jobs.forEach((job, name) => {
      // Use in-memory status tracking (default method)
      status[name] = this.jobStatus.get(name) || false;
    });
    
    return status;
  }

  /**
   * Get detailed status information for all cron jobs
   */
  getDetailedStatus(): Record<string, { status: string; running: boolean }> {
    const status: Record<string, { status: string; running: boolean }> = {};
    this.jobs.forEach((job, name) => {
      try {
        const jobStatus = job.getStatus();
        const statusStr = typeof jobStatus === 'string' ? jobStatus : 'unknown';
        status[name] = {
          status: statusStr,
          running: statusStr === 'scheduled' || statusStr === 'running'
        };
      } catch (error) {
        console.error(`Error getting detailed status for job ${name}:`, error);
        status[name] = {
          status: 'error',
          running: false
        };
      }
    });
    return status;
  }

  /**
   * Destroy a specific cron job
   */
  destroyJob(jobName: string): boolean {
    const job = this.jobs.get(jobName);
    if (job) {
      job.destroy();
      this.jobs.delete(jobName);
      return true;
    }
    console.error(`Cron job not found: ${jobName}`);
    return false;
  }

  /**
   * Destroy all cron jobs
   */
  destroyAll() {
    let destroyedCount = 0;
    this.jobs.forEach((job, name) => {
      try {
        job.destroy();
        destroyedCount++;
      } catch (error) {
        console.error(`Failed to destroy cron job ${name}:`, error);
      }
    });

    this.jobs.clear();
    this.isInitialized = false;
    return destroyedCount;
  }

  /**
   * Check if cron service is initialized
   */
  get initialized(): boolean {
    return this.isInitialized;
  }

  /**
   * Get list of available jobs
   */
  getJobNames(): string[] {
    return Array.from(this.jobs.keys());
  }
}

// Global singleton to prevent multiple instances in development
declare global {
  var __cronService: CronService | undefined;
}

// Export singleton instance
export const cronService = global.__cronService || new CronService();

if (process.env.NODE_ENV !== 'production') {
  global.__cronService = cronService;
}

// Graceful shutdown
process.on('SIGINT', () => {
  cronService.stopAll();
  process.exit(0);
});

process.on('SIGTERM', () => {
  cronService.stopAll();
  process.exit(0);
});
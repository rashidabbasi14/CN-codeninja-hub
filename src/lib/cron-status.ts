import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * File-based cron job status tracking
 * This ensures status consistency across multiple service instances
 */

const STATUS_FILE = join(process.cwd(), 'src', 'lib', 'cron-status.json');

export interface CronJobStatus {
  [jobName: string]: {
    running: boolean;
    lastStarted?: string;
    lastStopped?: string;
    pid?: number;
  };
}

/**
 * Read cron job status from file
 */
export function readCronStatus(): CronJobStatus {
  try {
    if (!existsSync(STATUS_FILE)) {
      return {};
    }
    const data = readFileSync(STATUS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading cron status file:', error);
    return {};
  }
}

/**
 * Write cron job status to file
 */
export function writeCronStatus(status: CronJobStatus): void {
  try {
    // Ensure lib directory exists
    const dir = join(process.cwd(), 'src', 'lib');
    if (!existsSync(dir)) {
      require('fs').mkdirSync(dir, { recursive: true });
    }
    
    writeFileSync(STATUS_FILE, JSON.stringify(status, null, 2));
  } catch (error) {
    console.error('Error writing cron status file:', error);
  }
}

/**
 * Update status for a specific job
 */
export function updateJobStatus(jobName: string, running: boolean): void {
  const status = readCronStatus();
  status[jobName] = {
    ...status[jobName],
    running,
    [running ? 'lastStarted' : 'lastStopped']: new Date().toISOString(),
    pid: running ? process.pid : undefined
  };
  writeCronStatus(status);
}

/**
 * Get status for a specific job
 */
export function getJobStatus(jobName: string): boolean {
  const status = readCronStatus();
  return status[jobName]?.running || false;
}

/**
 * Get all job statuses
 */
export function getAllJobStatuses(): Record<string, boolean> {
  const status = readCronStatus();
  const result: Record<string, boolean> = {};
  
  for (const [jobName, jobData] of Object.entries(status)) {
    result[jobName] = jobData.running;
  }
  
  return result;
}

/**
 * Initialize status for known jobs
 */
export function initializeJobStatuses(jobNames: string[]): void {
  const status = readCronStatus();
  let updated = false;
  
  for (const jobName of jobNames) {
    if (!status[jobName]) {
      status[jobName] = {
        running: false,
        lastStopped: new Date().toISOString()
      };
      updated = true;
    }
  }
  
  if (updated) {
    writeCronStatus(status);
  }
}
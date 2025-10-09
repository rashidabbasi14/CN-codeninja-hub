import { NextRequest, NextResponse } from 'next/server';
import { cronService } from '@/lib/cron';

/**
 * GET /api/admin/cron - Get cron job status
 */
export async function GET() {
  try {
    const status = cronService.getStatus();
    const jobNames = cronService.getJobNames();
    
    return NextResponse.json({
      success: true,
      initialized: cronService.initialized,
      jobs: status,
      availableJobs: jobNames,
      totalJobs: jobNames.length,
      runningJobs: Object.values(status).filter(Boolean).length,
      message: `Cron service ${cronService.initialized ? 'is' : 'is not'} initialized`
    });
  } catch (error) {
    console.error('Failed to get cron status:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/cron - Manage cron jobs
 */
export async function POST(request: NextRequest) {
  try {
    const { action, jobName } = await request.json();

    switch (action) {
      case 'start':
        if (jobName) {
          const success = cronService.startJob(jobName);
          return NextResponse.json({
            success,
            message: success 
              ? `Started cron job: ${jobName}` 
              : `Failed to start cron job: ${jobName}`
          });
        } else {
          const startedCount = cronService.startAll();
          return NextResponse.json({
            success: true,
            message: `Started ${startedCount} cron jobs`,
            startedCount
          });
        }

      case 'stop':
        if (jobName) {
          const success = cronService.stopJob(jobName);
          return NextResponse.json({
            success,
            message: success 
              ? `Stopped cron job: ${jobName}` 
              : `Failed to stop cron job: ${jobName}`
          });
        } else {
          const stoppedCount = cronService.stopAll();
          return NextResponse.json({
            success: true,
            message: `Stopped ${stoppedCount} cron jobs`,
            stoppedCount
          });
        }

      case 'restart':
        if (jobName) {
          cronService.stopJob(jobName);
          const success = cronService.startJob(jobName);
          return NextResponse.json({
            success,
            message: success 
              ? `Restarted cron job: ${jobName}` 
              : `Failed to restart cron job: ${jobName}`
          });
        } else {
          cronService.stopAll();
          const startedCount = cronService.startAll();
          return NextResponse.json({
            success: true,
            message: `Restarted all cron jobs (${startedCount} started)`,
            startedCount
          });
        }

      case 'initialize':
        cronService.initialize();
        return NextResponse.json({
          success: true,
          message: 'Cron service initialized',
          availableJobs: cronService.getJobNames()
        });

      case 'destroy':
        if (jobName) {
          const success = cronService.destroyJob(jobName);
          return NextResponse.json({
            success,
            message: success 
              ? `Destroyed cron job: ${jobName}` 
              : `Failed to destroy cron job: ${jobName}`
          });
        } else {
          const destroyedCount = cronService.destroyAll();
          return NextResponse.json({
            success: true,
            message: `Destroyed ${destroyedCount} cron jobs`,
            destroyedCount
          });
        }

      default:
        return NextResponse.json(
          { 
            success: false, 
            error: `Invalid action: ${action}. Valid actions: start, stop, restart, initialize, destroy` 
          },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Cron management failed:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
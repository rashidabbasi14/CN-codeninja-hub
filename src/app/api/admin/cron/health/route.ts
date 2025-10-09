import { NextResponse } from 'next/server';
import { cronService } from '@/lib/cron';

/**
 * GET /api/admin/cron/health - Health check and auto-restart endpoint
 */
export async function GET() {
  try {
    // Initialize if not already done
    if (!cronService.initialized) {
      cronService.initialize();
    }

    // Get current status
    const status = cronService.getStatus();
    const runningJobs = Object.values(status).filter(Boolean).length;
    const totalJobs = Object.keys(status).length;

    // Auto-restart stopped jobs
    if (runningJobs < totalJobs) {
      const startedCount = cronService.startAll();
      return NextResponse.json({
        success: true,
        message: `Health check completed. Restarted ${startedCount} jobs.`,
        status: {
          initialized: cronService.initialized,
          runningJobs: Object.values(cronService.getStatus()).filter(Boolean).length,
          totalJobs: cronService.getJobNames().length,
          jobs: cronService.getStatus()
        },
        action: 'restarted'
      });
    }

    return NextResponse.json({
      success: true,
      message: 'All cron jobs are running normally.',
      status: {
        initialized: cronService.initialized,
        runningJobs,
        totalJobs,
        jobs: status
      },
      action: 'healthy'
    });
  } catch (error) {
    console.error('Cron health check failed:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        status: {
          initialized: false,
          runningJobs: 0,
          totalJobs: 0,
          jobs: {}
        }
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/cron/health - Force restart all cron jobs
 */
export async function POST() {
  try {
    // Stop all jobs first
    cronService.stopAll();
    
    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Reinitialize and start
    if (!cronService.initialized) {
      cronService.initialize();
    }
    
    const startedCount = cronService.startAll();
    
    return NextResponse.json({
      success: true,
      message: `Force restart completed. Started ${startedCount} jobs.`,
      status: {
        initialized: cronService.initialized,
        runningJobs: Object.values(cronService.getStatus()).filter(Boolean).length,
        totalJobs: cronService.getJobNames().length,
        jobs: cronService.getStatus()
      },
      action: 'force_restarted'
    });
  } catch (error) {
    console.error('Force restart failed:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
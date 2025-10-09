import { NextResponse } from 'next/server';
import { getCronHealthStatus } from '@/lib/vercel-cron-status';

/**
 * Vercel Cron Health Check Endpoint
 * This provides monitoring and status information for all cron jobs
 */
export async function GET() {
  try {
    const healthStatus = await getCronHealthStatus();
    
    return NextResponse.json({
      success: true,
      message: 'Cron health check completed',
      timestamp: new Date().toISOString(),
      platform: 'vercel',
      ...healthStatus
    });
  } catch (error) {
    console.error('Cron health check failed:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        platform: 'vercel',
        healthy: false
      },
      { status: 500 }
    );
  }
}

/**
 * Manual trigger for all cron jobs (for testing)
 */
export async function POST() {
  try {
    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : process.env.NEXTAUTH_URL || 'http://localhost:3000';

    // Trigger all cron jobs manually
    const cronJobs = [
      '/api/cron/game-reminders',
      '/api/cron/early-reminders', 
      '/api/cron/cache-cleanup'
    ];

    const results = await Promise.allSettled(
      cronJobs.map(async (job) => {
        const response = await fetch(`${baseUrl}${job}`, {
          method: 'GET',
          headers: {
            'User-Agent': 'Vercel-Cron-Health-Check'
          }
        });
        
        const data = await response.json();
        return { job, success: response.ok, data };
      })
    );

    const summary = results.map((result, index) => ({
      jobPath: cronJobs[index],
      status: result.status,
      ...(result.status === 'fulfilled' ? result.value : { error: result.reason })
    }));

    return NextResponse.json({
      success: true,
      message: 'Manual cron trigger completed',
      timestamp: new Date().toISOString(),
      results: summary
    });
  } catch (error) {
    console.error('Manual cron trigger failed:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
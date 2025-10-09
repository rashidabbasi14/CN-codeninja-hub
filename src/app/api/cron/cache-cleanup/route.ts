import { NextResponse } from 'next/server';
import { executeCronJob } from '@/lib/vercel-cron-status';

/**
 * Vercel Cron Job: Cache Cleanup
 * This endpoint is called by Vercel's cron service every hour
 */
export async function GET() {
  const result = await executeCronJob(
    'cache-cleanup',
    async () => {
      // Import cache instance
      const { cache } = await import('@/lib/cache');
      
      // Perform cache cleanup
      cache.cleanup();
      
      // Get cache stats for logging
      const stats = cache.getStats();
      
      return {
        cleanedUp: true,
        cacheSize: stats.size,
        cacheKeys: stats.keys.length
      };
    }
  );

  if (result.success) {
    return NextResponse.json({
      success: true,
      message: 'Cache cleanup completed successfully',
      timestamp: new Date().toISOString(),
      result: result.result
    });
  } else {
    return NextResponse.json(
      {
        success: false,
        error: result.error,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

// Also handle POST for manual triggers
export async function POST() {
  return GET();
}
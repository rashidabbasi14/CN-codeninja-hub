import { NextResponse } from 'next/server';
import { scheduleGameReminders } from '@/lib/email/game-reminder';
import { executeCronJob } from '@/lib/vercel-cron-status';

/**
 * Vercel Cron Job: Early Game Reminders (30 minutes before)
 * This endpoint is called by Vercel's cron service every 5 minutes
 */
export async function GET() {
  const result = await executeCronJob(
    'early-reminders',
    async () => {
      // Send reminders for games starting in 30 minutes
      return await scheduleGameReminders(30);
    },
    { reminderWindow: '30 minutes' }
  );

  if (result.success) {
    return NextResponse.json({
      success: true,
      message: 'Early game reminders processed successfully',
      timestamp: new Date().toISOString(),
      reminderWindow: '30 minutes',
      result: result.result
    });
  } else {
    return NextResponse.json(
      {
        success: false,
        error: result.error,
        timestamp: new Date().toISOString(),
        reminderWindow: '30 minutes'
      },
      { status: 500 }
    );
  }
}

// Also handle POST for manual triggers
export async function POST() {
  return GET();
}
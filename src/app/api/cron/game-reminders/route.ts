import { NextResponse } from 'next/server';
import { scheduleGameReminders } from '@/lib/email/game-reminder';
import { executeCronJob } from '@/lib/vercel-cron-status';

/**
 * Vercel Cron Job: Game Reminders (10 minutes before)
 * This endpoint is called by Vercel's cron service every minute
 */
export async function GET() {
  const result = await executeCronJob(
    'game-reminders',
    async () => {
      // Send reminders for games starting in 10 minutes
      return await scheduleGameReminders(10);
    },
    { reminderWindow: '10 minutes' }
  );

  if (result.success) {
    return NextResponse.json({
      success: true,
      message: 'Game reminders processed successfully',
      timestamp: new Date().toISOString(),
      reminderWindow: '10 minutes',
      result: result.result
    });
  } else {
    return NextResponse.json(
      {
        success: false,
        error: result.error,
        timestamp: new Date().toISOString(),
        reminderWindow: '10 minutes'
      },
      { status: 500 }
    );
  }
}

// Also handle POST for manual triggers
export async function POST() {
  return GET();
}
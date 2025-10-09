import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { sendMatchScheduledNotification } from '@/lib/email/match-notification';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; matchId: string } }
) {
  try {
    const gameId = params.id;
    const matchId = params.matchId;

    // Require authentication and admin role
    const user = await requireAuth(request);
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    console.log('📧 Resending match notification for match:', matchId);

    // Get the match details
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: {
        game: {
          include: {
            category: true
          }
        },
        slot: true
      }
    });

    if (!match) {
      return NextResponse.json(
        { error: 'Match not found' },
        { status: 404 }
      );
    }

    if (match.gameId !== gameId) {
      return NextResponse.json(
        { error: 'Match does not belong to this game' },
        { status: 400 }
      );
    }

    if (!match.slot) {
      return NextResponse.json(
        { error: 'Match has no associated time slot' },
        { status: 400 }
      );
    }

    // Prepare notification data
    const notificationData = {
      gameId: match.gameId,
      gameName: match.game.name,
      categoryName: match.game.category?.name || 'Unknown Category',
      contestType: match.game.contestType,
      matchDateTime: match.slot.startTime,
      venueName: undefined, // Venue info not in current schema
      courtName: undefined, // Court info not in current schema
      timelineName: `Timeline ${match.slot.timelineId}`,
      participantAId: match.participantAId,
      participantAType: (match.participantAType as 'USER' | 'TEAM' | 'PLACEHOLDER' | 'FOUR_PARTICIPANT_DATA'),
      participantBId: match.participantBId,
      participantBType: (match.participantBType as 'USER' | 'TEAM' | 'PLACEHOLDER' | 'FOUR_PARTICIPANT_DATA'),
      participantCId: undefined, // Not in current Match schema
      participantCType: undefined, // Not in current Match schema
      participantDId: undefined, // Not in current Match schema
      participantDType: undefined, // Not in current Match schema
      eventId: undefined // Event relationship not direct in current schema
    };

    // Send the notification
    await sendMatchScheduledNotification(notificationData);

    console.log('✅ Successfully resent match notification for match:', matchId);

    return NextResponse.json({
      success: true,
      message: 'Match notification resent successfully'
    });

  } catch (error) {
    console.error('❌ Error resending match notification:', error);
    return NextResponse.json(
      { error: 'Failed to resend match notification' },
      { status: 500 }
    );
  }
}
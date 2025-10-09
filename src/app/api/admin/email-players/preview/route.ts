import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    // Verify admin access
    const user = await requireAdmin(request);
    if (!user) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { recipientType, gameId, customEmails } = await request.json();

    let recipients: any[] = [];
    let recipientInfo = '';

    if (recipientType === 'all') {
      // Get all registered players (users who have registrations)
      recipients = await prisma.user.findMany({
        where: {
          registrations: {
            some: {}
          }
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
        },
        distinct: ['id']
      });
      recipientInfo = 'All registered players';
    } else if (recipientType === 'game') {
      // Get players registered for specific game
      const game = await prisma.game.findUnique({
        where: { id: gameId },
        include: {
          category: true
        }
      });

      if (!game) {
        return NextResponse.json({ error: 'Game not found' }, { status: 404 });
      }

      recipients = await prisma.user.findMany({
        where: {
          registrations: {
            some: {
              gameId: gameId
            }
          }
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
        },
        distinct: ['id']
      });

      recipientInfo = `Players registered for "${game.name}" in ${game.category.name}`;
    } else if (recipientType === 'custom') {
      // Parse custom email addresses
      const emailList = customEmails
        .split(',')
        .map((email: string) => email.trim())
        .filter((email: string) => email.length > 0);

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const validEmails = emailList.filter((email: string) => emailRegex.test(email));
      const invalidEmails = emailList.filter((email: string) => !emailRegex.test(email));

      if (invalidEmails.length > 0) {
        return NextResponse.json({ 
          error: `Invalid email addresses: ${invalidEmails.join(', ')}` 
        }, { status: 400 });
      }

      recipients = validEmails.map((email: string) => ({ email, firstName: '', lastName: '' }));
      recipientInfo = 'Custom email addresses';
    }

    // Remove duplicates based on email
    const uniqueRecipients = recipients.filter((recipient, index, self) => 
      index === self.findIndex(r => r.email === recipient.email)
    );

    return NextResponse.json({
      recipientCount: uniqueRecipients.length,
      recipientInfo,
      recipients: uniqueRecipients.slice(0, 10), // Return first 10 for preview
      hasMore: uniqueRecipients.length > 10
    });

  } catch (error) {
    console.error('Error getting email preview:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
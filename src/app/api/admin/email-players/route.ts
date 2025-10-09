import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { emailService } from '@/lib/email';
import { generateAdminPlayerNotificationEmail } from '@/app/email-templates';

export async function POST(request: NextRequest) {
  try {
    // Verify admin access
    const user = await requireAdmin(request);
    if (!user) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { subject, content, recipientType = 'all', gameId, customEmails } = await request.json();

    if (!subject || !content) {
      return NextResponse.json({ error: 'Subject and content are required' }, { status: 400 });
    }

    if (recipientType === 'game' && !gameId) {
      return NextResponse.json({ error: 'Game ID is required for game-based emails' }, { status: 400 });
    }

    if (recipientType === 'custom' && !customEmails) {
      return NextResponse.json({ error: 'Custom emails are required for custom email type' }, { status: 400 });
    }

    let playerEmails: string[] = [];

    if (recipientType === 'custom') {
      // Parse and validate custom emails - handle both string and array inputs
      let emailList: string[];
      
      if (Array.isArray(customEmails)) {
        // If customEmails is already an array (from resend functionality)
        emailList = customEmails.map((email: string) => email.trim()).filter((email: string) => email.length > 0);
      } else {
        // If customEmails is a string (from manual input)
        emailList = customEmails.split(',').map((email: string) => email.trim()).filter((email: string) => email.length > 0);
      }
      
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      
      const validEmails = emailList.filter((email: string) => emailRegex.test(email));
      const invalidEmails = emailList.filter((email: string) => !emailRegex.test(email));
      
      if (invalidEmails.length > 0) {
        return NextResponse.json({
          error: `Invalid email addresses: ${invalidEmails.join(', ')}`
        }, { status: 400 });
      }
      
      if (validEmails.length === 0) {
        return NextResponse.json({ error: 'No valid email addresses provided' }, { status: 400 });
      }
      
      playerEmails = validEmails;
    } else {
      let registeredPlayers;

      if (recipientType === 'all') {
        // Get all registered players (users who have registrations)
        registeredPlayers = await prisma.user.findMany({
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
      } else {
        // Get players registered for specific game
        registeredPlayers = await prisma.user.findMany({
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
      }

      if (registeredPlayers.length === 0) {
        const errorMessage = recipientType === 'all'
          ? 'No registered players found'
          : 'No players found registered for the selected game';
        return NextResponse.json({ error: errorMessage }, { status: 404 });
      }

      // Extract email addresses
      playerEmails = registeredPlayers.map(player => player.email);
    }

    // Generate HTML email content using template
    const emailHtml = generateAdminPlayerNotificationEmail({
      subject,
      content,
    });

    // Log email sending attempt
    console.log(`[EMAIL SEND] Admin ${user.email} sending "${subject}" to ${playerEmails.length} recipients (${recipientType})`);

    // Send email to all players
    const emailSent = await emailService.sendEmail(
      playerEmails,
      subject,
      emailHtml,
      {},
      user.id
    );

    if (!emailSent) {
      console.error(`[EMAIL SEND FAILED] Failed to send emails to ${playerEmails.length} recipients`);
      return NextResponse.json({
        error: 'Failed to send emails. This may be due to rate limiting or email service issues. Please try again with fewer recipients or wait a few minutes.',
        recipientCount: playerEmails.length,
        suggestion: playerEmails.length > 50 ? 'Consider sending to smaller groups (under 50 recipients) for better reliability.' : 'Please check email service configuration and try again.'
      }, { status: 500 });
    }

    // Enhanced audit log with detailed information
    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: 'EMAIL_PLAYERS_BULK',
        entity: 'EMAIL',
        entityId: `bulk-email-${Date.now()}`,
        payload: JSON.stringify({
          subject,
          content: content.substring(0, 200) + (content.length > 200 ? '...' : ''), // Truncate content for logging
          recipientType,
          gameId: recipientType === 'game' ? gameId : null,
          customEmails: recipientType === 'custom' ? customEmails : null,
          recipientCount: playerEmails.length,
          recipients: playerEmails,
          sentAt: new Date().toISOString(),
          adminEmail: user.email,
          adminName: `${user.firstName} ${user.lastName}`,
          success: true
        })
      }
    });


    return NextResponse.json({ 
      success: true, 
      message: `Email sent to ${playerEmails.length} registered players`,
      recipientCount: playerEmails.length
    });

  } catch (error) {
    console.error('[EMAIL SEND ERROR] Error sending emails to players:', error);
    console.error('[EMAIL SEND ERROR] Stack trace:', error instanceof Error ? error.stack : 'No stack trace available');
    
    // Log failed attempt to audit log if we have user context
    try {
      const user = await requireAdmin(request);
      if (user) {
        await prisma.auditLog.create({
          data: {
            actorId: user.id,
            action: 'EMAIL_PLAYERS_BULK_FAILED',
            entity: 'EMAIL',
            entityId: `bulk-email-failed-${Date.now()}`,
            payload: JSON.stringify({
              error: error instanceof Error ? error.message : 'Unknown error',
              timestamp: new Date().toISOString(),
              adminEmail: user.email,
              success: false
            })
          }
        });
      }
    } catch (auditError) {
      console.error('[AUDIT LOG ERROR] Failed to log email send failure:', auditError);
    }
    
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { auditLogger, createAuditContext } from '@/lib/audit';

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user || (user.role !== 'ADMIN' && user.role !== 'MODERATOR')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { emails, gameId, bypassDeadline = true } = await request.json();

    if (!emails || !gameId) {
      return NextResponse.json({ error: 'Emails and game ID are required' }, { status: 400 });
    }

    // Parse emails (including empty ones for tracking)
    const rawEmailList = emails.split(',').map((email: string) => email.trim());
    const emailList = rawEmailList.filter((email: string) => email.length > 0).map((email: string) => email.toLowerCase());
    
    // Track results
    const results = {
      successful: [] as Array<{ email: string; name: string }>,
      failed: [] as Array<{ email: string; reason: string }>,
      skipped: [] as Array<{ email: string; reason: string }>
    };

    // Track empty emails
    const emptyEmails = rawEmailList.filter((email: string) => email.length === 0);
    emptyEmails.forEach(() => {
      results.failed.push({ email: '(empty)', reason: 'Empty email address' });
    });
    
    if (emailList.length === 0) {
      return NextResponse.json({
        message: 'No valid emails to process',
        results: {
          successful: results.successful.length,
          failed: results.failed.length,
          skipped: results.skipped.length,
          details: results
        }
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const validEmails: string[] = [];
    
    emailList.forEach((email: string) => {
      if (emailRegex.test(email)) {
        validEmails.push(email);
      } else {
        results.failed.push({ email, reason: 'Invalid email format' });
      }
    });

    // Get game and category information
    const game = await prisma.game.findUnique({
      where: { id: gameId },
      include: {
        category: {
          select: {
            id: true,
            perPersonCap: true,
            registrationDeadline: true,
            name: true
          }
        }
      }
    });

    if (!game) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    // Check registration deadline (bypass for admin bulk registration)
    if (!bypassDeadline && game.category.registrationDeadline && new Date(game.category.registrationDeadline).getTime() <= new Date().getTime()) {
      return NextResponse.json({ error: 'Registration deadline has passed' }, { status: 400 });
    }

    // Find users by email (only for valid emails)
    const users = validEmails.length > 0 ? await prisma.user.findMany({
      where: {
        email: { in: validEmails }
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        isBlocked: true
      }
    }) : [];

    // Check for non-existent users
    const foundEmails = users.map(u => u.email.toLowerCase());
    const notFoundEmails = validEmails.filter((email: string) => !foundEmails.includes(email));
    
    notFoundEmails.forEach((email: string) => {
      results.failed.push({ email, reason: 'User not found' });
    });

    // Process each found user
    for (const targetUser of users) {
      try {
        // Skip blocked users
        if (targetUser.isBlocked) {
          results.skipped.push({ 
            email: targetUser.email, 
            reason: 'User is blocked' 
          });
          continue;
        }

        // Check if user is already registered for this game
        const existingRegistration = await prisma.registration.findFirst({
          where: {
            userId: targetUser.id,
            gameId: gameId
          }
        });

        if (existingRegistration) {
          results.skipped.push({ 
            email: targetUser.email, 
            reason: 'Already registered for this game' 
          });
          continue;
        }

        // Check participation limit (perPersonCap)
        if (game.category.perPersonCap && game.category.perPersonCap !== 2147483647) {
          const currentParticipationCount = await prisma.registration.count({
            where: {
              userId: targetUser.id,
              game: {
                categoryId: game.category.id
              }
            }
          });

          if (currentParticipationCount >= game.category.perPersonCap) {
            results.skipped.push({ 
              email: targetUser.email, 
              reason: `User has reached participation limit (${game.category.perPersonCap} games)` 
            });
            continue;
          }
        }

        // Create registration
        await prisma.registration.create({
          data: {
            userId: targetUser.id,
            gameId: gameId,
            level: 'Beginner',
            mode: 'individual',
            allowAutoAssign: true
          }
        });

        const userName = targetUser.firstName && targetUser.lastName 
          ? `${targetUser.firstName} ${targetUser.lastName}`
          : targetUser.email;

        results.successful.push({ 
          email: targetUser.email, 
          name: userName 
        });

        // Log the registration activity
        try {
          await auditLogger.log(
            user.id,
            'game.registered',
            'registration',
            gameId,
            {
              targetUserId: targetUser.id,
              targetUserEmail: targetUser.email,
              gameName: game.name,
              level: 'Beginner',
              mode: 'individual',
              categoryId: game.category.id,
              categoryName: game.category.name,
              timestamp: new Date().toISOString()
            },
            createAuditContext(request)
          );
        } catch (auditError) {
          console.error('Failed to log bulk registration activity:', auditError);
        }

      } catch (error) {
        console.error(`Failed to register ${targetUser.email}:`, error);
        results.failed.push({ 
          email: targetUser.email, 
          reason: 'Registration failed due to system error' 
        });
      }
    }

    return NextResponse.json({
      message: 'Bulk registration completed',
      results: {
        successful: results.successful.length,
        failed: results.failed.length,
        skipped: results.skipped.length,
        details: results
      }
    });

  } catch (error) {
    console.error('Bulk registration error:', error);
    return NextResponse.json({
      error: 'Failed to process bulk registration'
    }, { status: 500 });
  }
}
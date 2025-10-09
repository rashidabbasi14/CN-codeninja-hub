import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser, requireAuth } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const reactions = await prisma.newsReaction.findMany({
      where: {
        newsId: params.id
      },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    });

    return NextResponse.json(reactions);
  } catch (error) {
    console.error('Failed to fetch news reactions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch reactions' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth(request);
    const { type } = await request.json();

    if (!type || !['like', 'love', 'celebrate', 'laugh'].includes(type)) {
      return NextResponse.json(
        { error: 'Valid reaction type is required (like, love, celebrate, laugh)' },
        { status: 400 }
      );
    }

    // Check if news item exists
    const newsItem = await prisma.news.findUnique({
      where: { id: params.id }
    });

    if (!newsItem) {
      return NextResponse.json(
        { error: 'News item not found' },
        { status: 404 }
      );
    }

    // Check if user already reacted to this news item
    const existingReaction = await prisma.newsReaction.findFirst({
      where: {
        newsId: params.id,
        userId: user.id
      }
    });

    let reaction;

    if (existingReaction) {
      if (existingReaction.type === type) {
        // Same reaction - remove it (toggle off)
        await prisma.newsReaction.delete({
          where: {
            id: existingReaction.id
          }
        });

        // Log the reaction removal
        await prisma.auditLog.create({
          data: {
            actorId: user.id,
            action: 'REMOVE_NEWS_REACTION',
            entity: 'NewsReaction',
            entityId: existingReaction.id,
            payload: JSON.stringify({
              newsId: params.id,
              type: type
            })
          }
        });

        return NextResponse.json({ success: true, action: 'removed' });
      } else {
        // Different reaction - update it
        reaction = await prisma.newsReaction.update({
          where: {
            id: existingReaction.id
          },
          data: {
            type: type
          },
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                email: true
              }
            }
          }
        });

        // Log the reaction update
        await prisma.auditLog.create({
          data: {
            actorId: user.id,
            action: 'UPDATE_NEWS_REACTION',
            entity: 'NewsReaction',
            entityId: reaction.id,
            payload: JSON.stringify({
              newsId: params.id,
              oldType: existingReaction.type,
              newType: type
            })
          }
        });
      }
    } else {
      // New reaction - create it
      reaction = await prisma.newsReaction.create({
        data: {
          type: type,
          newsId: params.id,
          userId: user.id
        },
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              email: true
            }
          }
        }
      });

      // Log the reaction creation
      await prisma.auditLog.create({
        data: {
          actorId: user.id,
          action: 'CREATE_NEWS_REACTION',
          entity: 'NewsReaction',
          entityId: reaction.id,
          payload: JSON.stringify({
            newsId: params.id,
            type: type
          })
        }
      });
    }

    return NextResponse.json({
      success: true,
      action: existingReaction ? 'updated' : 'created',
      reaction: reaction
    });
  } catch (error) {
    console.error('Failed to toggle news reaction:', error);
    
    if (error instanceof Error && error.message === 'Authentication required') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    
    return NextResponse.json(
      { error: 'Failed to toggle reaction' },
      { status: 500 }
    );
  }
}
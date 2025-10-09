import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser, requireAuth } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const reactions = await prisma.reaction.findMany({
      where: {
        entityType: 'POST',
        entityId: params.id
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
    console.error('Failed to fetch reactions:', error);
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

    // Check if post exists
    const post = await prisma.post.findUnique({
      where: { id: params.id }
    });

    if (!post) {
      return NextResponse.json(
        { error: 'Post not found' },
        { status: 404 }
      );
    }

    // Check if user already reacted to this post
    const existingReaction = await prisma.reaction.findFirst({
      where: {
        entityType: 'POST',
        entityId: params.id,
        userId: user.id
      }
    });

    let reaction;

    if (existingReaction) {
      if (existingReaction.type === type) {
        // Same reaction - remove it (toggle off)
        await prisma.reaction.delete({
          where: {
            id: existingReaction.id
          }
        });

        // Log the reaction removal
        await prisma.auditLog.create({
          data: {
            actorId: user.id,
            action: 'REMOVE_REACTION',
            entity: 'Reaction',
            entityId: existingReaction.id,
            payload: JSON.stringify({
              postId: params.id,
              type: type
            })
          }
        });

        return NextResponse.json({ success: true, action: 'removed' });
      } else {
        // Different reaction - update it
        reaction = await prisma.reaction.update({
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
            action: 'UPDATE_REACTION',
            entity: 'Reaction',
            entityId: reaction.id,
            payload: JSON.stringify({
              postId: params.id,
              oldType: existingReaction.type,
              newType: type
            })
          }
        });
      }
    } else {
      // New reaction - create it
      reaction = await prisma.reaction.create({
        data: {
          type: type,
          entityType: 'POST',
          entityId: params.id,
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
          action: 'CREATE_REACTION',
          entity: 'Reaction',
          entityId: reaction.id,
          payload: JSON.stringify({
            postId: params.id,
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
    console.error('Failed to toggle reaction:', error);
    
    if (error instanceof Error && error.message === 'Authentication required') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    
    return NextResponse.json(
      { error: 'Failed to toggle reaction' },
      { status: 500 }
    );
  }
}
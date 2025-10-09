import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser, requireAuth } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const comments = await prisma.comment.findMany({
      where: {
        postId: params.id
      },
      include: {
        author: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            avatarUrl: true
          }
        }
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    return NextResponse.json(comments);
  } catch (error) {
    console.error('Failed to fetch comments:', error);
    return NextResponse.json(
      { error: 'Failed to fetch comments' },
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
    const { content } = await request.json();

    if (!content?.trim()) {
      return NextResponse.json(
        { error: 'Comment content is required' },
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

    const comment = await prisma.comment.create({
      data: {
        content: content.trim(),
        postId: params.id,
        authorId: user.id
      },
      include: {
        author: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            avatarUrl: true
          }
        }
      }
    });

    // Log the comment creation
    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: 'CREATE_COMMENT',
        entity: 'Comment',
        entityId: comment.id,
        payload: JSON.stringify({
          postId: params.id,
          content: content.substring(0, 100)
        })
      }
    });

    return NextResponse.json(comment);
  } catch (error) {
    console.error('Failed to create comment:', error);
    
    if (error instanceof Error && error.message === 'Authentication required') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    
    return NextResponse.json(
      { error: 'Failed to create comment' },
      { status: 500 }
    );
  }
}
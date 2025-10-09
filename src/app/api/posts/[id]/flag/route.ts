import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth(request);
    const { reason } = await request.json();

    if (!reason?.trim()) {
      return NextResponse.json(
        { error: 'Flag reason is required' },
        { status: 400 }
      );
    }

    // Check if post exists
    const post = await prisma.post.findUnique({
      where: { id: params.id },
      select: { id: true, authorId: true, content: true }
    });

    if (!post) {
      return NextResponse.json(
        { error: 'Post not found' },
        { status: 404 }
      );
    }

    // Check if user already flagged this post
    const existingFlag = await prisma.auditLog.findFirst({
      where: {
        actorId: user.id,
        action: 'FLAG_POST',
        entityId: params.id
      }
    });

    if (existingFlag) {
      return NextResponse.json(
        { error: 'You have already flagged this post' },
        { status: 400 }
      );
    }

    // Create flag audit log
    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: 'FLAG_POST',
        entity: 'Post',
        entityId: params.id,
        payload: JSON.stringify({
          reason: reason.trim(),
          postAuthorId: post.authorId,
          postContent: post.content?.substring(0, 100)
        })
      }
    });

    return NextResponse.json({ 
      success: true, 
      message: 'Post has been flagged for review' 
    });
  } catch (error) {
    console.error('Failed to flag post:', error);
    
    if (error instanceof Error && error.message === 'Authentication required') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    
    return NextResponse.json(
      { error: 'Failed to flag post' },
      { status: 500 }
    );
  }
}
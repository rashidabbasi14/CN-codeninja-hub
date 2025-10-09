import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin, requireAdminForDelete } from '@/lib/auth';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAdminForDelete(request);

    // Check if comment exists
    const comment = await prisma.comment.findUnique({
      where: { id: params.id },
      include: {
        author: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        post: {
          select: {
            id: true,
            content: true
          }
        }
      }
    });

    if (!comment) {
      return NextResponse.json(
        { error: 'Comment not found' },
        { status: 404 }
      );
    }

    // Delete the comment
    await prisma.comment.delete({
      where: { id: params.id }
    });

    // Create audit log entry
    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: 'DELETE_COMMENT',
        entity: 'Comment',
        entityId: params.id,
        payload: JSON.stringify({
          commentAuthorId: comment.author.id,
          commentAuthorName: `${comment.author.firstName} ${comment.author.lastName}`,
          commentAuthorEmail: comment.author.email,
          commentContent: comment.content.substring(0, 100),
          postId: comment.post.id,
          postContent: comment.post.content.substring(0, 50),
          deletedBy: 'admin_moderation'
        })
      }
    });

    return NextResponse.json({ 
      success: true, 
      message: 'Comment deleted successfully' 
    });
  } catch (error) {
    console.error('Failed to delete comment:', error);
    
    if (error instanceof Error && error.message === 'Authentication required') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    
    return NextResponse.json(
      { error: 'Failed to delete comment' },
      { status: 500 }
    );
  }
}
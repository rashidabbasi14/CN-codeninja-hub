import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin, requireAdminForDelete } from '@/lib/auth';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAdminForDelete(request);

    // Check if post exists
    const post = await prisma.post.findUnique({
      where: { id: params.id },
      include: {
        author: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    });

    if (!post) {
      return NextResponse.json(
        { error: 'Post not found' },
        { status: 404 }
      );
    }

    // Delete the post (this will cascade delete comments due to schema)
    await prisma.post.delete({
      where: { id: params.id }
    });

    // Create audit log entry
    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: 'DELETE_POST',
        entity: 'Post',
        entityId: params.id,
        payload: JSON.stringify({
          postAuthorId: post.author.id,
          postAuthorName: `${post.author.firstName} ${post.author.lastName}`,
          postAuthorEmail: post.author.email,
          postContent: post.content.substring(0, 100),
          deletedBy: 'admin_moderation'
        })
      }
    });

    return NextResponse.json({ 
      success: true, 
      message: 'Post deleted successfully' 
    });
  } catch (error) {
    console.error('Failed to delete post:', error);
    
    if (error instanceof Error && error.message === 'Authentication required') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    
    return NextResponse.json(
      { error: 'Failed to delete post' },
      { status: 500 }
    );
  }
}
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser, requireAuth } from '@/lib/auth';
import { uploadToCloudinary } from '@/lib/cloudUpload';
import { validateImageFile } from '@/lib/uploadUtils';

export async function GET(request: NextRequest) {
  try {
    const posts = await prisma.post.findMany({
      include: {
        author: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            avatarUrl: true
          }
        },
        _count: {
          select: {
            comments: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Get current user to check reactions (optional for posts viewing)
    const currentUser = await getCurrentUser(request);

    // Get reactions for all posts
    const postIds = posts.map(post => post.id);
    const reactions = await prisma.reaction.findMany({
      where: {
        entityType: 'POST',
        entityId: { in: postIds }
      },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true
          }
        }
      }
    });

    // Get flag status for current user if logged in
    let userFlags: any[] = [];
    if (currentUser) {
      userFlags = await prisma.auditLog.findMany({
        where: {
          actorId: currentUser.id,
          action: 'FLAG_POST',
          entityId: { in: postIds }
        },
        select: {
          entityId: true
        }
      });
    }

    // Add user reaction info to each post and parse mediaUrls
    const postsWithUserReactions = posts.map((post: any) => {
      const postReactions = reactions.filter(r => r.entityId === post.id);
      const isFlaggedByUser = currentUser && userFlags.length > 0
        ? userFlags.some(flag => flag.entityId === post.id)
        : false;
      
      return {
        ...post,
        mediaUrls: post.mediaUrls ? JSON.parse(post.mediaUrls) : [],
        reactions: postReactions,
        userReaction: currentUser ? postReactions.find((r: any) => r.userId === currentUser.id) : null,
        isFlaggedByUser: Boolean(isFlaggedByUser),
        _count: {
          ...post._count,
          reactions: postReactions.length
        }
      };
    });

    return NextResponse.json(postsWithUserReactions);
  } catch (error) {
    console.error('Failed to fetch posts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch posts' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    const formData = await request.formData();
    const content = formData.get('content') as string;
    const images = formData.getAll('images') as File[];

    if (!content?.trim() && images.length === 0) {
      return NextResponse.json(
        { error: 'Post content or images are required' },
        { status: 400 }
      );
    }

    // Process and save uploaded images
    const mediaUrls: string[] = [];
    const uploadErrors: string[] = [];

    for (const image of images) {
      // Validate image file
      const validation = validateImageFile(image);
      if (!validation.valid) {
        uploadErrors.push(validation.error || 'Invalid file');
        continue;
      }

      // Upload the file to Cloudinary
      const uploadResult = await uploadToCloudinary(image, 'feed');
      if (uploadResult.success && uploadResult.url) {
        mediaUrls.push(uploadResult.url);
      } else {
        uploadErrors.push(uploadResult.error || 'Failed to save file');
      }
    }

    // If there were upload errors but some files succeeded, continue
    // If all uploads failed and there's no content, return error
    if (uploadErrors.length > 0 && mediaUrls.length === 0 && !content?.trim()) {
      return NextResponse.json(
        { error: `Upload failed: ${uploadErrors.join(', ')}` },
        { status: 400 }
      );
    }

    const post = await prisma.post.create({
      data: {
        content: content || '',
        mediaUrls: mediaUrls.length > 0 ? JSON.stringify(mediaUrls) : null,
        authorId: user.id
      }
    });

    // Log the post creation
    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: 'CREATE_POST',
        entity: 'Post',
        entityId: post.id,
        payload: JSON.stringify({
          content: content?.substring(0, 100),
          mediaCount: mediaUrls.length,
          uploadErrors: uploadErrors.length > 0 ? uploadErrors : undefined
        })
      }
    });

    return NextResponse.json({
      success: true,
      postId: post.id,
      mediaCount: mediaUrls.length,
      uploadErrors: uploadErrors.length > 0 ? uploadErrors : undefined
    });
  } catch (error) {
    console.error('Failed to create post:', error);
    
    if (error instanceof Error && error.message === 'Authentication required') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    
    return NextResponse.json(
      { error: 'Failed to create post' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const { searchParams } = new URL(request.url);
    const postId = searchParams.get('id');

    if (!postId) {
      return NextResponse.json(
        { error: 'Post ID is required' },
        { status: 400 }
      );
    }

    // Check if post exists and get author info
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { authorId: true, content: true }
    });

    if (!post) {
      return NextResponse.json(
        { error: 'Post not found' },
        { status: 404 }
      );
    }

    // Only allow author or admin to delete
    if (post.authorId !== user.id && user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Not authorized to delete this post' },
        { status: 403 }
      );
    }

    // Delete the post (this will cascade delete comments and reactions)
    await prisma.post.delete({
      where: { id: postId }
    });

    // Log the deletion
    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: 'DELETE_POST',
        entity: 'Post',
        entityId: postId,
        payload: JSON.stringify({
          content: post.content?.substring(0, 100),
          deletedBy: user.role === 'ADMIN' ? 'admin' : 'author'
        })
      }
    });

    return NextResponse.json({ success: true });
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
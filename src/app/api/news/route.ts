import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser, requireAdmin, requireAdminForDelete } from '@/lib/auth';
import { uploadToCloudinary } from '@/lib/cloudUpload';
import { validateImageFile } from '@/lib/uploadUtils';

export async function GET(request: NextRequest) {
  try {
    const news = await prisma.news.findMany({
      include: {
        reactions: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true
              }
            }
          }
        },
        _count: {
          select: {
            reactions: true
          }
        }
      },
      orderBy: [
        { isPinned: 'desc' },
        { createdAt: 'desc' }
      ]
    });

    // Get current user to check reactions (optional for news viewing)
    const currentUser = await getCurrentUser(request);

    // Get creator information for each news item
    const newsWithCreators = await Promise.all(
      news.map(async (item: any) => {
        const creator = await prisma.user.findUnique({
          where: { id: item.createdBy },
          select: {
            firstName: true,
            lastName: true,
            email: true
          }
        });

        // Find user's reaction for this news item
        const userReaction = currentUser
          ? item.reactions.find((r: any) => r.userId === currentUser.id)
          : null;

        return {
          ...item,
          mediaUrls: item.mediaUrls ? JSON.parse(item.mediaUrls) : [],
          creator,
          userReaction: userReaction || null
        };
      })
    );

    return NextResponse.json(newsWithCreators);
  } catch (error) {
    console.error('Failed to fetch news:', error);
    return NextResponse.json(
      { error: 'Failed to fetch news' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);

    const formData = await request.formData();
    const title = formData.get('title') as string;
    const body = formData.get('body') as string;
    const isPinned = formData.get('isPinned') === 'true';
    const images = formData.getAll('images') as File[];

    if (!title?.trim() || !body?.trim()) {
      return NextResponse.json(
        { error: 'Title and body are required' },
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
      const uploadResult = await uploadToCloudinary(image, 'news');
      if (uploadResult.success && uploadResult.url) {
        mediaUrls.push(uploadResult.url);
      } else {
        uploadErrors.push(uploadResult.error || 'Failed to save file');
      }
    }

    const newsItem = await prisma.news.create({
      data: {
        title: title.trim(),
        body: body.trim(),
        mediaUrls: mediaUrls.length > 0 ? JSON.stringify(mediaUrls) : null,
        isPinned: isPinned || false,
        createdBy: admin.id
      } as any
    });

    // Log the news creation
    await prisma.auditLog.create({
      data: {
        actorId: admin.id,
        action: 'CREATE_NEWS',
        entity: 'News',
        entityId: newsItem.id,
        payload: JSON.stringify({
          title,
          isPinned: isPinned || false,
          mediaCount: mediaUrls.length,
          uploadErrors: uploadErrors.length > 0 ? uploadErrors : undefined
        })
      }
    });

    return NextResponse.json({
      success: true,
      newsId: newsItem.id,
      mediaCount: mediaUrls.length,
      uploadErrors: uploadErrors.length > 0 ? uploadErrors : undefined
    });
  } catch (error) {
    console.error('Failed to create news:', error);
    
    if (error instanceof Error && error.message === 'Authentication required') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    
    if (error instanceof Error && error.message === 'Admin access required') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }
    
    return NextResponse.json(
      { error: 'Failed to create news' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const admin = await requireAdminForDelete(request);
    
    const { searchParams } = new URL(request.url);
    const newsId = searchParams.get('id');

    if (!newsId) {
      return NextResponse.json(
        { error: 'News ID is required' },
        { status: 400 }
      );
    }

    // Check if news exists
    const existingNews = await prisma.news.findUnique({
      where: { id: newsId }
    });

    if (!existingNews) {
      return NextResponse.json(
        { error: 'News not found' },
        { status: 404 }
      );
    }

    // Delete the news item
    await prisma.news.delete({
      where: { id: newsId }
    });

    // Log the news deletion
    await prisma.auditLog.create({
      data: {
        actorId: admin.id,
        action: 'DELETE_NEWS',
        entity: 'News',
        entityId: newsId,
        payload: JSON.stringify({
          title: existingNews.title,
          deletedAt: new Date().toISOString()
        })
      }
    });

    return NextResponse.json({
      success: true,
      message: 'News deleted successfully'
    });
  } catch (error) {
    console.error('Failed to delete news:', error);
    
    if (error instanceof Error && error.message === 'Authentication required') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    
    if (error instanceof Error && error.message === 'Admin access required') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }
    
    return NextResponse.json(
      { error: 'Failed to delete news' },
      { status: 500 }
    );
  }
}
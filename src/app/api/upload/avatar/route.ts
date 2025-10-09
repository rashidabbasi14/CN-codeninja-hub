import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { uploadToCloudinary, deleteFromCloudinary } from '@/lib/cloudUpload';
import { extractPublicIdFromUrl } from '@/lib/uploadUtils';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    // Check if user is authenticated (optional for registration flow)
    const user = await getCurrentUser(request);
    
    const formData = await request.formData();
    const file = formData.get('avatar') as File;
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Upload the file to Cloudinary
    const uploadResult = await uploadToCloudinary(file, 'avatars');
    
    if (!uploadResult.success) {
      return NextResponse.json(
        { error: uploadResult.error || 'Failed to upload file' },
        { status: 400 }
      );
    }

    // If user is authenticated, update their avatar in the database
    if (user) {
      // Delete old avatar from Cloudinary if it exists
      if (user.avatarUrl) {
        const oldPublicId = extractPublicIdFromUrl(user.avatarUrl);
        if (oldPublicId) {
          await deleteFromCloudinary(oldPublicId);
        }
      }

      // Update user's avatar URL in database
      const updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: { avatarUrl: uploadResult.url },
        include: {
          department: {
            select: {
              id: true,
              name: true
            }
          }
        }
      });

      // Create audit log entry
      await prisma.auditLog.create({
        data: {
          actorId: user.id,
          action: 'UPDATE_AVATAR',
          entity: 'User',
          entityId: user.id,
          payload: JSON.stringify({
            oldAvatarUrl: user.avatarUrl,
            newAvatarUrl: uploadResult.url,
            fileName: file.name,
            fileSize: file.size
          })
        }
      });

      // Return updated user data
      const userData = {
        id: updatedUser.id,
        email: updatedUser.email,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        gender: updatedUser.gender,
        age: updatedUser.age,
        departmentId: updatedUser.departmentId,
        department: updatedUser.department,
        avatarUrl: updatedUser.avatarUrl,
        privacyHideAge: updatedUser.privacyHideAge,
        privacyHideGender: updatedUser.privacyHideGender,
        createdAt: updatedUser.createdAt,
        updatedAt: updatedUser.updatedAt
      };

      return NextResponse.json({
        success: true,
        message: 'Avatar uploaded successfully',
        avatarUrl: uploadResult.url,
        user: userData
      });
    } else {
      // For unauthenticated users (during registration), just return the uploaded file URL
      return NextResponse.json({
        success: true,
        message: 'Avatar uploaded successfully',
        avatarUrl: uploadResult.url
      });
    }
  } catch (error) {
    console.error('Avatar upload error:', error);
    
    return NextResponse.json(
      { error: 'Failed to upload avatar' },
      { status: 500 }
    );
  }
}
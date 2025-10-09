import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

// GET - Fetch current user profile
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    // Fetch user with department information
    const userProfile = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        department: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    if (!userProfile) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Return user profile data (excluding sensitive fields)
    const profileData = {
      id: userProfile.id,
      email: userProfile.email,
      firstName: userProfile.firstName,
      lastName: userProfile.lastName,
      role: userProfile.role,
      gender: userProfile.gender,
      age: userProfile.age,
      phone: userProfile.phone,
      departmentId: userProfile.departmentId,
      department: userProfile.department,
      avatarUrl: userProfile.avatarUrl,
      privacyHideAge: userProfile.privacyHideAge,
      privacyHideGender: userProfile.privacyHideGender,
      createdAt: userProfile.createdAt,
      updatedAt: userProfile.updatedAt
    };

    return NextResponse.json(profileData);
  } catch (error) {
    console.error('Failed to fetch user profile:', error);
    
    if (error instanceof Error && error.message === 'Authentication required') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch profile' },
      { status: 500 }
    );
  }
}

// PATCH - Update user profile
export async function PATCH(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();

    // Validate input data
    const allowedFields = [
      'firstName',
      'lastName',
      'gender',
      'age',
      'phone',
      'departmentId',
      'avatarUrl',
      'privacyHideAge',
      'privacyHideGender'
    ];

    const updateData: any = {};
    const changedFields: string[] = [];

    // Only include allowed fields that are provided
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
        changedFields.push(field);
      }
    }

    // Validate gender (required)
    if (!updateData.gender || !['MALE', 'FEMALE'].includes(updateData.gender)) {
      return NextResponse.json(
        { error: 'Gender is required and must be either MALE or FEMALE' },
        { status: 400 }
      );
    }

    // Validate age if provided
    if (updateData.age !== undefined) {
      if (updateData.age !== null && (typeof updateData.age !== 'number' || updateData.age < 0 || updateData.age > 150)) {
        return NextResponse.json(
          { error: 'Age must be a number between 0 and 150, or null' },
          { status: 400 }
        );
      }
    }

    // Validate department if provided
    if (updateData.departmentId) {
      const department = await prisma.department.findUnique({
        where: { id: updateData.departmentId }
      });
      
      if (!department) {
        return NextResponse.json(
          { error: 'Invalid department' },
          { status: 400 }
        );
      }
    }

    // Update user profile
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: updateData,
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
        action: 'UPDATE_PROFILE',
        entity: 'User',
        entityId: user.id,
        payload: JSON.stringify({
          updatedFields: changedFields,
          changes: updateData
        })
      }
    });

    // Return updated profile data
    const profileData = {
      id: updatedUser.id,
      email: updatedUser.email,
      firstName: updatedUser.firstName,
      lastName: updatedUser.lastName,
      role: updatedUser.role,
      gender: updatedUser.gender,
      age: updatedUser.age,
      phone: updatedUser.phone,
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
      message: 'Profile updated successfully',
      user: profileData
    });
  } catch (error) {
    console.error('Failed to update user profile:', error);
    
    if (error instanceof Error && error.message === 'Authentication required') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    
    return NextResponse.json(
      { error: 'Failed to update profile' },
      { status: 500 }
    );
  }
}
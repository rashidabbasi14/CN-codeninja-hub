import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin, requireAdminOrModerator } from '@/lib/auth';
import { z } from 'zod';
import bcrypt from 'bcryptjs';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    await requireAdminOrModerator(request);

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const department = searchParams.get('department') || '';
    const role = searchParams.get('role') || '';
    const blocked = searchParams.get('blocked');

    const where: any = {};

    // Search filter
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
      ];
    }

    // Department filter
    if (department && department !== 'all') {
      where.department = {
        name: department
      };
    }

    // Role filter
    if (role && role !== 'all') {
      where.role = role;
    }

    // Blocked filter
    if (blocked !== null) {
      where.isBlocked = blocked === 'true';
    }

    const users = await prisma.user.findMany({
      where,
      include: {
        department: {
          select: {
            name: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Transform the data to match the frontend interface
    const transformedUsers = users.map((user: any) => ({
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      jobTitle: user.jobTitle,
      department: user.department?.name || 'No Department',
      role: user.role,
      isBlocked: user.isBlocked,
      isEmailVerified: user.isEmailVerified,
      createdAt: user.createdAt
    }));

    return NextResponse.json(transformedUsers);
  } catch (error) {
    console.error('Failed to fetch users:', error);
    
    if (error instanceof Error && error.message === 'Authentication required') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    
    if (error instanceof Error && error.message === 'Admin access required') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}

// Schema for creating users by admin
const createUserSchema = z.object({
  email: z.string().email('Invalid email format'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  phone: z.string().optional(),
  gender: z.enum(['MALE', 'FEMALE']).default('MALE'),
  department: z.string().min(1, 'Department is required'),
  password: z.string().optional(),
  role: z.enum(['USER', 'MODERATOR', 'ADMIN']).default('USER'),
  isEmailVerified: z.boolean().default(false),
});

export async function POST(request: NextRequest) {
  try {
    const currentUser = await requireAdmin(request);

    const body = await request.json();
    const validatedData = createUserSchema.parse(body);

    // Capitalize first and last names
    const firstName = validatedData.firstName.charAt(0).toUpperCase() + validatedData.firstName.slice(1).toLowerCase();
    const lastName = validatedData.lastName.charAt(0).toUpperCase() + validatedData.lastName.slice(1).toLowerCase();

    // Normalize email to lowercase to prevent case-sensitive duplicates
    const normalizedEmail = validatedData.email.toLowerCase();

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail }
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 409 }
      );
    }

    // Check if department exists, create if it doesn't
    let department = await prisma.department.findUnique({
      where: { name: validatedData.department }
    });

    if (!department) {
      department = await prisma.department.create({
        data: {
          name: validatedData.department,
          createdBy: currentUser.id
        }
      });
    }

    // Hash password if provided, otherwise leave blank
    let hashedPassword = '';
    if (validatedData.password && validatedData.password.trim()) {
      hashedPassword = await bcrypt.hash(validatedData.password, 12);
    }

    // Create user
    const user = await prisma.user.create({
      data: {
        firstName,
        lastName,
        email: normalizedEmail,
        password: hashedPassword,
        gender: validatedData.gender,
        phone: validatedData.phone,
        departmentId: department.id,
        role: validatedData.role,
        isEmailVerified: validatedData.isEmailVerified
      },
      include: {
        department: {
          select: {
            name: true
          }
        }
      }
    });

    // Log the user creation
    await prisma.auditLog.create({
      data: {
        actorId: currentUser.id,
        action: 'user.created',
        entity: 'user',
        entityId: user.id,
        payload: JSON.stringify({
          email: user.email,
          role: user.role,
          department: department.name,
          createdBy: currentUser.email
        })
      }
    });

    // Transform the response to match frontend interface
    const responseUser = {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      jobTitle: user.jobTitle,
      department: user.department?.name || 'No Department',
      role: user.role,
      isBlocked: user.isBlocked,
      isEmailVerified: user.isEmailVerified,
      createdAt: user.createdAt
    };

    return NextResponse.json({
      success: true,
      user: responseUser
    });

  } catch (error) {
    console.error('Failed to create user:', error);
    
    if (error instanceof Error && error.message === 'Authentication required') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    
    if (error instanceof Error && error.message === 'Admin access required') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    );
  }
}

// Schema for updating users by admin
const updateUserSchema = z.object({
  email: z.string().email('Invalid email format').optional(),
  firstName: z.string().min(1, 'First name is required').optional(),
  lastName: z.string().min(1, 'Last name is required').optional(),
  phone: z.string().optional(),
  gender: z.enum(['MALE', 'FEMALE']).optional(),
  department: z.string().min(1, 'Department is required').optional(),
  password: z.string().optional(),
  role: z.enum(['USER', 'MODERATOR', 'ADMIN']).optional(),
  isEmailVerified: z.boolean().optional(),
});

export async function PUT(request: NextRequest) {
  try {
    const currentUser = await requireAdmin(request);

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('id');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validatedData = updateUserSchema.parse(body);

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        department: {
          select: {
            name: true
          }
        }
      }
    });

    if (!existingUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Check if email is being changed and if it already exists
    if (validatedData.email && validatedData.email.toLowerCase() !== existingUser.email) {
      const normalizedEmail = validatedData.email.toLowerCase();
      const emailExists = await prisma.user.findUnique({
        where: { email: normalizedEmail }
      });

      if (emailExists) {
        return NextResponse.json(
          { error: 'User with this email already exists' },
          { status: 409 }
        );
      }
    }

    // Prepare update data
    const updateData: any = {};

    if (validatedData.firstName) {
      updateData.firstName = validatedData.firstName.charAt(0).toUpperCase() + validatedData.firstName.slice(1).toLowerCase();
    }

    if (validatedData.lastName) {
      updateData.lastName = validatedData.lastName.charAt(0).toUpperCase() + validatedData.lastName.slice(1).toLowerCase();
    }

    if (validatedData.email) {
      updateData.email = validatedData.email.toLowerCase();
    }

    if (validatedData.phone !== undefined) {
      updateData.phone = validatedData.phone;
    }

    if (validatedData.gender) {
      updateData.gender = validatedData.gender;
    }

    if (validatedData.role) {
      updateData.role = validatedData.role;
    }

    if (validatedData.isEmailVerified !== undefined) {
      updateData.isEmailVerified = validatedData.isEmailVerified;
    }

    // Handle department update
    if (validatedData.department) {
      let department = await prisma.department.findUnique({
        where: { name: validatedData.department }
      });

      if (!department) {
        department = await prisma.department.create({
          data: {
            name: validatedData.department,
            createdBy: currentUser.id
          }
        });
      }

      updateData.departmentId = department.id;
    }

    // Handle password update
    if (validatedData.password && validatedData.password.trim()) {
      updateData.password = await bcrypt.hash(validatedData.password, 12);
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      include: {
        department: {
          select: {
            name: true
          }
        }
      }
    });

    // Log the user update
    await prisma.auditLog.create({
      data: {
        actorId: currentUser.id,
        action: 'user.updated',
        entity: 'user',
        entityId: updatedUser.id,
        payload: JSON.stringify({
          email: updatedUser.email,
          role: updatedUser.role,
          department: updatedUser.department?.name,
          updatedBy: currentUser.email,
          changes: validatedData
        })
      }
    });

    // Transform the response to match frontend interface
    const responseUser = {
      id: updatedUser.id,
      firstName: updatedUser.firstName,
      lastName: updatedUser.lastName,
      email: updatedUser.email,
      phone: updatedUser.phone,
      jobTitle: updatedUser.jobTitle,
      department: updatedUser.department?.name || 'No Department',
      role: updatedUser.role,
      isBlocked: updatedUser.isBlocked,
      isEmailVerified: updatedUser.isEmailVerified,
      createdAt: updatedUser.createdAt
    };

    return NextResponse.json({
      success: true,
      user: responseUser
    });

  } catch (error) {
    console.error('Failed to update user:', error);
    
    if (error instanceof Error && error.message === 'Authentication required') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    
    if (error instanceof Error && error.message === 'Admin access required') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to update user' },
      { status: 500 }
    );
  }
}

// DELETE method for bulk user deletion (admin only)
export async function DELETE(request: NextRequest) {
  try {
    const currentUser = await requireAdmin(request);
    
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    
    if (action !== 'delete-all') {
      return NextResponse.json(
        { error: 'Invalid action. Use action=delete-all for bulk deletion.' },
        { status: 400 }
      );
    }

    // Get confirmation from request body
    const body = await request.json().catch(() => ({}));
    if (!body.confirmed) {
      return NextResponse.json(
        { error: 'Confirmation required. Send { "confirmed": true } in request body.' },
        { status: 400 }
      );
    }

    // Start a transaction to delete all user-related data
    const result = await prisma.$transaction(async (tx) => {
      // Get all users except the current admin performing the action
      const usersToDelete = await tx.user.findMany({
        where: {
          NOT: {
            id: currentUser.id
          }
        },
        select: { id: true, email: true, role: true }
      });

      if (usersToDelete.length === 0) {
        return { deletedCount: 0, message: 'No users to delete' };
      }

      const userIds = usersToDelete.map(u => u.id);

      // Delete user-related data in the correct order to respect foreign key constraints
      
      // 1. Delete team memberships
      await tx.teamMember.deleteMany({
        where: { userId: { in: userIds } }
      });

      // 2. Delete registrations
      await tx.registration.deleteMany({
        where: { userId: { in: userIds } }
      });

      // 3. Delete reactions
      await tx.reaction.deleteMany({
        where: { userId: { in: userIds } }
      });

      // 4. Delete news reactions
      await tx.newsReaction.deleteMany({
        where: { userId: { in: userIds } }
      });

      // 5. Delete comments (will cascade delete from posts)
      await tx.comment.deleteMany({
        where: { authorId: { in: userIds } }
      });

      // 6. Delete posts
      await tx.post.deleteMany({
        where: { authorId: { in: userIds } }
      });

      // 7. Delete email logs
      await tx.emailLog.deleteMany({
        where: { sentBy: { in: userIds } }
      });

      // 8. Delete audit logs
      await tx.auditLog.deleteMany({
        where: { actorId: { in: userIds } }
      });

      // 9. Update teams where user is team leader (reassign to current admin)
      await tx.team.updateMany({
        where: { teamLead: { in: userIds } },
        data: { teamLead: currentUser.id }
      });

      // 10. Update games created by users (reassign to current admin)
      await tx.game.updateMany({
        where: { createdBy: { in: userIds } },
        data: { createdBy: currentUser.id }
      });

      // 11. Update departments created by users (reassign to current admin)
      await tx.department.updateMany({
        where: { createdBy: { in: userIds } },
        data: { createdBy: currentUser.id }
      });

      // 12. Finally, delete the users
      await tx.user.deleteMany({
        where: { id: { in: userIds } }
      });

      return {
        deletedCount: usersToDelete.length,
        deletedUsers: usersToDelete.map(u => ({ id: u.id, email: u.email, role: u.role }))
      };
    });

    // Log the bulk deletion action
    await prisma.auditLog.create({
      data: {
        actorId: currentUser.id,
        action: 'BULK_DELETE_USERS',
        entity: 'User',
        entityId: 'BULK_OPERATION',
        payload: JSON.stringify({
          deletedCount: result.deletedCount,
          performedBy: currentUser.email,
          timestamp: new Date().toISOString()
        })
      }
    });

    return NextResponse.json({
      success: true,
      message: `Successfully deleted ${result.deletedCount} users and all their related data`,
      deletedCount: result.deletedCount
    });

  } catch (error) {
    console.error('Failed to delete all users:', error);
    
    if (error instanceof Error && error.message === 'Authentication required') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    
    if (error instanceof Error && error.message === 'Admin access required') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }
    
    return NextResponse.json(
      { error: 'Failed to delete users. Please try again.' },
      { status: 500 }
    );
  }
}
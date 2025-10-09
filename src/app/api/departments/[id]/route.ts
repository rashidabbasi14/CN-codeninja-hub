import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin, requireAdminForDelete } from '@/lib/auth';

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdmin(request as any);
    const { name } = await request.json();

    if (!name || typeof name !== 'string') {
      return NextResponse.json(
        { error: 'Department name is required' },
        { status: 400 }
      );
    }

    // Check if another department with this name exists
    const existingDepartment = await prisma.department.findFirst({
      where: { 
        name,
        NOT: { id: params.id }
      }
    });

    if (existingDepartment) {
      return NextResponse.json(
        { error: 'Department name already exists' },
        { status: 409 }
      );
    }

    const department = await prisma.department.update({
      where: { id: params.id },
      data: { name },
      select: {
        id: true,
        name: true,
        createdBy: true,
        createdAt: true,
        _count: {
          select: {
            users: true
          }
        }
      }
    });

    return NextResponse.json(department);
  } catch (error) {
    console.error('Error updating department:', error);
    return NextResponse.json(
      { error: 'Failed to update department' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdminForDelete(request as any);

    // Check if department has users
    const departmentWithUsers = await prisma.department.findUnique({
      where: { id: params.id },
      include: {
        _count: {
          select: {
            users: true
          }
        }
      }
    });

    if (!departmentWithUsers) {
      return NextResponse.json(
        { error: 'Department not found' },
        { status: 404 }
      );
    }

    if (departmentWithUsers._count.users > 0) {
      return NextResponse.json(
        { error: 'Cannot delete department with existing users' },
        { status: 400 }
      );
    }

    await prisma.department.delete({
      where: { id: params.id }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting department:', error);
    return NextResponse.json(
      { error: 'Failed to delete department' },
      { status: 500 }
    );
  }
}
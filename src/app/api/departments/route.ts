import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    // Check if this is an admin request (includes more detailed data)
    const url = new URL(request.url);
    const includeDetails = url.searchParams.get('includeDetails') === 'true';

    if (includeDetails) {
      // Admin view - include user counts and additional fields
      const departments = await prisma.department.findMany({
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
        },
        orderBy: {
          name: 'asc'
        }
      });

      return NextResponse.json(departments);
    } else {
      // Simple view - just id and name for dropdowns
      const departments = await prisma.department.findMany({
        select: {
          id: true,
          name: true
        },
        orderBy: {
          name: 'asc'
        }
      });

      return NextResponse.json(departments);
    }

  } catch (error) {
    console.error('Error fetching departments:', error);
    return NextResponse.json(
      { error: 'Failed to fetch departments' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { name } = await request.json();

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Department name is required' },
        { status: 400 }
      );
    }

    // Get user ID from session/auth - for now, get the first admin user
    // In a real app, you'd get this from the authenticated session
    const adminUser = await prisma.user.findFirst({
      where: {
        role: 'ADMIN'
      },
      select: {
        id: true
      }
    });

    if (!adminUser) {
      return NextResponse.json(
        { error: 'No admin user found to create department' },
        { status: 500 }
      );
    }

    // Check if department already exists
    const existingDepartment = await prisma.department.findFirst({
      where: {
        name: {
          equals: name.trim(),
          mode: 'insensitive'
        }
      }
    });

    if (existingDepartment) {
      return NextResponse.json(
        { error: 'Department already exists' },
        { status: 409 }
      );
    }

    const department = await prisma.department.create({
      data: {
        name: name.trim(),
        createdBy: adminUser.id
      },
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

    return NextResponse.json(department, { status: 201 });

  } catch (error) {
    console.error('Error creating department:', error);
    return NextResponse.json(
      { error: 'Failed to create department' },
      { status: 500 }
    );
  }
}
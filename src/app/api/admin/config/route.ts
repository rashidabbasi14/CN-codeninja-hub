import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { getAllConfigs, getConfigByCategory, setConfig, deleteConfig, initializeDefaultConfigs } from '@/lib/config';

export async function GET(request: NextRequest) {
  try {
    // Check authentication and admin role
    await requireAdmin(request);

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');

    let configs;
    if (category) {
      configs = await getConfigByCategory(category);
    } else {
      configs = await getAllConfigs();
    }

    return NextResponse.json({
      success: true,
      configs
    });

  } catch (error) {
    console.error('Error fetching configs:', error);
    
    if (error instanceof Error && error.message === 'Authentication required') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    
    if (error instanceof Error && error.message === 'Admin access required') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch configurations' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check authentication and admin role
    await requireAdmin(request);

    const body = await request.json();
    const { key, value, description, category = 'GENERAL' } = body;

    if (!key || value === undefined) {
      return NextResponse.json(
        { error: 'Key and value are required' },
        { status: 400 }
      );
    }

    await setConfig(key, value, description, category);

    return NextResponse.json({
      success: true,
      message: 'Configuration updated successfully'
    });

  } catch (error) {
    console.error('Error updating config:', error);
    
    if (error instanceof Error && error.message === 'Authentication required') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    
    if (error instanceof Error && error.message === 'Admin access required') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }
    
    return NextResponse.json(
      { error: 'Failed to update configuration' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Check authentication and admin role
    await requireAdmin(request);

    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');

    if (!key) {
      return NextResponse.json(
        { error: 'Key is required' },
        { status: 400 }
      );
    }

    await deleteConfig(key);

    return NextResponse.json({
      success: true,
      message: 'Configuration deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting config:', error);
    
    if (error instanceof Error && error.message === 'Authentication required') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    
    if (error instanceof Error && error.message === 'Admin access required') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }
    
    return NextResponse.json(
      { error: 'Failed to delete configuration' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    // Check authentication and admin role
    await requireAdmin(request);

    const body = await request.json();
    const { action } = body;

    if (action === 'initialize_defaults') {
      await initializeDefaultConfigs();
      return NextResponse.json({
        success: true,
        message: 'Default configurations initialized successfully'
      });
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );

  } catch (error) {
    console.error('Error processing config action:', error);
    
    if (error instanceof Error && error.message === 'Authentication required') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    
    if (error instanceof Error && error.message === 'Admin access required') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }
    
    return NextResponse.json(
      { error: 'Failed to process configuration action' },
      { status: 500 }
    );
  }
}
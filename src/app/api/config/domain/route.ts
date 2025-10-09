import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const allowedDomain = process.env.ALLOWED_EMAIL_DOMAIN || 'codeninjaconsulting.com';
    
    return NextResponse.json({
      success: true,
      domain: allowedDomain
    });
  } catch (error) {
    console.error('Error fetching domain config:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch domain configuration',
        domain: 'codeninjaconsulting.com' // fallback
      },
      { status: 500 }
    );
  }
}
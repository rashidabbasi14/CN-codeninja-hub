import { NextResponse } from 'next/server';
import '@/lib/init'; // This will trigger initialization when the server starts

export async function GET() {
  return NextResponse.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString() 
  });
}

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const gameId = params.id;
    const { searchParams } = new URL(request.url);
    const teamName = searchParams.get('teamName');

    if (!teamName) {
      return NextResponse.json({ error: 'Team name is required' }, { status: 400 });
    }

    // Check if a team with this name already exists for this game
    // Exclude the current user's own team to avoid false duplicates during updates
    const existingTeam = await prisma.team.findFirst({
      where: {
        gameId: gameId,
        name: {
          equals: teamName.trim(),
          mode: 'insensitive' // Case-insensitive comparison
        },
        // Exclude teams where the current user is the team lead
        NOT: {
          teamLead: user.id
        }
      }
    });

    return NextResponse.json({
      exists: !!existingTeam
    });

  } catch (error) {
    console.error('Error checking team name:', error);
    return NextResponse.json(
      { error: 'Failed to check team name' },
      { status: 500 }
    );
  }
}
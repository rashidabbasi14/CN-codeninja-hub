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

    // Get the game to check if it's a team-based game
    const game = await prisma.game.findUnique({
      where: { id: gameId },
      select: { typeFormat: true }
    });

    if (!game) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    // Only return open teams for team-based games
    if (game.typeFormat === '1v1' || game.typeFormat === 'Individual') {
      return NextResponse.json({ openTeams: [] });
    }

    // Get required team size from game format (e.g., "2v2" -> 2, "3v3" -> 3)
    const requiredTeamSize = parseInt(game.typeFormat.split('v')[0]);

    // Find teams that are either marked as open OR are not at full capacity
    const openTeams = await prisma.team.findMany({
      where: {
        gameId: gameId
      },
      include: {
        leader: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatarUrl: true
          }
        },
        members: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                avatarUrl: true
              }
            }
          }
        }
      }
    });

    // Filter teams that are either marked as open OR not at full capacity, and don't already include the current user
    const availableOpenTeams = openTeams.filter(team => {
      const currentMemberCount = team.members.length;
      const isUserAlreadyMember = team.members.some(member => member.user.id === user.id);
      const isTeamAvailable = team.openTeam || (currentMemberCount < requiredTeamSize);
      
      return isTeamAvailable && currentMemberCount < requiredTeamSize && !isUserAlreadyMember;
    });

    // Format the response
    const formattedTeams = availableOpenTeams.map(team => ({
      id: team.id,
      name: team.name,
      leader: team.leader,
      members: team.members.map(member => member.user),
      currentSize: team.members.length,
      requiredSize: requiredTeamSize,
      spotsAvailable: requiredTeamSize - team.members.length
    }));

    const response = NextResponse.json({ openTeams: formattedTeams });
    
    // Add cache-busting headers to ensure fresh data
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    
    return response;

  } catch (error) {
    console.error('Error fetching open teams:', error);
    return NextResponse.json(
      { error: 'Failed to fetch open teams' },
      { status: 500 }
    );
  }
}
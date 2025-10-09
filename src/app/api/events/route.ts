import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { auditLogger, createAuditContext } from '@/lib/audit';

export async function GET(request: NextRequest) {
  try {
    // Get current user for audit logging (optional for events viewing)
    const user = await getCurrentUser(request);
    
    // Filter by active status using Prisma query
    const events = await prisma.category.findMany({
      where: {
        status: 'ACTIVE'
      },
      include: {
        games: {
          select: {
            id: true,
            name: true,
            description: true,
            typeFormat: true,
            levels: true,
            weightage: true,
            avgGameTime: true,
            contestType: true,
            allowDraws: true,
            registrations: {
              select: {
                id: true,
                mode: true,
                user: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true
                  }
                },
                team: {
                  select: {
                    id: true,
                    name: true,
                    members: {
                      select: {
                        user: {
                          select: {
                            id: true,
                            firstName: true,
                            lastName: true
                          }
                        }
                      }
                    }
                  }
                }
              }
            },
            matches: {
              select: {
                id: true,
                winnerId: true,
                participantAId: true,
                participantAType: true,
                participantBId: true,
                participantBType: true,
                slot: {
                  select: {
                    id: true,
                    startTime: true,
                    endTime: true,
                    published: true
                  }
                }
              }
            },
            teams: {
              select: {
                id: true,
                name: true,
                openTeam: true,
                members: {
                  select: {
                    id: true
                  }
                }
              }
            },
            slots: {
              select: {
                id: true,
                capacity: true,
                published: true,
                startTime: true,
                endTime: true
              }
            }
          }
        }
      },
      orderBy: {
        startDate: 'asc'
      }
    });

    // Helper function to convert 24-hour time to 12-hour format
    const formatTo12Hour = (time24: string): string => {
      if (!time24 || time24 === 'TBD') return time24;
      
      const [hours, minutes] = time24.split(':');
      const hour = parseInt(hours, 10);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const hour12 = hour % 12 || 12;
      
      return `${hour12}:${minutes} ${ampm}`;
    };

    // Transform the data to match the frontend structure
    const transformedEvents = events.map(event => {
      let timeWindow = 'TBD';
      try {
        const windows = JSON.parse(event.dailyWindows || '[]');
        if (Array.isArray(windows) && windows.length > 0) {
          const timeWindows = windows.map(window => {
            if (typeof window === 'object' && window.start && window.end) {
              const startTime12 = formatTo12Hour(window.start);
              const endTime12 = formatTo12Hour(window.end);
              return `${startTime12} - ${endTime12}`;
            } else if (typeof window === 'string') {
              return window;
            }
            return 'TBD';
          }).filter(w => w !== 'TBD');
          
          timeWindow = timeWindows.length > 0 ? timeWindows.join(', ') : 'TBD';
        }
      } catch (e) {
        timeWindow = 'TBD';
      }

      return {
        id: event.id,
        name: event.name,
        description: `Join us for ${event.name} featuring ${event.games.length} exciting games!`,
        startDate: event.startDate.toISOString().split('T')[0],
        endDate: event.endDate.toISOString().split('T')[0],
        timeWindow,
        location: event.locationName,
        locationUrl: event.locationMapsLink,
        participantCap: event.perPersonCap || 2,
        registrationDeadline: event.registrationDeadline ? event.registrationDeadline.toISOString() : null,
        games: event.games.map((game: any) => {
          let levels = ['All Levels'];
          try {
            const parsedLevels = JSON.parse(game.levels || '["All Levels"]');
            levels = Array.isArray(parsedLevels) ? parsedLevels : ['All Levels'];
          } catch (e) {
            levels = ['All Levels'];
          }

          // Calculate required team size from typeFormat (e.g., "2v2" -> 2, "3v3" -> 3)
          const requiredTeamSize = parseInt(game.typeFormat.split('v')[0]) || 1;

          // Add calculated fields to teams
          const teamsWithCalculatedFields = game.teams.map((team: any) => ({
            ...team,
            currentSize: team.members.length,
            requiredSize: requiredTeamSize
          }));

          return {
            id: game.id,
            name: game.name,
            description: game.description,
            format: game.typeFormat,
            level: levels,
            weightage: game.weightage,
            avgGameTime: game.avgGameTime,
            contestType: game.contestType,
            allowDraws: game.allowDraws,
            registrations: game.registrations,
            matches: game.matches,
            teams: teamsWithCalculatedFields,
            slots: game.slots
          };
        })
      };
    });

    // Log the events viewing activity if user is authenticated
    if (user) {
      try {
        await auditLogger.log(
          user.id,
          'events.viewed',
          'event',
          'events_page',
          {
            eventsCount: transformedEvents.length,
            eventNames: transformedEvents.map(e => e.name),
            timestamp: new Date().toISOString()
          },
          createAuditContext(request)
        );
      } catch (auditError) {
        // Don't fail the request if audit logging fails
        console.error('Failed to log events viewing:', auditError);
      }
    }

    const response = NextResponse.json(transformedEvents);
    
    // Add cache-busting headers to ensure fresh data
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    
    return response;
  } catch (error) {
    console.error('Error fetching events:', error);
    return NextResponse.json(
      { error: 'Failed to fetch events' },
      { status: 500 }
    );
  }
}
import { getEmailLayout, EmailTemplateProps } from './html-templates';

/**
 * Match Scheduled Email Template
 */
export interface MatchScheduledProps extends EmailTemplateProps {
  gameName: string;
  categoryName: string;
  matchTime: string;
  matchDate: string;
  venueName?: string;
  courtName?: string;
  opponentName?: string; // For backward compatibility with 2-participant matches
  opponentType?: 'individual' | 'team'; // For backward compatibility
  opponents?: Array<{ name: string; type: 'individual' | 'team' }>; // For multi-participant matches
  participantName: string;
  participantType: 'individual' | 'team';
  timelineName?: string;
  contestType: string;
  eventId?: string;
  baseUrl?: string;
}

export function generateMatchScheduledEmail(props: MatchScheduledProps): string {
  const {
    firstName = 'Player',
    gameName,
    categoryName,
    matchTime,
    matchDate,
    venueName,
    courtName,
    opponentName,
    opponentType,
    opponents,
    participantName,
    participantType,
    timelineName,
    contestType,
    eventId,
    baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
  } = props;
  
  const contestTypeLabels: { [key: string]: string } = {
    'SINGLE_ELIMINATION': 'Single Elimination',
    'DOUBLE_ELIMINATION': 'Double Elimination',
    'ROUND_ROBIN': 'Round Robin',
    'ROUND_ROBIN_HOME_AWAY': 'Round Robin (Home/Away)',
    'GROUP_STAGE_KNOCKOUT': 'Group Stage → Knockout',
    'SWISS_SYSTEM': 'Swiss System',
    'LADDER': 'Ladder',
    'TIME_BOXED_LEAGUE': 'Time-boxed League',
    'FRIENDLY': 'Friendly',
    'SCORING': 'Scoring Contest'
  };

  const contestLabel = contestTypeLabels[contestType] || contestType;
  
  // Determine if this is a multi-participant match (1v1v1v1)
  const isMultiParticipant = opponents && opponents.length > 1;
  const allOpponents = isMultiParticipant ? opponents : (opponentName ? [{ name: opponentName, type: opponentType || 'individual' }] : []);
  
  const content = `
    <div class="success" style="text-align: center; padding: 20px; border-radius: 12px; margin-bottom: 24px;">
      <h1 style="color: #047857; font-size: 28px; font-weight: 700; margin: 0; line-height: 1.2; letter-spacing: -0.5px;">
        🎯 Match Scheduled!
      </h1>
      <p style="color: #047857; font-size: 16px; margin: 8px 0 0 0;">
        Your game is ready for action
      </p>
    </div>
    
    <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">
      Hi ${firstName}!
    </p>
    
    <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
      Great news! The Game Coordinator has scheduled your match. Here are the details:
    </p>
    
    <div class="highlight" style="margin-bottom: 24px;">
      <h2 style="color: #0f172a; font-size: 22px; font-weight: 700; margin: 0 0 20px 0; line-height: 1.3; text-align: center; letter-spacing: -0.3px;">
        🏆 ${gameName}
      </h2>
      
      <div style="display: grid; gap: 16px;">
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #e2e8f0;">
          <span style="font-weight: 600; color: #334155;">Category:</span>
          <span style="color: #64748b;">${categoryName}</span>
        </div>
        
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #e2e8f0;">
          <span style="font-weight: 600; color: #334155;">Contest Type:</span>
          <span style="color: #64748b;">${contestLabel}</span>
        </div>
        
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #e2e8f0;">
          <span style="font-weight: 600; color: #334155;">Match Date:</span>
          <span style="color: #475569; font-weight: 500;">${matchDate}</span>
        </div>
        
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #e2e8f0;">
          <span style="font-weight: 600; color: #334155;">Match Time:</span>
          <span style="color: #475569; font-weight: 500;">${matchTime}</span>
        </div>
        
        ${timelineName ? `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #e2e8f0;">
          <span style="font-weight: 600; color: #334155;">Timeline:</span>
          <span style="color: #64748b;">${timelineName}</span>
        </div>
        ` : ''}
        
        ${venueName ? `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #e2e8f0;">
          <span style="font-weight: 600; color: #334155;">Venue:</span>
          <span style="color: #64748b;">${venueName}</span>
        </div>
        ` : ''}
        
        ${courtName ? `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #e2e8f0;">
          <span style="font-weight: 600; color: #334155;">Court:</span>
          <span style="color: #64748b;">${courtName}</span>
        </div>
        ` : ''}
        
        <div style="display: flex; justify-content: space-between; align-items: flex-start; padding: 12px 0;">
          <span style="font-weight: 600; color: #334155;">${isMultiParticipant ? 'Opponents:' : 'Opponent:'}</span>
          <div style="text-align: right;">
            ${allOpponents.map(opponent =>
              `<div style="color: #475569; font-weight: 500; margin-bottom: 4px;">${opponent.name} (${opponent.type})</div>`
            ).join('')}
          </div>
        </div>
      </div>
    </div>
    
    ${eventId ? `
    <div style="text-align: center; margin: 30px 0;">
      <a href="${baseUrl}/auth/login?redirect=${encodeURIComponent(`/events/${eventId}/schedule`)}"
         style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
                color: white; text-decoration: none; padding: 14px 32px; border-radius: 12px;
                font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.25);
                transition: all 0.3s ease; letter-spacing: -0.2px;">
        📅 View Full Event Schedule
      </a>
      <p style="color: #64748b; font-size: 14px; margin: 12px 0 0 0;">
        Click to see all matches and tournament brackets
      </p>
    </div>
    ` : ''}
    
    <div class="info" style="margin-bottom: 24px;">
      <h3 style="color: #1d4ed8; font-size: 18px; font-weight: 600; margin: 0 0 12px 0; letter-spacing: -0.2px;">
        📋 Match Information
      </h3>
      <ul style="margin: 0; padding-left: 20px; color: #1d4ed8;">
        <li style="margin-bottom: 8px;">
          <strong>Your ${participantType === 'team' ? 'Team' : 'Registration'}:</strong> ${participantName}
        </li>
        ${isMultiParticipant ? `
        <li style="margin-bottom: 8px;">
          <strong>Your Opponents:</strong>
          <ul style="margin: 4px 0 0 0; padding-left: 20px;">
            ${allOpponents.map(opponent =>
              `<li style="margin-bottom: 4px;">${opponent.name} (${opponent.type === 'team' ? 'Team' : 'Player'})</li>`
            ).join('')}
          </ul>
        </li>
        ` : `
        <li style="margin-bottom: 8px;">
          <strong>Opponent ${allOpponents[0]?.type === 'team' ? 'Team' : 'Player'}:</strong> ${allOpponents[0]?.name || 'TBD'}
        </li>
        `}
        <li style="margin-bottom: 8px;">
          Please arrive <strong>10 minutes early</strong> for check-in and warm-up
        </li>
        <li>
          Contact the Game Coordinator if you have any questions or conflicts
        </li>
      </ul>
    </div>
    
    <div class="warning">
      <h3 style="color: #856404; font-size: 16px; font-weight: 600; margin: 0 0 10px 0;">
        ⚠️ Important Reminders
      </h3>
      <ul style="margin: 0; padding-left: 20px; color: #856404;">
        <li style="margin-bottom: 5px;">
          <strong>Punctuality is key:</strong> Late arrivals may result in forfeiture
        </li>
        <li style="margin-bottom: 5px;">
          <strong>Equipment:</strong> Bring all necessary gear and equipment
        </li>
        <li style="margin-bottom: 5px;">
          <strong>Fair Play:</strong> Follow all game rules and maintain good sportsmanship
        </li>
        <li>
          <strong>Changes:</strong> Contact organizers immediately if you cannot attend
        </li>
      </ul>
    </div>
    
    <p style="color: #1e293b; font-size: 16px; line-height: 1.6; margin: 0 0 15px 0;">
      We're excited to see you compete! This ${isMultiParticipant ? 'multi-participant' : ''} match is an important part of the ${contestLabel} format,
      so give it your best effort and have fun.
    </p>
    
    <p style="color: #1e293b; font-size: 16px; line-height: 1.6; margin: 0 0 15px 0;">
      Good luck and may the best ${participantType === 'team' ? 'team' : 'player'} win! 🏆
      ${isMultiParticipant ? 'Remember, in this format you\'ll be competing against multiple opponents simultaneously.' : ''}
    </p>
    
    <p style="color: #1e293b; font-size: 16px; line-height: 1.6; margin: 0 0 15px 0;">
      Best regards,<br />
      <strong>The CodeNinja Hub Team</strong>
    </p>
    
    <div class="highlight" style="text-align: center;">
      <p style="color: #6c757d; font-size: 14px; margin: 0;">
        This notification was sent because you were scheduled for a match by the Game Coordinator.
      </p>
    </div>
  `;
  
  return getEmailLayout(
    content, 
    `🎯 Match Scheduled: ${gameName} - ${matchDate} at ${matchTime}`,
    `Your match for ${gameName} has been scheduled. Check the details and get ready to compete!`
  );
}
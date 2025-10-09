import { getEmailLayout, EmailTemplateProps } from './html-templates';

/**
 * Team Join Notification Email Template Props
 */
export interface TeamJoinNotificationProps extends EmailTemplateProps {
  teamLeaderName: string;
  teamName: string;
  gameName: string;
  playerName: string;
  playerEmail: string;
  playerPhone?: string;
  playerAge?: number;
  playerGender?: string;
}

/**
 * Team Join Notification Email Template
 * Sent to team leaders when a player joins their open team
 */
export function generateTeamJoinNotificationEmail(props: TeamJoinNotificationProps): string {
  const {
    teamLeaderName = 'Team Leader',
    teamName,
    gameName,
    playerName,
    playerEmail,
    playerPhone,
    playerAge,
    playerGender
  } = props;
  
  const content = `
    <div class="success" style="text-align: center; padding: 20px; border-radius: 12px; margin-bottom: 24px;">
      <h1 style="color: #047857; font-size: 28px; font-weight: 700; margin: 0; line-height: 1.2; letter-spacing: -0.5px;">
        New Player Joined Your Team! 🎉
      </h1>
      <p style="color: #047857; font-size: 16px; margin: 8px 0 0 0;">
        Welcome your new teammate
      </p>
    </div>
    
    <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">
      Hi ${teamLeaderName},
    </p>
    
    <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
      Great news! A new player has joined your team <strong>"${teamName}"</strong> for the 
      <strong>${gameName}</strong> competition.
    </p>
    
    <div class="highlight" style="margin-bottom: 24px;">
      <h2 style="color: #0f172a; font-size: 22px; font-weight: 700; margin: 0 0 20px 0; line-height: 1.3; text-align: center; letter-spacing: -0.3px;">
        👤 New Team Member Details
      </h2>
      
      <div style="display: grid; gap: 16px;">
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #e2e8f0;">
          <span style="font-weight: 600; color: #334155;">Name:</span>
          <span style="color: #475569;">${playerName}</span>
        </div>
        
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #e2e8f0;">
          <span style="font-weight: 600; color: #334155;">Email:</span>
          <span style="color: #475569;">${playerEmail}</span>
        </div>
        
        ${playerPhone ? `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #e2e8f0;">
          <span style="font-weight: 600; color: #334155;">Phone:</span>
          <span style="color: #475569;">${playerPhone}</span>
        </div>
        ` : ''}
        
        ${playerAge ? `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #e2e8f0;">
          <span style="font-weight: 600; color: #334155;">Age:</span>
          <span style="color: #475569;">${playerAge} years old</span>
        </div>
        ` : ''}
        
        ${playerGender ? `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #e2e8f0;">
          <span style="font-weight: 600; color: #334155;">Gender:</span>
          <span style="color: #475569;">${playerGender}</span>
        </div>
        ` : ''}
        
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #e2e8f0;">
          <span style="font-weight: 600; color: #334155;">Game:</span>
          <span style="color: #475569;">${gameName}</span>
        </div>
        
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0;">
          <span style="font-weight: 600; color: #334155;">Team:</span>
          <span style="color: #475569;">${teamName}</span>
        </div>
      </div>
    </div>
    
    <div class="info" style="margin-bottom: 24px;">
      <h3 style="color: #1d4ed8; font-size: 18px; font-weight: 600; margin: 0 0 12px 0; letter-spacing: -0.2px;">
        🏆 Team Update
      </h3>
      <p style="color: #1d4ed8; font-size: 16px; line-height: 1.6; margin: 0;">
        Your team is now one step closer to being complete! 
        Make sure to welcome your new teammate and coordinate your game strategy.
      </p>
    </div>
    
    <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
      As the team leader, you can:
    </p>
    
    <div class="highlight" style="margin-bottom: 24px;">
      <div style="display: grid; gap: 12px;">
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #e2e8f0;">
          <span style="font-weight: 500; color: #334155;">Contact Member</span>
          <span style="color: #64748b;">Reach out at ${playerEmail}${playerPhone ? ` or ${playerPhone}` : ''}</span>
        </div>
        
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #e2e8f0;">
          <span style="font-weight: 500; color: #334155;">Plan Strategy</span>
          <span style="color: #64748b;">Discuss game tactics</span>
        </div>
        
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #e2e8f0;">
          <span style="font-weight: 500; color: #334155;">Schedule Practice</span>
          <span style="color: #64748b;">Organize team sessions</span>
        </div>
        
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0;">
          <span style="font-weight: 500; color: #334155;">Check Status</span>
          <span style="color: #64748b;">View team roster on website</span>
        </div>
      </div>
    </div>
    
    <div class="warning" style="margin-bottom: 24px;">
      <h3 style="color: #856404; font-size: 18px; font-weight: 600; margin: 0 0 12px 0; letter-spacing: -0.2px;">
        📋 Reminder
      </h3>
      <p style="color: #856404; font-size: 16px; line-height: 1.6; margin: 0;">
        As the team leader, you're responsible for coordinating 
        with all team members and ensuring everyone is prepared for the competition.
      </p>
    </div>
    
    <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 15px 0;">
      If you have any questions about team management or need assistance, please don't 
      hesitate to contact our support team.
    </p>
    
    <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 15px 0;">
      Good luck with your team! 🚀
    </p>
    
    <p style="color: #1e293b; font-size: 16px; line-height: 1.6; margin: 0 0 15px 0;">
      Best regards,<br />
      <strong>The CodeNinja Hub Team</strong>
    </p>
    
    <div class="highlight" style="text-align: center;">
      <p style="color: #6c757d; font-size: 14px; margin: 0;">
        This notification was sent because a new player joined your team.
      </p>
    </div>
  `;
  
  return getEmailLayout(
    content, 
    "New Team Member Joined!",
    `${playerName} has joined your team "${teamName}" for ${gameName}. Welcome your new teammate!`
  );
}
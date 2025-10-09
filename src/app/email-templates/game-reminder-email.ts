import { getEmailLayout, EmailTemplateProps } from './html-templates';

/**
 * Game Reminder Email Template Props
 */
export interface GameReminderEmailProps extends EmailTemplateProps {
  gameName: string;
  eventName: string;
  eventDate: string;
  eventTime: string;
  eventLocation?: string;
  loginUrl: string;
  eventId: string;
}

/**
 * Game Reminder Email Template
 * Sent to participants before scheduled games
 */
export function generateGameReminderEmail(props: GameReminderEmailProps): string {
  const {
    gameName,
    eventName,
    eventDate,
    eventTime,
    eventLocation,
    loginUrl,
    eventId
  } = props;
  
  const eventScheduleUrl = `${loginUrl}/events/${eventId}/schedule`;
  
  const content = `
    <div class="info" style="text-align: center; padding: 20px; border-radius: 12px; margin-bottom: 24px;">
      <h1 style="color: #1d4ed8; font-size: 28px; font-weight: 700; margin: 0; line-height: 1.2; letter-spacing: -0.5px;">
        Game Reminder 📅
      </h1>
      <p style="color: #1d4ed8; font-size: 16px; margin: 8px 0 0 0;">
        Your upcoming competition is approaching
      </p>
    </div>
    
    <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">
      Hello,
    </p>
    
    <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
      This is a friendly reminder that your game <strong>${gameName}</strong> is coming up soon as part of 
      the <strong>${eventName}</strong> event.
    </p>
    
    <div class="highlight" style="margin-bottom: 24px;">
      <h2 style="color: #0f172a; font-size: 22px; font-weight: 700; margin: 0 0 20px 0; line-height: 1.3; text-align: center; letter-spacing: -0.3px;">
        📋 Event Details
      </h2>
      
      <div style="display: grid; gap: 16px;">
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #e2e8f0;">
          <span style="font-weight: 600; color: #334155;">Event:</span>
          <span style="color: #475569;">${eventName}</span>
        </div>
        
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #e2e8f0;">
          <span style="font-weight: 600; color: #334155;">Date:</span>
          <span style="color: #475569;">${eventDate}</span>
        </div>
        
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #e2e8f0;">
          <span style="font-weight: 600; color: #334155;">Time:</span>
          <span style="color: #475569;">${eventTime}</span>
        </div>
        
        ${eventLocation ? `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0;">
          <span style="font-weight: 600; color: #334155;">Location:</span>
          <span style="color: #475569;">${eventLocation}</span>
        </div>
        ` : ''}
      </div>
    </div>
    
    <div class="success" style="margin-bottom: 24px;">
      <h3 style="color: #047857; font-size: 18px; font-weight: 600; margin: 0 0 12px 0; letter-spacing: -0.2px;">
        🎮 Game Information
      </h3>
      <p style="color: #047857; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">
        You're scheduled to participate in <strong>${gameName}</strong>. Make sure to prepare and arrive on time.
      </p>
    </div>
    
    <div style="text-align: center; margin-bottom: 30px;">
      <a href="${eventScheduleUrl}" 
         style="display: inline-block; padding: 12px 24px; background-color: #047857; color: white; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
        View Event Schedule
      </a>
    </div>
    
    <div class="warning" style="margin-bottom: 24px;">
      <h3 style="color: #856404; font-size: 18px; font-weight: 600; margin: 0 0 12px 0; letter-spacing: -0.2px;">
        ⚠️ Important Notes
      </h3>
      <ul style="color: #334155; font-size: 16px; line-height: 1.8; margin: 0 0 16px 0; padding-left: 20px;">
        <li>Please arrive at least 15 minutes before the scheduled time</li>
        <li>Bring any required equipment or identification</li>
        <li>Check the schedule for any last-minute changes</li>
      </ul>
    </div>
    
    <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 15px 0;">
      If you have any questions about this event or need to make changes to your participation, 
      please contact our support team.
    </p>
    
    <p style="color: #1e293b; font-size: 16px; line-height: 1.6; margin: 0 0 15px 0;">
      Best regards,<br />
      <strong>The CodeNinja Hub Team</strong>
    </p>
    
    <div class="highlight" style="text-align: center;">
      <p style="color: #6c757d; font-size: 14px; margin: 0;">
        This reminder was sent because you're registered for this event.
      </p>
    </div>
  `;
  
  return getEmailLayout(
    content, 
    `Reminder: ${gameName} at ${eventName}`,
    `Your game ${gameName} is scheduled for ${eventDate} at ${eventTime}. View the event schedule for details.`
  );
}
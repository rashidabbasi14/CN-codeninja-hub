import { getEmailLayout, EmailTemplateProps } from './html-templates';

/**
 * Welcome Email Template Props
 */
export interface WelcomeEmailProps extends EmailTemplateProps {
  name: string;
  loginUrl: string;
}

/**
 * Welcome Email Template
 * Sent to new users upon registration
 */
export function generateWelcomeEmail(props: WelcomeEmailProps): string {
  const { name = 'User', loginUrl } = props;
  
  const content = `
    <div class="success" style="text-align: center; padding: 20px; border-radius: 12px; margin-bottom: 24px;">
      <h1 style="color: #047857; font-size: 28px; font-weight: 700; margin: 0; line-height: 1.2; letter-spacing: -0.5px;">
        Welcome to CodeNinja Hub! 🎉
      </h1>
      <p style="color: #047857; font-size: 16px; margin: 8px 0 0 0;">
        Your journey to competitive excellence starts here
      </p>
    </div>
    
    <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">
      Hi ${name},
    </p>
    
    <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
      Welcome to <strong>CodeNinja Hub</strong>! We're thrilled to have you join our community 
      of competitive programmers and sports enthusiasts.
    </p>
    
    <div class="info" style="margin-bottom: 24px;">
      <h2 style="color: #1d4ed8; font-size: 22px; font-weight: 700; margin: 0 0 16px 0; line-height: 1.3; letter-spacing: -0.3px;">
        🚀 Get Started
      </h2>
      <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">
        Your account has been successfully created. You can now:
      </p>
      <ul style="color: #475569; font-size: 16px; line-height: 1.8; margin: 0 0 24px 0; padding-left: 20px;">
        <li>Register for upcoming events and competitions</li>
        <li>Join or create teams for collaborative challenges</li>
        <li>Track your performance and leaderboard rankings</li>
        <li>Connect with other participants in our community</li>
      </ul>
    </div>
    
    <div class="highlight" style="margin-bottom: 24px;">
      <h3 style="color: #0f172a; font-size: 18px; font-weight: 600; margin: 0 0 12px 0; letter-spacing: -0.2px;">
        📅 Upcoming Events
      </h3>
      <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">
        We have exciting competitions coming up soon. Check out our events page to see what's available 
        and register for the ones that interest you.
      </p>
    </div>
    
    <div style="text-align: center; margin-bottom: 30px;">
      <a href="${loginUrl}" 
         style="display: inline-block; padding: 12px 24px; background-color: #047857; color: white; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
        Login to Your Account
      </a>
    </div>
    
    <div class="warning" style="margin-bottom: 24px;">
      <h3 style="color: #856404; font-size: 18px; font-weight: 600; margin: 0 0 12px 0; letter-spacing: -0.2px;">
        🔐 Account Security
      </h3>
      <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">
        For your security, please set up a strong password for your account. If you didn't register for 
        CodeNinja Hub, please ignore this email or contact our support team.
      </p>
    </div>
    
    <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 15px 0;">
      If you have any questions about getting started or need assistance with your account, 
      our support team is here to help.
    </p>
    
    <p style="color: #1e293b; font-size: 16px; line-height: 1.6; margin: 0 0 15px 0;">
      Best regards,<br />
      <strong>The CodeNinja Hub Team</strong>
    </p>
    
    <div class="highlight" style="text-align: center;">
      <p style="color: #6c757d; font-size: 14px; margin: 0;">
        This email was sent because you registered for CodeNinja Hub.
      </p>
    </div>
  `;
  
  return getEmailLayout(
    content, 
    "Welcome to CodeNinja Hub!",
    "Your competitive programming journey starts now. Login to access events, teams, and leaderboards."
  );
}
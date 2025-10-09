import { getEmailLayout } from './html-templates';

interface EmailVerificationEmailProps {
  firstName: string;
  verificationUrl: string;
}

export function generateEmailVerificationEmail({ firstName, verificationUrl }: EmailVerificationEmailProps): string {
  const content = `
    <div class="warning" style="text-align: center; padding: 20px; border-radius: 12px; margin-bottom: 24px;">
      <h1 style="color: #1e40af; font-size: 28px; font-weight: 700; margin: 0; line-height: 1.2; letter-spacing: -0.5px;">
        ✉️ Verify Your Email Address
      </h1>
      <p style="color: #1e40af; font-size: 16px; margin: 8px 0 0 0;">
        Complete your CodeNinja Hub registration
      </p>
    </div>
    
    <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">
      Hi ${firstName},
    </p>
    
    <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
      Welcome to CodeNinja Hub! To complete your registration and activate your account, please verify your email address by clicking the button below.
    </p>
    
    <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
      Click the button below to verify your email address:
    </p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${verificationUrl}" 
         style="display: inline-block; padding: 14px 28px; background: linear-gradient(135deg, #3b82f6 0%, #10b981 100%); color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3); transition: all 0.3s ease;">
        Verify Email Address
      </a>
    </div>
    
    <p style="color: #64748b; font-size: 14px; line-height: 1.6; margin: 24px 0 0 0;">
      If the button doesn't work, you can copy and paste this link into your browser:
    </p>
    
    <p style="color: #3b82f6; font-size: 14px; line-height: 1.6; margin: 8px 0 24px 0; word-break: break-all;">
      ${verificationUrl}
    </p>
    
    <div style="background: #f1f5f9; padding: 16px; border-radius: 8px; margin: 24px 0;">
      <p style="color: #475569; font-size: 14px; line-height: 1.5; margin: 0;">
        <strong>Important:</strong> This verification link will expire in 24 hours. If you didn't create an account with CodeNinja Hub, you can safely ignore this email.
      </p>
    </div>
    
    <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 24px 0 0 0;">
      Once verified, you'll be able to:
    </p>
    
    <ul style="color: #334155; font-size: 16px; line-height: 1.6; margin: 8px 0 24px 20px;">
      <li>Join sports events and tournaments</li>
      <li>Connect with your colleagues</li>
      <li>Track your performance and achievements</li>
      <li>Participate in the community feed</li>
    </ul>
    
    <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 24px 0 0 0;">
      Welcome to the team!<br>
      The CodeNinja Hub Team
    </p>
  `;

  return getEmailLayout(
    content,
    "Verify Your Email - CodeNinja Hub",
    "Please verify your email address to complete your registration."
  );
}
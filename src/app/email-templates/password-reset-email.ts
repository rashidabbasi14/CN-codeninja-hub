import { getEmailLayout, EmailTemplateProps } from './html-templates';

/**
 * Password Reset Email Template
 */
export function generatePasswordResetEmail(props: EmailTemplateProps & { resetUrl: string }): string {
  const { firstName = 'User', resetUrl } = props;
  
  const content = `
    <div class="warning" style="text-align: center; padding: 20px; border-radius: 12px; margin-bottom: 24px;">
      <h1 style="color: #856404; font-size: 28px; font-weight: 700; margin: 0; line-height: 1.2; letter-spacing: -0.5px;">
        🔐 Password Reset Request
      </h1>
      <p style="color: #856404; font-size: 16px; margin: 8px 0 0 0;">
        Securely reset your account password
      </p>
    </div>
    
    <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">
      Hi ${firstName},
    </p>
    
    <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
      We received a request to reset your password for your CodeNinja Hub account.
    </p>
    
    <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
      Click the button below to reset your password:
    </p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${resetUrl}" style="display: inline-block; background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
             color: white; text-decoration: none; padding: 14px 32px; border-radius: 12px;
             font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(220, 38, 38, 0.25);
             transition: all 0.3s ease; letter-spacing: -0.2px;">
        🔑 Reset Password
      </a>
    </div>
    
    <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
      Or copy and paste this link into your browser:
    </p>
    
    <div style="background: #f1f5f9; padding: 16px; border-radius: 12px; margin: 24px 0; 
         word-break: break-all; font-size: 14px; font-family: monospace; color: #475569;
         border: 1px solid #e2e8f0;">
      ${resetUrl}
    </div>
    
    <div class="warning" style="margin-bottom: 24px;">
      <h3 style="color: #856404; font-size: 18px; font-weight: 600; margin: 0 0 12px 0; letter-spacing: -0.2px;">
        ⚠️ Security Information
      </h3>
      
      <div style="display: grid; gap: 12px;">
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #e2e8f0;">
          <span style="font-weight: 500; color: #856404;">Link Expiry:</span>
          <span style="color: #ca8a04;">1 hour</span>
        </div>
        
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #e2e8f0;">
          <span style="font-weight: 500; color: #856404;">If Not Requested:</span>
          <span style="color: #ca8a04;">Ignore this email</span>
        </div>
        
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0;">
          <span style="font-weight: 500; color: #856404;">Password Status:</span>
          <span style="color: #ca8a04;">Unchanged if no action</span>
        </div>
      </div>
    </div>
    
    <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 15px 0;">
      Best regards,<br />
      <strong>The CodeNinja Hub Team</strong>
    </p>
    
    <div class="highlight" style="text-align: center;">
      <p style="color: #6c757d; font-size: 14px; margin: 0;">
        This is an automated email. Please do not reply to this message.
      </p>
    </div>
  `;
  
  return getEmailLayout(
    content,
    "Reset Your Password - CodeNinja Hub",
    "Reset your password to regain access to your account."
  );
}
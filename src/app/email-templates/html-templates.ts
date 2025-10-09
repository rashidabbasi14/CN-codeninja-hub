/**
 * HTML Email Layout and Utilities for CodeNinja Hub
 * Base layout and shared functions for email templates
 */

export interface EmailTemplateProps {
  firstName?: string;
  lastName?: string;
  email?: string;
  [key: string]: any;
}

/**
 * Get the base URL for the application
 */
function getBaseUrl(): string {
  return process.env.NEXTAUTH_URL || 
         process.env.VERCEL_URL || 
         `http://localhost:${process.env.PORT || 3000}`;
}

/**
 * Base email layout HTML
 */
export function getEmailLayout(content: string, title: string = "CodeNinja Hub", preheader?: string): string {
  const baseUrl = getBaseUrl();
  
  return `
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>${title}</title>
  ${preheader ? `<div style="display: none; font-size: 1px; color: #fefefe; line-height: 1px; font-family: Arial, sans-serif; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden;">${preheader}</div>` : ''}
  <style>
    /* Reset styles */
    body, table, td, p, a, li, blockquote {
      -webkit-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
    }
    table, td {
      mso-table-lspace: 0pt;
      mso-table-rspace: 0pt;
    }
    img {
      -ms-interpolation-mode: bicubic;
      border: 0;
      height: auto;
      line-height: 100%;
      outline: none;
      text-decoration: none;
    }
    
    /* Main styles */
    body {
      margin: 0 !important;
      padding: 0 !important;
      background-color: #f8fafc;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    }
    
    .email-container {
      max-width: 800px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
    }
    
    .header {
      background: #ffffff;
      padding: 30px 20px;
      text-align: center;
      border-bottom: 1px solid #e2e8f0;
    }
    
    .logo {
      width: 60px;
      height: 60px;
      border-radius: 16px;
      margin-bottom: 16px;
      background-color: #ffffff;
      padding: 8px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }
    
    .site-title {
      color: #0f172a;
      font-size: 28px;
      font-weight: 700;
      margin: 0;
      letter-spacing: -0.5px;
    }
    
    .content {
      padding: 40px 45px;
      line-height: 1.6;
      color: #334155;
      background-color: #ffffff;
    }
    
    .footer {
      background-color: #f1f5f9;
      padding: 24px 20px;
      text-align: center;
      border-top: 1px solid #e2e8f0;
    }
    
    .nav-button {
      display: inline-block;
      background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
      color: #ffffff !important;
      padding: 14px 28px;
      text-decoration: none;
      border-radius: 12px;
      font-weight: 600;
      margin: 24px 0;
      box-shadow: 0 4px 14px rgba(59, 130, 246, 0.25);
      transition: all 0.2s ease;
    }
    
    .nav-button:hover {
      background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%);
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(59, 130, 246, 0.35);
    }
    
    .footer-text {
      color: #64748b;
      font-size: 14px;
      margin: 5px 0;
    }
    
    .footer-links {
      margin: 15px 0;
    }
    
    .footer-link {
      color: #3b82f6;
      text-decoration: none;
      margin: 0 10px;
      font-size: 14px;
    }
    
    .footer-link:hover {
      color: #2563eb;
      text-decoration: underline;
    }
    
    .highlight {
      background: #f8fafc;
      padding: 24px;
      border-radius: 12px;
      margin: 24px 0;
      border: 1px solid #e2e8f0;
      color: #334155;
    }
    
    .warning {
      background: #fffbeb;
      padding: 20px;
      border-radius: 12px;
      margin: 24px 0;
      border-left: 4px solid #f59e0b;
      color: #ca8a04;
    }
    
    .success {
      background: #f0fdf4;
      padding: 20px;
      border-radius: 12px;
      margin: 24px 0;
      border-left: 4px solid #10b981;
      color: #047857;
    }
    
    .info {
      background: #eff6ff;
      padding: 20px;
      border-radius: 12px;
      margin: 24px 0;
      border-left: 4px solid #3b82f6;
      color: #1e40af;
    }
    
    /* Responsive styles */
    @media only screen and (max-width: 600px) {
      .email-container {
        width: 100% !important;
      }
      .content {
        padding: 30px 25px !important;
      }
      .header {
        padding: 25px 15px !important;
      }
      .site-title {
        font-size: 20px !important;
      }
    }
  </style>
</head>
<body>
  <div class="email-container">
    <!-- Header -->
    <div class="header">
      <img src="https://media.licdn.com/dms/image/v2/D4D0BAQFblK7mosfYpw/company-logo_200_200/company-logo_200_200/0/1705303200829/codeninjainc_logo?e=2147483647&v=beta&t=o5PnVGkWvlpUoVKk75Z0H7qjxy_PgpPX59LMfQRCuSM" alt="CodeNinja Hub Logo" class="logo" />
      <h1 class="site-title">CodeNinja Hub</h1>
    </div>
    
    <!-- Main Content -->
    <div class="content">
      ${content}
      
      <!-- Navigation Button -->
      <div style="text-align: center; margin: 30px 0;">
        <a href="${baseUrl}" class="nav-button">Visit Website</a>
      </div>
    </div>
    
    <!-- Footer -->
    <div class="footer">
      <div class="footer-links">
        <a href="${baseUrl}/events" class="footer-link">Events</a>
        <a href="${baseUrl}/leaderboard" class="footer-link">Leaderboard</a>
        <a href="${baseUrl}/news" class="footer-link">News</a>
        <a href="${baseUrl}/profile" class="footer-link">Profile</a>
      </div>
      <p class="footer-text">© 2024 CodeNinja Hub. All rights reserved.</p>
      <p class="footer-text">This email was sent to you as part of CodeNinja Hub communications.</p>
      <p class="footer-text">
        <a href="${baseUrl}" class="footer-link">CodeNinja Consulting</a>
      </p>
    </div>
  </div>
</body>
</html>`;
}

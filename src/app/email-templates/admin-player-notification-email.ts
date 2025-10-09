import { getEmailLayout, EmailTemplateProps } from './html-templates';

export interface AdminPlayerNotificationProps extends EmailTemplateProps {
  subject: string;
  content: string;
  playerName?: string;
  playerEmail?: string;
}

/**
 * Convert rich text formatting to HTML for email display
 */
function convertRichTextToHtml(text: string): string {
  if (!text) return '';
  
  const lines = text.split('\n');
  const htmlLines: string[] = [];
  
  for (let line of lines) {
    // Handle dividers
    if (line.trim() === '---') {
      htmlLines.push('<hr style="border: none; border-top: 1px solid #e2e8f0; margin: 16px 0;">');
      continue;
    }
    
    // Handle bullet points
    if (line.trim().startsWith('• ')) {
      const bulletText = line.replace(/^[\s]*•[\s]*/, '');
      const formattedBulletText = formatInlineText(bulletText);
      htmlLines.push(`<div style="display: flex; align-items: flex-start; margin-bottom: 8px;"><span style="color: #3b82f6; margin-right: 8px; margin-top: 2px;">•</span><span>${formattedBulletText}</span></div>`);
      continue;
    }
    
    // Handle regular lines
    if (line.trim()) {
      const formattedLine = formatInlineText(line);
      htmlLines.push(`<p style="margin: 0 0 12px 0;">${formattedLine}</p>`);
    } else {
      htmlLines.push('<br>');
    }
  }
  
  return htmlLines.join('');
}

/**
 * Format inline text (bold, italic)
 */
function formatInlineText(text: string): string {
  // Handle bold text (**text**)
  text = text.replace(/\*\*(.*?)\*\*/g, '<strong style="font-weight: 600; color: #1e293b;">$1</strong>');
  
  // Handle italic text (*text*)
  text = text.replace(/\*([^*]+?)\*/g, '<em style="font-style: italic; color: #475569;">$1</em>');
  
  return text;
}

export function generateAdminPlayerNotificationEmail({
  subject,
  content,
  playerName,
  playerEmail
}: AdminPlayerNotificationProps): string {
  const formattedContent = convertRichTextToHtml(content);
  
  const emailContent = `
    <div class="info" style="text-align: center; padding: 20px; border-radius: 12px; margin-bottom: 24px;">
      <h1 style="color: #1e40af; font-size: 28px; font-weight: 700; margin: 0; line-height: 1.2; letter-spacing: -0.5px;">
        📢 ${subject}
      </h1>
      <p style="color: #1e40af; font-size: 16px; margin: 8px 0 0 0;">
        Message from CodeNinja Hub Administration
      </p>
    </div>
    
    <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">
      ${playerName ? `Hi ${playerName},` : 'Hello!'}
    </p>
    
    <div class="highlight" style="margin-bottom: 24px;">
      <div style="color: #334155; font-size: 16px; line-height: 1.6;">
        ${formattedContent}
      </div>
    </div>
    
    <p style="color: #1e293b; font-size: 16px; line-height: 1.6; margin: 0 0 15px 0;">
      If you have any questions or concerns about this message, please don't hesitate to reply to this email.
    </p>
    
    <p style="color: #1e293b; font-size: 16px; line-height: 1.6; margin: 0 0 15px 0;">
      Best regards,<br />
      <strong>The CodeNinja Hub Team</strong>
    </p>
    
    <div class="highlight" style="text-align: center;">
      <p style="color: #6c757d; font-size: 14px; margin: 0;">
        This message was sent by CodeNinja Hub Administration.
      </p>
    </div>
  `;
  
  return getEmailLayout(
    emailContent,
    `📢 ${subject} - CodeNinja Hub`,
    `Important message from CodeNinja Hub Administration: ${subject}`
  );
}
import nodemailer from 'nodemailer';
import { prisma } from './prisma';

export interface EmailConfig {
  provider: 'microsoft365' | 'zeptomail';
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
  from: string;
}

export interface EmailVariables {
  [key: string]: string;
}

class EmailService {
  private transporter: nodemailer.Transporter | null = null;
  private config: EmailConfig | null = null;

  async initialize() {
    try {
      // Get email configuration from environment variables
      const smtpHost = process.env.EMAIL_SMTP_HOST;
      const smtpPort = process.env.EMAIL_SMTP_PORT;
      const smtpUser = process.env.EMAIL_SMTP_USER;
      const smtpPassword = process.env.EMAIL_SMTP_PASSWORD;
      const fromEmail = process.env.EMAIL_FROM;
      
      if (!smtpHost || !smtpPort || !smtpUser || !smtpPassword || !fromEmail) {
        throw new Error('Email configuration missing in environment variables. Please check EMAIL_* variables in .env file.');
      }

      const port = parseInt(smtpPort);
      const isSecurePort = port === 465; // Port 465 uses SSL/TLS, port 587 uses STARTTLS
      
      this.config = {
        provider: isSecurePort ? 'zeptomail' : 'microsoft365',
        host: smtpHost,
        port: port,
        secure: isSecurePort, // Use SSL/TLS for port 465, STARTTLS for port 587
        auth: {
          user: smtpUser,
          pass: smtpPassword,
        },
        from: fromEmail,
      };

      // Create transporter
      this.transporter = nodemailer.createTransport({
        host: this.config.host,
        port: this.config.port,
        secure: this.config.secure,
        auth: this.config.auth,
        tls: {
          // Remove SSLv3 cipher restriction for better compatibility
          rejectUnauthorized: false,
          servername: this.config.host,
        },
        connectionTimeout: 60000, // 60 seconds (ZeptoMail recommended)
        greetingTimeout: 30000, // 30 seconds (ZeptoMail recommended)
        socketTimeout: 60000, // 60 seconds (ZeptoMail recommended)
      });

      // Verify connection
      await this.transporter!.verify();
      console.log('Email service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize email service:', error);
      throw error;
    }
  }

  async sendEmail(
    to: string | string[],
    subject: string,
    html: string,
    variables: EmailVariables = {},
    sentBy: string = 'system'
  ): Promise<boolean> {
    if (!this.transporter || !this.config) {
      await this.initialize();
    }

    try {
      // Replace variables in subject and html
      const processedSubject = this.replaceVariables(subject, variables);
      const processedHtml = this.replaceVariables(html, variables);

      const recipients = Array.isArray(to) ? to : [to];
      
      // For bulk emails (more than 10 recipients), use batch processing
      if (recipients.length > 10) {
        return await this.sendBulkEmails(recipients, processedSubject, processedHtml, variables, sentBy);
      }
      
      // Send email to each recipient (for small batches)
      const promises = recipients.map(async (recipient) => {
        const personalizedVariables = {
          ...variables,
          email: recipient,
        };

        const personalizedSubject = this.replaceVariables(processedSubject, personalizedVariables);
        const personalizedHtml = this.replaceVariables(processedHtml, personalizedVariables);

        return this.transporter!.sendMail({
          from: this.config!.from,
          to: recipient,
          subject: personalizedSubject,
          html: personalizedHtml,
        });
      });

      await Promise.all(promises);

      // Log successful email sends
      for (const recipient of recipients) {
        await this.logEmail(recipient, processedSubject, 'sent', sentBy);
      }

      return true;
    } catch (error) {
      console.error('Failed to send email:', error);
      
      // Log failed email sends
      const recipients = Array.isArray(to) ? to : [to];
      for (const recipient of recipients) {
        await this.logEmail(recipient, subject, 'failed', sentBy);
      }
      
      return false;
    }
  }

  private async logEmail(recipient: string, subject: string, status: string, sentBy: string): Promise<void> {
    try {
      await prisma.emailLog.create({
        data: {
          recipient,
          subject,
          status,
          sentBy: sentBy === 'system' ? undefined : sentBy,
        },
      });
    } catch (error) {
      console.error('Failed to log email:', error);
    }
  }

  private async sendBulkEmails(
    recipients: string[],
    processedSubject: string,
    processedHtml: string,
    variables: Record<string, any>,
    sentBy: string
  ): Promise<boolean> {
    // Configurable batch settings from environment variables
    const BATCH_SIZE = parseInt(process.env.EMAIL_BATCH_SIZE || '10'); // Default: 10 emails per batch
    const DELAY_MS = parseInt(process.env.EMAIL_BATCH_DELAY_MS || '1000'); // Default: 1 second delay
    const MAX_BATCH_SIZE = 50; // Safety limit to prevent overwhelming the email service
    
    // Ensure batch size is within safe limits
    const safeBatchSize = Math.min(Math.max(BATCH_SIZE, 1), MAX_BATCH_SIZE);
    const safeDelayMs = Math.max(DELAY_MS, 100); // Minimum 100ms delay
    
    console.log(`[BULK EMAIL] Sending to ${recipients.length} recipients in batches of ${safeBatchSize} (delay: ${safeDelayMs}ms)`);
    
    const successfulSends: string[] = [];
    const failedSends: string[] = [];
    
    // Process recipients in batches
    for (let i = 0; i < recipients.length; i += safeBatchSize) {
      const batch = recipients.slice(i, i + safeBatchSize);
      const batchNumber = Math.floor(i / safeBatchSize) + 1;
      const totalBatches = Math.ceil(recipients.length / safeBatchSize);
      
      console.log(`[BULK EMAIL] Processing batch ${batchNumber}/${totalBatches} (${batch.length} recipients)`);
      
      try {
        // Send emails in current batch concurrently
        const batchPromises = batch.map(async (recipient) => {
          try {
            const personalizedVariables = {
              ...variables,
              email: recipient,
            };

            const personalizedSubject = this.replaceVariables(processedSubject, personalizedVariables);
            const personalizedHtml = this.replaceVariables(processedHtml, personalizedVariables);

            await this.transporter!.sendMail({
              from: this.config!.from,
              to: recipient,
              subject: personalizedSubject,
              html: personalizedHtml,
            });
            
            return { success: true, recipient };
          } catch (error) {
            console.error(`[BULK EMAIL] Failed to send to ${recipient}:`, error);
            return { success: false, recipient, error };
          }
        });

        const batchResults = await Promise.all(batchPromises);
        
        // Process batch results
        for (const result of batchResults) {
          if (result.success) {
            successfulSends.push(result.recipient);
          } else {
            failedSends.push(result.recipient);
          }
        }
        
        // Add delay between batches (except for the last batch)
        if (i + safeBatchSize < recipients.length) {
          console.log(`[BULK EMAIL] Waiting ${safeDelayMs}ms before next batch...`);
          await new Promise(resolve => setTimeout(resolve, safeDelayMs));
        }
        
      } catch (error) {
        console.error(`[BULK EMAIL] Batch ${batchNumber} failed:`, error);
        // Mark all recipients in this batch as failed
        failedSends.push(...batch);
      }
    }
    
    console.log(`[BULK EMAIL] Completed: ${successfulSends.length} successful, ${failedSends.length} failed`);
    
    // Log successful email sends
    for (const recipient of successfulSends) {
      await this.logEmail(recipient, processedSubject, 'sent', sentBy);
    }
    
    // Log failed email sends
    for (const recipient of failedSends) {
      await this.logEmail(recipient, processedSubject, 'failed', sentBy);
    }
    
    // Return true if at least some emails were sent successfully
    return successfulSends.length > 0;
  }

  private replaceVariables(text: string, variables: EmailVariables): string {
    let result = text;
    
    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      result = result.replace(regex, value);
    });

    return result;
  }

  async testConnection(): Promise<boolean> {
    try {
      if (!this.transporter) {
        await this.initialize();
      }
      await this.transporter!.verify();
      return true;
    } catch (error) {
      console.error('Email connection test failed:', error);
      return false;
    }
  }
}

export const emailService = new EmailService();

// Re-export game reminder functionality from the new email subfolder
export { scheduleGameReminders } from './email/game-reminder';
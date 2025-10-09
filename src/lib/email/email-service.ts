import nodemailer from 'nodemailer';
import { prisma } from '../prisma';

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

export class EmailService {
  private transporter: nodemailer.Transporter | null = null;
  private config: EmailConfig | null = null;

  async initialize(): Promise<void> {
    if (this.transporter) return;

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
      
      // Send email to each recipient
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
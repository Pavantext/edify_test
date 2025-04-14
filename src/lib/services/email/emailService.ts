import React from 'react';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export type SendEmailParams = {
  to: string | string[];
  subject: string;
  react: React.ReactNode;
  from?: string;
};

class EmailService {
  private static instance: EmailService;
  private defaultFrom: string;

  private constructor() {
    if (!process.env.RESEND_API_KEY) {
      console.error('RESEND_API_KEY is not set in environment variables');
    }
    // Use verified domain aiedify.com with moderator sender
    this.defaultFrom = 'AiEdify Moderator <moderator@aiedify.com>';
  }

  public static getInstance(): EmailService {
    if (!EmailService.instance) {
      EmailService.instance = new EmailService();
    }
    return EmailService.instance;
  }

  async sendEmail({
    to,
    subject,
    react,
    from = this.defaultFrom
  }: SendEmailParams) {
    console.log('Attempting to send email:', {
      to,
      subject,
      from,
      hasReactContent: !!react
    });

    try {
      if (!process.env.RESEND_API_KEY) {
        throw new Error('RESEND_API_KEY is not configured');
      }

      const { data, error } = await resend.emails.send({
        from,
        to,
        subject,
        react,
      });

      if (error) {
        console.error('Email sending failed:', error);
        return { success: false, error };
      }

      console.log('Email sent successfully:', data);
      return { success: true, data };
    } catch (error) {
      console.error('Email service error:', error);
      return { success: false, error };
    }
  }
}

export const emailService = EmailService.getInstance(); 
// sales-pdf-app/app/api/auth/sendEmail.ts

import { Resend } from 'resend';

const resendApiKey = process.env.RESEND_API_KEY;

if (!resendApiKey) {
  throw new Error('RESEND_API_KEY is not set in environment variables');
}

const resend = new Resend(resendApiKey);

const FROM_EMAIL =
  process.env.EMAIL_FROM || process.env.SENDGRID_FROM_EMAIL || 'GTI <no-reply@example.com>';

export default async function sendEmail(
  to: string,
  subject: string,
  resetLink: string
) {
  console.log('📧 Attempting to send email to:', to);

  const emailContent = `
    <div style="font-family: Arial, sans-serif; max-width: 500px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 5px;">
      <h2 style="color: #333; text-align: center;">Set Your Password</h2>
      <p>Hello,</p>
      <p>An account has been created for you. To secure your account, please set your password using the link below:</p>
      
      <p style="word-wrap: break-word; background: #f4f4f4; padding: 10px; border-radius: 5px;">
        <a href="${resetLink}" style="color: #007BFF; text-decoration: none;">${resetLink}</a>
      </p>

      <p>This link will expire in <strong>1 hour</strong> for security reasons.</p>

      <p>If you did not request this, please ignore this email.</p>

      <p>Best Regards,</p>
      <p><strong>GTI</strong></p>
    </div>
  `;

  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [to],
      subject,
      html: emailContent,
    });

    if (error) {
      console.error('🚨 Error sending email via Resend:', error);
      throw error;
    }

    console.log('✅ Email sent successfully via Resend');
  } catch (error: any) {
    console.error('🚨 Error sending email:', error);
    // rethrow if you want the caller to handle it
    throw error;
  }
}

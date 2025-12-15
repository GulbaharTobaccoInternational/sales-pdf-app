// sales-pdf-app/app/api/auth/sendEmail.ts

import { Resend } from 'resend';

const resendApiKey = process.env.RESEND_API_KEY;

if (!resendApiKey) {
  throw new Error('RESEND_API_KEY is not set in environment variables');
}

const resend = new Resend(resendApiKey);

// Raw value from envs (can be bad)
const RAW_FROM_EMAIL =
  process.env.EMAIL_FROM ||
  process.env.SENDGRID_FROM_EMAIL ||
  'GTI Notifications <no-reply@toolio-gti.com>';

// Simple validator: either "Name <email@domain.com>" or "email@domain.com"
const FROM_REGEX =
  /^([^<>]+<[^<>@]+@[^<>@]+\.[^<>@]+>|[^@<>]+@[^@<>]+\.[^@<>]+)$/;

const FROM_EMAIL = FROM_REGEX.test(RAW_FROM_EMAIL.trim())
  ? RAW_FROM_EMAIL.trim()
  : 'GTI Notifications <no-reply@toolio-gti.com>';

if (!FROM_REGEX.test(RAW_FROM_EMAIL.trim())) {
  console.warn(
    `⚠️ EMAIL_FROM / SENDGRID_FROM_EMAIL has invalid format: "${RAW_FROM_EMAIL}". Falling back to "${FROM_EMAIL}".`
  );
}

export type SendEmailParams = {
  to: string | string[];
  subject: string;
  html: string;
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string;
};

export default async function sendEmail({
  to,
  subject,
  html,
  cc,
  bcc,
  replyTo,
}: SendEmailParams) {
  const toList = Array.isArray(to) ? to : [to];
  const ccList = cc ? (Array.isArray(cc) ? cc : [cc]) : undefined;
  const bccList = bcc ? (Array.isArray(bcc) ? bcc : [bcc]) : undefined;

  console.log('📧 Attempting to send email');
  console.log('📧 From:', FROM_EMAIL);
  console.log('📧 To:', toList);
  if (ccList?.length) console.log('📧 CC:', ccList);
  if (bccList?.length) console.log('📧 BCC:', bccList);

  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: toList,
      subject,
      html,
      ...(ccList?.length ? { cc: ccList } : {}),
      ...(bccList?.length ? { bcc: bccList } : {}),
      ...(replyTo ? { replyTo } : {}),
    });

    if (error) {
      console.error('🚨 Error sending email via Resend:', error);
      throw error;
    }

    console.log('✅ Email sent successfully via Resend');
  } catch (error: any) {
    console.error('🚨 Error sending email:', error);
    throw error;
  }
}

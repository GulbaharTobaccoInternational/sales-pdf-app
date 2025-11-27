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
  'GTI Notifications <onboarding@resend.dev>';

// Simple validator: either "Name <email@domain.com>" or "email@domain.com"
const FROM_REGEX =
  /^([^<>]+<[^<>@]+@[^<>@]+\.[^<>@]+>|[^@<>]+@[^@<>]+\.[^@<>]+)$/;

const FROM_EMAIL = FROM_REGEX.test(RAW_FROM_EMAIL.trim())
  ? RAW_FROM_EMAIL.trim()
  : 'GTI Notifications <onboarding@resend.dev>';

if (!FROM_REGEX.test(RAW_FROM_EMAIL.trim())) {
  console.warn(
    `⚠️ EMAIL_FROM / SENDGRID_FROM_EMAIL has invalid format: "${RAW_FROM_EMAIL}". Falling back to "${FROM_EMAIL}".`
  );
}

export default async function sendEmail(
  to: string,
  subject: string,
  resetLink: string
) {
  console.log('📧 Attempting to send email to:', to);
  console.log('📧 Using from:', FROM_EMAIL);

  const emailContent = `
    <div style="
      margin:0;
      padding:0;
      background-color:#f5f5f7;
      font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
      color:#111827;
    ">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#f5f5f7; padding:32px 16px;">
        <tr>
          <td align="center">
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:520px; background-color:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 18px 45px rgba(15,23,42,0.12);">
              
              <!-- Header / Logo -->
              <tr>
                <td align="center" style="padding:24px 24px 8px;">
                  <div style="font-size:26px; font-weight:600; letter-spacing:0.18em; text-transform:uppercase;">
                    Toolio
                  </div>
                </td>
              </tr>

              <!-- Accent Bar -->
              <tr>
                <td style="height:4px; background:linear-gradient(90deg,#3B06D2,#7C3AED);"></td>
              </tr>

              <!-- Body -->
              <tr>
                <td style="padding:28px 24px 8px;">
                  <h1 style="
                    margin:0 0 8px;
                    font-size:22px;
                    line-height:1.3;
                    font-weight:600;
                    color:#111827;
                  ">
                    Set Your Password
                  </h1>
                  <p style="margin:0 0 16px; font-size:14px; line-height:1.6; color:#4b5563;">
                    Hello,
                  </p>
                  <p style="margin:0 0 16px; font-size:14px; line-height:1.6; color:#4b5563;">
                    An account has been created for you in the <strong>GTI Toolio</strong>.
                    To secure your account, please set your password using the button below.
                  </p>

                  <!-- Primary button -->
                  <div style="margin:24px 0;">
                    <a href="${resetLink}" style="
                      display:inline-block;
                      padding:12px 24px;
                      border-radius:999px;
                      background:linear-gradient(90deg,#111827,#000000);
                      color:#ffffff;
                      font-size:14px;
                      font-weight:600;
                      letter-spacing:0.06em;
                      text-transform:uppercase;
                      text-decoration:none;
                    ">
                      Set Password
                    </a>
                  </div>

                  <!-- Fallback plain link -->
                  <p style="margin:0 0 16px; font-size:12px; line-height:1.5; color:#6b7280;">
                    If the button doesn’t work, copy and paste this link into your browser:
                  </p>
                  <p style="
                    margin:0 0 20px;
                    font-size:12px;
                    line-height:1.5;
                    word-break:break-all;
                    background-color:#f9fafb;
                    border-radius:8px;
                    padding:10px 12px;
                    border:1px solid #e5e7eb;
                    color:#111827;
                  ">
                    <a href="${resetLink}" style="color:#2563eb; text-decoration:none;">${resetLink}</a>
                  </p>

                  <p style="margin:0 0 8px; font-size:12px; line-height:1.5; color:#6b7280;">
                    This link will expire in <strong>1 hour</strong> for security reasons.
                  </p>

                  <p style="margin:0 0 0; font-size:12px; line-height:1.5; color:#6b7280;">
                    If you did not expect this email, you can safely ignore it.
                  </p>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="padding:20px 24px 24px; border-top:1px solid #e5e7eb;">
                  <p style="margin:0 0 4px; font-size:12px; line-height:1.5; color:#9ca3af;">
                    Best regards,
                  </p>
                  <p style="margin:0 0 2px; font-size:12px; font-weight:600; color:#4b5563;">
                    GTI Toolio • Gulbahar Tobacco International
                  </p>
                  <p style="margin:0; font-size:11px; line-height:1.5; color:#9ca3af;">
                    This is an automated message. Please do not reply directly to this email.
                  </p>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
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
    throw error;
  }
}

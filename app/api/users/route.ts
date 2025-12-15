// sales-pdf-app/app/api/users/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import sendEmail from '@/app/api/auth/sendEmail';

const SUPER_VIEWER_EMAILS = [
  'admin@gulbahartobacco.com',
  'vinu@gulbahartobacco.com',
];

export async function GET(req: NextRequest) {
  try {
    const users = await prisma.user.findMany();
    return NextResponse.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { email, role } = await req.json();

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // ✅ Check if user already exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json({ error: 'User already exists' }, { status: 400 });
    }

    // ✅ Create User without password
    const newUser = await prisma.user.create({
      data: { email, role },
      select: { id: true, email: true },
    });

    // ✅ Generate Password Reset Token (Valid for 1 Hour)
    const resetToken = crypto.randomUUID();
    await prisma.passwordResetToken.create({
      data: {
        userId: newUser.id,
        token: resetToken,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour expiry
      },
    });

    // ✅ Build reset link
    const base =
      process.env.NEXT_PUBLIC_API_BASE_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.BASE_URL;

    if (!base) {
      return NextResponse.json(
        { error: 'Missing NEXT_PUBLIC_API_BASE_URL / NEXT_PUBLIC_APP_URL / BASE_URL' },
        { status: 500 }
      );
    }

    const resetLink = `${base.replace(/\/$/, '')}/set-password?token=${resetToken}`;

    // ✅ Email content
    const emailContent = `
      <div style="margin:0;padding:0;background-color:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111827;">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#f5f5f7;padding:32px 16px;">
          <tr>
            <td align="center">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:520px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 18px 45px rgba(15,23,42,0.12);">
                <tr>
                  <td align="center" style="padding:24px 24px 8px;">
                    <div style="font-size:26px;font-weight:600;letter-spacing:0.18em;text-transform:uppercase;">Toolio</div>
                  </td>
                </tr>
                <tr>
                  <td style="height:4px;background:linear-gradient(90deg,#3B06D2,#7C3AED);"></td>
                </tr>
                <tr>
                  <td style="padding:28px 24px 8px;">
                    <h1 style="margin:0 0 8px;font-size:22px;line-height:1.3;font-weight:600;color:#111827;">Set Your Password</h1>
                    <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#4b5563;">Hello,</p>
                    <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#4b5563;">
                      An account has been created for you in the <strong>GTI Toolio</strong>.
                      Please set your password using the button below.
                    </p>
                    <div style="margin:24px 0;">
                      <a href="${resetLink}" style="display:inline-block;padding:12px 24px;border-radius:999px;background:linear-gradient(90deg,#111827,#000000);color:#ffffff;font-size:14px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;text-decoration:none;">
                        Set Password
                      </a>
                    </div>
                    <p style="margin:0 0 16px;font-size:12px;line-height:1.5;color:#6b7280;">
                      If the button doesn’t work, copy and paste this link into your browser:
                    </p>
                    <p style="margin:0 0 20px;font-size:12px;line-height:1.5;word-break:break-all;background-color:#f9fafb;border-radius:8px;padding:10px 12px;border:1px solid #e5e7eb;color:#111827;">
                      <a href="${resetLink}" style="color:#2563eb;text-decoration:none;">${resetLink}</a>
                    </p>
                    <p style="margin:0 0 8px;font-size:12px;line-height:1.5;color:#6b7280;">
                      This link will expire in <strong>1 hour</strong>.
                    </p>
                    <p style="margin:0;font-size:12px;line-height:1.5;color:#6b7280;">
                      If you did not expect this email, you can safely ignore it.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:20px 24px 24px;border-top:1px solid #e5e7eb;">
                    <p style="margin:0 0 4px;font-size:12px;line-height:1.5;color:#9ca3af;">Best regards,</p>
                    <p style="margin:0 0 2px;font-size:12px;font-weight:600;color:#4b5563;">GTI Toolio • Gulbahar Tobacco International</p>
                    <p style="margin:0;font-size:11px;line-height:1.5;color:#9ca3af;">This is an automated message. Please do not reply directly.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </div>
    `;

    // ✅ Send to the created user, BCC admins
    await sendEmail({
      to: newUser.email,
      bcc: SUPER_VIEWER_EMAILS,
      subject: 'Set Your Password',
      html: emailContent,
    });

    return NextResponse.json(
      { message: 'User created and email sent' },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }
}

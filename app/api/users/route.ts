// sales-pdf-app/app/api/users/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import sendEmail from '@/app/api/auth/sendEmail';

export async function GET(req: NextRequest) {
  try {
    const users = await prisma.user.findMany();
    return NextResponse.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const { email, role } = await req.json();

    // ✅ Check if user already exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json(
        { error: 'User already exists' },
        { status: 400 }
      );
    }

    // ✅ Create User without password
    const newUser = await prisma.user.create({
      data: { email, role },
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

    // ✅ Send Email with Set Password Link
    const resetLink = `${process.env.NEXT_PUBLIC_API_BASE_URL}/set-password?token=${resetToken}`;
    await sendEmail(email, 'Set Your Password', resetLink);

    return NextResponse.json(
      { message: 'User created and email sent' },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    );
  }
}

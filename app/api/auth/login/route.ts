import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import User from '@/models/User';
import { comparePassword, signToken, setAuthCookie } from '@/lib/auth';
import { loginSchema } from '@/lib/validations';

// Simple in-memory rate limiter (per IP)
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

function getRateLimitKey(request: NextRequest): string {
  return request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? 'unknown';
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting (temporarily disabled for development)
    // const key = getRateLimitKey(request);
    // const now = Date.now();
    // const attempt = loginAttempts.get(key);

    // if (attempt && now < attempt.resetAt) {
    //   if (attempt.count >= MAX_ATTEMPTS) {
    //     return NextResponse.json(
    //       { success: false, error: 'Too many login attempts. Try again in 15 minutes.' },
    //       { status: 429 }
    //     );
    //   }
    //   attempt.count++;
    // } else {
    //   loginAttempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    // }

    await dbConnect();

    const body = await request.json();

    // Validate input
    const result = loginSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error.issues[0].message },
        { status: 400 }
      );
    }

    const { email, password } = result.data;

    // Find user with password (select: false by default)
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Compare password
    const isValid = await comparePassword(password, user.password);
    if (!isValid) {
      return NextResponse.json(
        { success: false, error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Clear rate limit on successful login (disabled for development)
    // loginAttempts.delete(key);

    // Sign JWT
    const token = signToken({
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
      name: user.name,
    });

    // Set HTTP-only cookie
    await setAuthCookie(token);

    return NextResponse.json({
      success: true,
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        apartment: user.apartment,
        phone: user.phone,
      },
      message: 'Login successful',
    });
  } catch (error) {
    console.error('[LOGIN ERROR]', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

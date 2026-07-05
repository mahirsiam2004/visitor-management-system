import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import GuestPass from '@/models/GuestPass';
import EntryLog from '@/models/EntryLog';
import { getAuthUser } from '@/lib/auth';

// ─── POST /api/security/checkin ──────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser();
    if (!authUser || !['security', 'admin'].includes(authUser.role)) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    await dbConnect();

    const { token } = await request.json();
    if (!token) {
      return NextResponse.json({ success: false, error: 'QR token is required' }, { status: 400 });
    }

    const pass = await GuestPass.findOne({ qrToken: token });

    if (!pass) {
      return NextResponse.json({ success: false, error: 'Invalid QR token' }, { status: 404 });
    }

    // Time-based expiry check
    const now = new Date();
    if (now > new Date(pass.expiresAt)) {
      await GuestPass.findByIdAndUpdate(pass._id, { status: 'expired' });
      return NextResponse.json(
        { success: false, error: 'Guest pass has expired. Entry not allowed.' },
        { status: 400 }
      );
    }

    // Status checks
    if (pass.status === 'expired') {
      return NextResponse.json(
        { success: false, error: 'Guest pass has expired' },
        { status: 400 }
      );
    }
    if (pass.status === 'inside') {
      return NextResponse.json(
        { success: false, error: 'Guest is already inside' },
        { status: 400 }
      );
    }
    if (pass.status === 'completed') {
      return NextResponse.json(
        { success: false, error: 'Visit has already been completed' },
        { status: 400 }
      );
    }

    // Update guest pass
    await GuestPass.findByIdAndUpdate(pass._id, {
      status: 'inside',
      entryTime: now,
    });

    // Create entry log
    await EntryLog.create({
      guestPass: pass._id,
      securityGuard: authUser.userId,
      checkIn: now,
    });

    const updated = await GuestPass.findById(pass._id).populate(
      'residentId',
      'name email apartment'
    );

    return NextResponse.json({
      success: true,
      data: updated,
      message: 'Guest checked in successfully',
    });
  } catch (error) {
    console.error('[CHECKIN ERROR]', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

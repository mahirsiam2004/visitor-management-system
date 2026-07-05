import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import GuestPass from '@/models/GuestPass';
import EntryLog from '@/models/EntryLog';
import { getAuthUser } from '@/lib/auth';

// ─── POST /api/security/checkout ─────────────────────────────────────────────
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

    if (pass.status !== 'inside') {
      return NextResponse.json(
        { success: false, error: `Cannot check out. Current status: ${pass.status}` },
        { status: 400 }
      );
    }

    const now = new Date();

    // Update guest pass
    await GuestPass.findByIdAndUpdate(pass._id, {
      status: 'completed',
      exitTime: now,
    });

    // Update entry log checkout time
    await EntryLog.findOneAndUpdate(
      { guestPass: pass._id, checkOut: { $exists: false } },
      { checkOut: now }
    );

    const updated = await GuestPass.findById(pass._id).populate(
      'residentId',
      'name email apartment'
    );

    return NextResponse.json({
      success: true,
      data: updated,
      message: 'Guest checked out successfully',
    });
  } catch (error) {
    console.error('[CHECKOUT ERROR]', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

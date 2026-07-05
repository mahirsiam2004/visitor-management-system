import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import GuestPass from '@/models/GuestPass';

// ─── GET /api/verify/[token] — Public QR verification endpoint ───────────────
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    await dbConnect();

    // Auto-expire active passes
    await GuestPass.updateMany(
      { status: 'active', expiresAt: { $lt: new Date() } },
      { $set: { status: 'expired' } }
    );

    const pass = await GuestPass.findOne({ qrToken: token }).populate(
      'residentId',
      'name email apartment phone'
    );

    if (!pass) {
      return NextResponse.json(
        { success: false, error: 'Invalid QR token — Guest pass not found' },
        { status: 404 }
      );
    }

    // Determine current validity
    const now = new Date();
    const isExpired = now > new Date(pass.expiresAt);

    const responseData = {
      _id: pass._id,
      guestName: pass.guestName,
      guestPhone: pass.guestPhone,
      purpose: pass.purpose,
      visitDate: pass.visitDate,
      visitTime: pass.visitTime,
      duration: pass.duration,
      guestId: pass.guestId,
      qrToken: pass.qrToken,
      expiresAt: pass.expiresAt,
      status: isExpired && pass.status === 'active' ? 'expired' : pass.status,
      entryTime: pass.entryTime,
      exitTime: pass.exitTime,
      resident: pass.residentId,
      isValid: !isExpired && pass.status === 'active',
    };

    return NextResponse.json({ success: true, data: responseData });
  } catch (error) {
    console.error('[VERIFY ERROR]', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

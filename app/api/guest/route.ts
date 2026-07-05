import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import dbConnect from '@/lib/db';
import GuestPass from '@/models/GuestPass';
import User from '@/models/User';
import { getAuthUser } from '@/lib/auth';
import { guestPassSchema } from '@/lib/validations';
import { calculateExpiry } from '@/lib/utils';

// ─── POST /api/guest — Create a new guest pass ───────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser();
    if (!authUser || authUser.role !== 'resident') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    await dbConnect();

    const body = await request.json();
    const result = guestPassSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error.errors[0].message },
        { status: 400 }
      );
    }

    const { guestName, guestPhone, visitDate, visitTime, duration, purpose } = result.data;

    // Fetch resident to get apartment number
    const resident = await User.findById(authUser.userId);
    if (!resident) {
      return NextResponse.json({ success: false, error: 'Resident not found' }, { status: 404 });
    }

    // Generate unique IDs
    const guestId = uuidv4();
    const qrToken = uuidv4();

    // Calculate expiry time
    const expiresAt = calculateExpiry(visitDate, visitTime, duration);

    // Create guest pass
    const guestPass = await GuestPass.create({
      residentId: authUser.userId,
      guestName,
      guestPhone,
      purpose,
      visitDate,
      visitTime,
      duration,
      guestId,
      qrToken,
      expiresAt,
      status: 'active',
    });

    // Populate resident info
    const populated = await GuestPass.findById(guestPass._id).populate(
      'residentId',
      'name email apartment phone'
    );

    return NextResponse.json(
      {
        success: true,
        data: populated,
        message: 'Guest pass created successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[CREATE GUEST ERROR]', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ─── GET /api/guest — List resident's guest passes ───────────────────────────
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') ?? '1');
    const limit = parseInt(searchParams.get('limit') ?? '10');
    const skip = (page - 1) * limit;

    // Build query - residents only see their own passes
    const query: Record<string, unknown> = {};

    if (authUser.role === 'resident') {
      query.residentId = authUser.userId;
    }

    if (status) {
      query.status = status;
    }

    // Auto-expire active passes that have passed their expiry time
    await GuestPass.updateMany(
      { status: 'active', expiresAt: { $lt: new Date() } },
      { $set: { status: 'expired' } }
    );

    const [passes, total] = await Promise.all([
      GuestPass.find(query)
        .populate('residentId', 'name email apartment phone')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      GuestPass.countDocuments(query),
    ]);

    return NextResponse.json({
      success: true,
      data: passes,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('[GET GUESTS ERROR]', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

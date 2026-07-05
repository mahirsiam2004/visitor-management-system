import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import GuestPass from '@/models/GuestPass';
import { getAuthUser } from '@/lib/auth';

// ─── GET /api/guest/[id] ─────────────────────────────────────────────────────
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();

    const pass = await GuestPass.findById(id).populate(
      'residentId',
      'name email apartment phone'
    );

    if (!pass) {
      return NextResponse.json({ success: false, error: 'Guest pass not found' }, { status: 404 });
    }

    // Residents can only see their own passes
    if (authUser.role === 'resident' && pass.residentId.toString() !== authUser.userId) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({ success: true, data: pass });
  } catch (error) {
    console.error('[GET GUEST BY ID ERROR]', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// ─── PUT /api/guest/[id] ─────────────────────────────────────────────────────
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();

    const pass = await GuestPass.findById(id);
    if (!pass) {
      return NextResponse.json({ success: false, error: 'Guest pass not found' }, { status: 404 });
    }

    if (authUser.role === 'resident' && pass.residentId.toString() !== authUser.userId) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const updated = await GuestPass.findByIdAndUpdate(id, body, { new: true }).populate(
      'residentId',
      'name email apartment phone'
    );

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('[UPDATE GUEST ERROR]', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// ─── DELETE /api/guest/[id] ──────────────────────────────────────────────────
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();

    const pass = await GuestPass.findById(id);
    if (!pass) {
      return NextResponse.json({ success: false, error: 'Guest pass not found' }, { status: 404 });
    }

    // Only residents (their own) or admins can delete
    if (authUser.role === 'resident' && pass.residentId.toString() !== authUser.userId) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    await GuestPass.findByIdAndDelete(id);

    return NextResponse.json({ success: true, message: 'Guest pass deleted successfully' });
  } catch (error) {
    console.error('[DELETE GUEST ERROR]', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

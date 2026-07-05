import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import EntryLog from '@/models/EntryLog';
import { getAuthUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser();
    if (!authUser || authUser.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    await dbConnect();

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') ?? '1');
    const limit = parseInt(searchParams.get('limit') ?? '20');
    const skip = (page - 1) * limit;
    const search = searchParams.get('search');

    const matchQuery: Record<string, unknown> = {};

    const [logs, total] = await Promise.all([
      EntryLog.find(matchQuery)
        .populate({
          path: 'guestPass',
          populate: { path: 'residentId', select: 'name apartment' },
        })
        .populate('securityGuard', 'name email')
        .sort({ checkIn: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      EntryLog.countDocuments(matchQuery),
    ]);

    return NextResponse.json({
      success: true,
      data: logs,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('[ADMIN LOGS ERROR]', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

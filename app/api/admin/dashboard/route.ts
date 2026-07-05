import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import User from '@/models/User';
import GuestPass from '@/models/GuestPass';
import EntryLog from '@/models/EntryLog';
import { getAuthUser } from '@/lib/auth';

// ─── GET /api/admin/dashboard ────────────────────────────────────────────────
export async function GET() {
  try {
    const authUser = await getAuthUser();
    if (!authUser || authUser.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    await dbConnect();

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Run all aggregations in parallel
    const [
      totalResidents,
      totalGuards,
      totalPasses,
      activePasses,
      completedToday,
      recentLogs,
      passStatusCounts,
    ] = await Promise.all([
      User.countDocuments({ role: 'resident' }),
      User.countDocuments({ role: 'security' }),
      GuestPass.countDocuments(),
      GuestPass.countDocuments({ status: { $in: ['active', 'inside'] } }),
      GuestPass.countDocuments({
        status: 'completed',
        exitTime: { $gte: today, $lt: tomorrow },
      }),
      EntryLog.find()
        .populate('guestPass', 'guestName purpose visitDate')
        .populate('securityGuard', 'name')
        .sort({ checkIn: -1 })
        .limit(10)
        .lean(),
      GuestPass.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
    ]);

    const statusMap = passStatusCounts.reduce(
      (acc: Record<string, number>, item: { _id: string; count: number }) => {
        acc[item._id] = item.count;
        return acc;
      },
      {}
    );

    return NextResponse.json({
      success: true,
      data: {
        totalResidents,
        totalGuards,
        totalPasses,
        activePasses,
        completedToday,
        recentLogs,
        passStatus: {
          active: statusMap.active ?? 0,
          inside: statusMap.inside ?? 0,
          completed: statusMap.completed ?? 0,
          expired: statusMap.expired ?? 0,
        },
      },
    });
  } catch (error) {
    console.error('[ADMIN DASHBOARD ERROR]', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export type UserRole = 'resident' | 'security' | 'admin';

export type GuestStatus = 'active' | 'expired' | 'inside' | 'completed';

export interface IUser {
  _id: string;
  name: string;
  email: string;
  phone: string;
  apartment?: string;
  role: UserRole;
  createdAt: string;
}

export interface IGuestPass {
  _id: string;
  residentId: string | IUser;
  guestName: string;
  guestPhone: string;
  purpose: string;
  visitDate: string;
  visitTime: string;
  duration: number;
  guestId: string;
  qrToken: string;
  expiresAt: string;
  status: GuestStatus;
  entryTime?: string;
  exitTime?: string;
  createdAt: string;
}

export interface IEntryLog {
  _id: string;
  guestPass: string | IGuestPass;
  securityGuard: string | IUser;
  checkIn: string;
  checkOut?: string;
}

export interface JWTPayload {
  userId: string;
  email: string;
  role: UserRole;
  name: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface DashboardStats {
  totalGuests: number;
  activeGuests: number;
  expiredPasses: number;
  completedVisits: number;
}

export interface AdminDashboardStats {
  totalResidents: number;
  totalGuards: number;
  totalPasses: number;
  activeToday: number;
  completedToday: number;
  recentLogs: IEntryLog[];
}

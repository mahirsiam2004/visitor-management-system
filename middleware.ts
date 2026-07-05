import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';

// Routes accessible without authentication
const PUBLIC_ROUTES = ['/', '/login', '/register', '/api/auth/login', '/api/auth/register', '/api/auth/logout'];

// Route prefix patterns and their required roles
const ROLE_ROUTES: Record<string, string[]> = {
  '/dashboard': ['resident'],
  '/security': ['security', 'admin'],
  '/admin': ['admin'],
  '/api/guest': ['resident', 'admin'],
  '/api/security': ['security', 'admin'],
  '/api/admin': ['admin'],
};

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes
  if (PUBLIC_ROUTES.some((route) => pathname === route || pathname.startsWith('/verify'))) {
    return NextResponse.next();
  }

  // Allow auth API and static assets
  if (
    pathname.startsWith('/api/auth/me') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Get JWT from cookie
  const token = request.cookies.get('vms_token')?.value;

  if (!token) {
    // Redirect to login for page routes
    if (!pathname.startsWith('/api/')) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const user = verifyToken(token);

  if (!user) {
    if (!pathname.startsWith('/api/')) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 });
  }

  // Role-based route protection
  for (const [routePrefix, allowedRoles] of Object.entries(ROLE_ROUTES)) {
    if (pathname.startsWith(routePrefix)) {
      if (!allowedRoles.includes(user.role)) {
        if (!pathname.startsWith('/api/')) {
          // Redirect to appropriate dashboard
          const redirect =
            user.role === 'admin'
              ? '/admin'
              : user.role === 'security'
              ? '/security'
              : '/dashboard';
          return NextResponse.redirect(new URL(redirect, request.url));
        }
        return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
      }
      break;
    }
  }

  // Add user info to headers for route handlers
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-user-id', user.userId);
  requestHeaders.set('x-user-role', user.role);
  requestHeaders.set('x-user-email', user.email);

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};

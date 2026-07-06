# SecureEntry — Visitor Management System

A production-ready, enterprise-grade Visitor Management System built with Next.js 15, Supabase, and Tailwind CSS.

## Tech Stack

- **Framework**: Next.js 15 (App Router), React 19, TypeScript
- **Styling**: Tailwind CSS v4, custom design system
- **Animations**: Framer Motion
- **Forms**: React Hook Form + Zod validation
- **Database**: Supabase PostgreSQL with Row Level Security
- **Auth**: Supabase Auth
- **QR**: react-qr-code (generate) + html5-qrcode (scan)
- **Deployment**: Vercel

## Features

### Resident
- Register and manage account with apartment number
- Create guest passes with QR codes (valid for 1–24 hours)
- View, share, download, and revoke guest passes
- Complete guest history with search and filter
- Profile management and password change

### Security Guard
- Camera-based QR code scanner
- Manual token verification
- Real-time guest verification with full details
- Check-in and check-out guests
- Today's visitors dashboard
- Full entry log history

### Admin
- Full system statistics dashboard
- Manage residents and security guards
- Role management (resident / security / admin)
- View and delete all guest passes
- View all entry logs with date filtering
- Analytics with visual charts
- CSV export for passes and entry logs

## Setup

### 1. Environment Variables

Create `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

### 2. Database Setup

Run the SQL migration in Supabase SQL Editor:

```
supabase/migrations/001_initial_schema.sql
```

This creates:
- `profiles` table (linked to Supabase Auth)
- `guest_passes` table with QR token
- `entry_logs` table
- All RLS policies
- Auto-expire function
- Auto-create profile trigger

### 3. Create Admin User

After creating a user via sign-up, promote them to admin in Supabase:

```sql
UPDATE profiles SET role = 'admin' WHERE email = 'admin@example.com';
```

To create a security guard, update their role similarly:

```sql
UPDATE profiles SET role = 'security' WHERE email = 'guard@example.com';
```

### 4. Supabase Auth Configuration

In Supabase Dashboard → Authentication → URL Configuration:
- Site URL: `https://your-domain.com`
- Redirect URLs: `https://your-domain.com/auth/callback`

### 5. Install Dependencies

```bash
npm install
```

### 6. Run Development

```bash
npm run dev
```

### 7. Deploy to Vercel

```bash
vercel --prod
```

Add all environment variables in Vercel dashboard.

## QR Code Flow

1. Resident creates a guest pass → system generates UUID token
2. QR code encodes: `https://yourdomain.com/verify/{token}`
3. Security guard scans QR code → app calls `verify_guest_token()` RPC
4. If valid → guard clicks "Allow Entry" → entry log created
5. When guest leaves → guard clicks "Check Out" → log marked completed

## Security

- All routes protected by Supabase Auth middleware
- Row Level Security on all tables
- Role-based access control (resident / security / admin)
- QR tokens are UUIDs — no personal data in QR
- Input validation with Zod on all forms and server actions
- Server-side authorization checks in all actions

## Project Structure

```
app/
  actions/          # Server actions (auth, guest passes, admin)
  auth/             # Authentication pages
  dashboard/
    resident/       # Resident dashboard and sub-pages
    security/       # Security guard dashboard
    admin/          # Admin dashboard and management
  verify/[token]/   # Public QR verification page
components/
  features/         # Feature-specific components (QRScanner, CreateGuestPassForm)
  layout/           # DashboardLayout, PageHeader
  shared/           # Reusable components (StatsCard, DataTable, etc.)
  ui/               # Base UI components (Button, Input, Card, etc.)
hooks/              # Custom React hooks
lib/
  supabase/         # Supabase client instances
  utils/            # Utility functions
  validations/      # Zod schemas
types/              # TypeScript type definitions
constants/          # App-wide constants
supabase/
  migrations/       # Database SQL migrations
```

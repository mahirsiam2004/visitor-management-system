# SecureEntry Architecture

## System Overview

SecureEntry is a comprehensive visitor management system built with modern web technologies, designed for scalability, security, and ease of use. The system implements role-based access control, real-time data synchronization, and enterprise-grade security practices.

## Technology Stack

### Frontend
- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **UI Library**: Shadcn UI + Tailwind CSS
- **State Management**: React Hooks + SWR
- **Form Validation**: React Hook Form + Zod
- **QR Codes**: react-qr-code (generation), html5-qrcode (scanning)
- **Notifications**: Sonner
- **Animations**: Framer Motion

### Backend
- **Runtime**: Next.js Server Actions
- **Database**: Supabase PostgreSQL
- **Authentication**: Supabase Auth (JWT-based)
- **Security**: Row Level Security (RLS)
- **API**: RESTful via Supabase SDK

### Infrastructure
- **Deployment**: Vercel
- **Database Hosting**: Supabase (Managed PostgreSQL)
- **Storage**: Supabase Storage + Vercel Blob (optional)
- **Analytics**: Vercel Analytics

## Architecture Layers

```
┌─────────────────────────────────────────┐
│           User Interface Layer           │
│  (React Components, Forms, QR Scanner)   │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│         Business Logic Layer             │
│  (Server Actions, Validation, Utilities) │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│       Data Access Layer                  │
│ (Supabase Client, RLS Policies)          │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│      Database Layer                      │
│ (PostgreSQL with RLS, Indexes)           │
└─────────────────────────────────────────┘
```

## Database Schema Design

### Entity Relationship Diagram

```
┌──────────────────┐
│   auth.users     │
│  (Supabase)      │
└────────┬─────────┘
         │
         │ REFERENCES (on delete cascade)
         │
┌────────▼──────────────────┐
│      profiles              │
├────────────────────────────┤
│ id (UUID, PK)             │
│ email (VARCHAR, UNIQUE)    │
│ full_name                 │
│ phone_number              │
│ apartment_number          │
│ role (ENUM)               │
│ created_at                │
│ updated_at                │
└────────┬───────────────────┘
         │
         │ HAS MANY
         │
┌────────▼──────────────────┐         ┌──────────────────┐
│   guest_passes            │◄────────┤  entry_logs      │
├────────────────────────────┤         ├──────────────────┤
│ id (UUID, PK)             │         │ id (UUID, PK)    │
│ guest_id (VARCHAR, UNIQUE)│         │ guest_pass_id    │
│ guest_name                │         │ security_guard_id│
│ guest_phone               │         │ entry_time       │
│ resident_id (FK)          │         │ exit_time        │
│ apartment_number          │         │ status           │
│ visit_date                │         │ created_at       │
│ visit_time                │         │ updated_at       │
│ expiry_time               │         └──────────────────┘
│ duration_hours            │
│ purpose                   │
│ qr_token (UNIQUE)         │
│ status (ENUM)             │
│ created_at                │
│ updated_at                │
└───────────────────────────┘
```

## Data Flow

### Guest Pass Creation Flow

```
User (Resident) → Login Page
     ↓
   Dashboard
     ↓
Create Guest Pass Form
     ↓
Submit Form Data
     ↓
Server Action: createGuestPass()
     ↓
Validation with Zod
     ↓
Generate QR Token (UUID)
     ↓
Calculate Expiry Time
     ↓
Insert into guest_passes table (RLS: user owns pass)
     ↓
Return to Client
     ↓
Generate QR Code on Client
     ↓
Display to Resident
```

### Check-in Flow

```
Security Guard → Dashboard
     ↓
Open QR Scanner
     ↓
Scan QR Code OR Enter Guest ID
     ↓
html5-qrcode parses QR data
     ↓
Extract: guest_id, qr_token
     ↓
Server Action: checkInGuest()
     ↓
Validate credentials (security guard role)
     ↓
Find guest_pass by guest_id + qr_token
     ↓
Check if pass is valid and not expired
     ↓
Create entry_logs record (RLS: security guard owns log)
     ↓
Return success
     ↓
Display confirmation
     ↓
Update activity logs
```

## Authentication & Authorization

### Role-Based Access Control (RBAC)

```
User Roles:
├── Resident
│   ├── Can create guest passes
│   ├── Can view own passes
│   ├── Can revoke own passes
│   └── Cannot access security features
│
├── Security Guard
│   ├── Can scan QR codes
│   ├── Can check in/out guests
│   ├── Can view entry logs
│   └── Cannot create passes or access admin
│
└── Admin
    ├── Can do everything
    ├── Can manage users
    ├── Can view all data
    └── Can system configuration
```

### Authentication Flow

```
Sign-up/Login
     ↓
Supabase Auth (Email + Password)
     ↓
JWT Token Generated
     ↓
Session Stored in Cookies (via middleware)
     ↓
Middleware Validates Token on Each Request
     ↓
Route Protected by getUser() check
     ↓
RLS Policies Enforce Data Access
```

### Row Level Security (RLS)

Each table has RLS enabled with specific policies:

#### profiles table
```sql
-- Users can view their own profile
SELECT: auth.uid() = id

-- Admins can view all profiles
SELECT: role = 'admin'

-- Users can update their own profile
UPDATE: auth.uid() = id

-- Admins can update any profile
UPDATE: role = 'admin'
```

#### guest_passes table
```sql
-- Residents can view their own passes
SELECT: resident_id = auth.uid() OR (security/admin role)

-- Residents can create passes
INSERT: resident_id = auth.uid() OR (admin role)

-- Residents can update their passes
UPDATE: resident_id = auth.uid() OR (admin role)

-- Only admins can delete
DELETE: admin role
```

#### entry_logs table
```sql
-- Only security guards and admins can view
SELECT: (security or admin role)

-- Only security guards and admins can create
INSERT: (security or admin role)

-- Only the guard who created or admin can update
UPDATE: security_guard_id = auth.uid() OR (admin role)
```

## QR Code System

### QR Generation
```
Guest Pass Created
     ↓
Generate UUID (qr_token)
     ↓
Create JSON: { id: guest_id, token: qr_token }
     ↓
Encode as QR Code (react-qr-code)
     ↓
Render on Client
```

### QR Scanning
```
Security Guard Opens Scanner
     ↓
html5-qrcode Requests Camera Access
     ↓
Reads QR Code from Camera
     ↓
Decodes JSON Data
     ↓
Extracts: guest_id, qr_token
     ↓
Validates Format
     ↓
Submits to Server Action
```

## Performance Optimizations

### Database Level
1. **Indexes**: Strategic indexes on frequently queried columns
   - `idx_guest_passes_resident_id`
   - `idx_guest_passes_qr_token`
   - `idx_entry_logs_guest_pass_id`

2. **Connection Pooling**: Supabase manages connection pool automatically

3. **Query Optimization**: Use RLS to filter at database level

### Application Level
1. **Server Components**: Use for data fetching where possible
2. **Client-Side Caching**: SWR for frequently accessed data
3. **Image Optimization**: Next.js automatic image optimization
4. **Code Splitting**: Lazy loading of components

### Network Level
1. **Compression**: Vercel automatically gzips responses
2. **CDN**: Static assets served from Vercel's CDN
3. **Edge Middleware**: Runs on edge for fast auth checks

## Security Architecture

### Data Protection
```
User Input
     ↓
Client Validation (Zod)
     ↓
Server Validation (Zod)
     ↓
Parameterized Queries (Supabase SDK)
     ↓
RLS Enforcement (Database)
     ↓
Encrypted at Rest (Supabase)
```

### Authentication Security
1. **Password Hashing**: Supabase uses bcrypt (cost 12)
2. **JWT Tokens**: Signed and verified server-side
3. **Session Management**: Secure HTTP-only cookies
4. **CSRF Protection**: Built into Next.js

### API Security
1. **Rate Limiting**: Can be added via Vercel Firewall
2. **CORS**: Configured for your domain
3. **Headers**: Security headers set by middleware
4. **SQL Injection**: Prevented by parameterized queries

## Scalability Considerations

### Horizontal Scaling
- Vercel handles auto-scaling of compute
- PostgreSQL connection pooling prevents bottlenecks
- Static assets served from CDN globally

### Vertical Scaling
- Database can be upgraded to higher tier
- More compute resources on Vercel
- Cache layers (Redis) can be added

### Data Growth
- Partitioning by apartment_number or date if needed
- Archive old entry_logs to separate table
- Implement data retention policies

## Deployment Architecture

```
┌──────────────────────┐
│   Your Repository    │
│    (GitHub)          │
└──────────┬───────────┘
           │ Push
           │
┌──────────▼───────────┐
│  Vercel Pipeline     │
│  - Build             │
│  - Test              │
│  - Deploy            │
└──────────┬───────────┘
           │
┌──────────▼───────────────┐
│  Edge Middleware         │
│  (Auth, Routing)         │
└──────────┬───────────────┘
           │
┌──────────▼───────────────┐
│  Next.js Serverless      │
│  Functions               │
└──────────┬───────────────┘
           │
┌──────────▼───────────────┐
│  Supabase PostgreSQL     │
│  + RLS Policies          │
│  + Indexes               │
└──────────────────────────┘
```

## Error Handling Strategy

### Client-Side
```
Component/Page
     ↓
Try/Catch Block
     ↓
Error State Updated
     ↓
User Feedback (Toast)
     ↓
Log Error (Optional)
```

### Server-Side
```
Server Action
     ↓
Input Validation (Zod)
     ↓
Try/Catch Block
     ↓
Meaningful Error Message
     ↓
Return to Client
     ↓
Client Displays Error
```

## Future Enhancements

### Phase 2
- [ ] SMS/Email notifications
- [ ] Multi-building support
- [ ] Advanced analytics dashboard
- [ ] PDF/CSV export

### Phase 3
- [ ] Mobile app (React Native)
- [ ] Two-factor authentication
- [ ] Integration with building management systems
- [ ] Machine learning for anomaly detection

### Phase 4
- [ ] Real-time collaboration
- [ ] Advanced reporting
- [ ] Integration APIs
- [ ] Custom branding

## Monitoring & Observability

### Metrics to Track
1. Page Load Time (Core Web Vitals)
2. Database Query Performance
3. Authentication Success Rate
4. QR Scan Success Rate
5. Active Users
6. Error Rate

### Tools
- Vercel Analytics for frontend
- Supabase Logs for database
- Error Tracking (Sentry optional)
- Custom logging

---

This architecture ensures SecureEntry is scalable, secure, performant, and maintainable as it grows.

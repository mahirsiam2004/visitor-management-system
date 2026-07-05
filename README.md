# Secure Visitor Management System

A production-ready visitor management system for residential complexes and buildings. Built with Next.js 15, MongoDB, and modern UI components.

## Features

- **QR-Based Guest Passes**: Generate unique QR codes for visitors with time-limited validity
- **Role-Based Access Control**: Separate portals for Residents, Security Guards, and Administrators
- **Real-Time Tracking**: Monitor visitor status (Active, Inside, Completed, Expired)
- **Time-Locked Passes**: Automatic expiry based on visit duration
- **Camera QR Scanner**: Security guards can scan QR codes for quick check-in/check-out
- **Manual Token Lookup**: Alternative verification method for security
- **Admin Dashboard**: Comprehensive analytics, user management, and entry logs
- **CSV Export**: Export guest passes and entry logs for reporting
- **Responsive Design**: Modern dark-mode UI with glass morphism effects

## Tech Stack

### Frontend
- **Next.js 15** (App Router)
- **React 19**
- **TypeScript**
- **Tailwind CSS 4**
- **shadcn/ui** components
- **React Hook Form** + Zod validation
- **React QR Code** for QR generation
- **html5-qrcode** for QR scanning
- **Lucide React** icons
- **Sonner** for toast notifications

### Backend
- **Next.js Route Handlers**
- **MongoDB Atlas**
- **Mongoose** ODM
- **JWT Authentication** (HTTP-only cookies)
- **bcrypt** for password hashing
- **UUID** for unique token generation

### Deployment
- **Vercel** (frontend)
- **MongoDB Atlas** (database)

## User Roles

1. **Resident**: Create guest passes, view guest history, manage profile
2. **Security Guard**: Scan QR codes, check-in/check-out visitors, manual token lookup
3. **Admin**: Full system access, manage users, view all passes and logs, analytics

## Installation

### Prerequisites
- Node.js 18+ 
- MongoDB Atlas account (free tier works)
- Vercel account (for deployment)

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd visitor-vms
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up MongoDB Atlas

1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a free account and a new cluster
3. Create a database user with read/write permissions
4. Whitelist IP addresses (or allow all for development: `0.0.0.0/0`)
5. Get your connection string from the "Connect" button

### 4. Configure Environment Variables

Create a `.env.local` file in the root directory:

```env
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/visitor-vms?retryWrites=true&w=majority
JWT_SECRET=your-super-secret-jwt-key-min-32-characters-long
```

**Important**: 
- Replace `<username>` and `<password>` with your MongoDB credentials
- Generate a strong random string for `JWT_SECRET` (min 32 characters)
- Never commit `.env.local` to version control

### 5. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

## Deployment Guide

### Deploy to Vercel

1. **Push to GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin <your-github-repo>
   git push -u origin main
   ```

2. **Connect to Vercel**
   - Go to [Vercel](https://vercel.com)
   - Click "Add New Project"
   - Import your GitHub repository
   - Configure project settings

3. **Add Environment Variables**
   In Vercel project settings → Environment Variables:
   ```
   MONGODB_URI = your-mongodb-connection-string
   JWT_SECRET = your-production-jwt-secret
   ```

4. **Deploy**
   - Click "Deploy"
   - Vercel will build and deploy your application
   - You'll get a production URL like `https://your-app.vercel.app`

5. **Create Admin User**
   After deployment, you'll need to create the first admin user. You can do this via MongoDB Atlas Compass or by creating a temporary script:

   ```javascript
   // Run in MongoDB shell or Compass
   use visitor-vms
   db.users.insertOne({
     name: "Admin User",
     email: "admin@example.com",
     phone: "+1234567890",
     password: "$2a$12$hashedPasswordHere", // Use bcrypt to hash
     role: "admin",
     createdAt: new Date()
   })
   ```

   To hash a password for the admin user:
   ```bash
   node -e "const bcrypt = require('bcryptjs'); console.log(bcrypt.hashSync('YourPassword123', 12));"
   ```

### MongoDB Atlas Configuration

1. **Cluster Settings**
   - Choose a region close to your users
   - M0 (Free) tier is sufficient for development/testing
   - For production, consider M2+ tier

2. **Network Access**
   - Add Vercel's IP ranges to IP whitelist
   - Or allow access from anywhere (less secure)

3. **Security**
   - Enable TLS/SSL
   - Use strong passwords
   - Enable MongoDB Atlas authentication

## Project Structure

```
visitor-vms/
├── app/
│   ├── admin/              # Admin dashboard pages
│   │   ├── dashboard/
│   │   ├── residents/
│   │   ├── guards/
│   │   ├── passes/
│   │   └── logs/
│   ├── api/               # API routes
│   │   ├── auth/          # Authentication endpoints
│   │   ├── guest/         # Guest pass management
│   │   ├── security/      # Check-in/check-out
│   │   ├── verify/        # QR verification
│   │   └── admin/         # Admin endpoints
│   ├── dashboard/         # Resident dashboard pages
│   │   ├── create-pass/
│   │   ├── guest-history/
│   │   └── profile/
│   ├── security/          # Security guard portal
│   ├── login/             # Login page
│   ├── register/          # Registration page
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Landing page
│   └── globals.css        # Global styles
├── components/
│   ├── dashboard/         # Dashboard-specific components
│   │   └── QRDisplay.tsx
│   └── shared/            # Shared components
│       ├── Header.tsx
│       ├── Sidebar.tsx
│       ├── StatsCard.tsx
│       └── StatusBadge.tsx
├── lib/
│   ├── auth.ts            # Authentication utilities
│   ├── db.ts              # Database connection
│   ├── utils.ts           # Helper functions
│   └── validations.ts     # Zod schemas
├── models/
│   ├── User.ts            # User model
│   ├── GuestPass.ts       # Guest pass model
│   └── EntryLog.ts        # Entry log model
├── types/
│   └── index.ts           # TypeScript types
├── middleware.ts          # Route protection middleware
├── next.config.ts         # Next.js config
├── tailwind.config.ts     # Tailwind config
└── tsconfig.json          # TypeScript config
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new resident
- `POST /api/auth/login` - Login user
- `POST /api/auth/logout` - Logout user
- `GET /api/auth/me` - Get current user
- `PATCH /api/auth/me` - Update user profile

### Guest Passes
- `POST /api/guest` - Create guest pass
- `GET /api/guest` - List guest passes (with pagination)
- `GET /api/guest/[id]` - Get single guest pass
- `PUT /api/guest/[id]` - Update guest pass
- `DELETE /api/guest/[id]` - Delete guest pass

### Security
- `POST /api/security/checkin` - Check in visitor
- `POST /api/security/checkout` - Check out visitor

### Verification
- `GET /api/verify/[token]` - Verify QR token (public)

### Admin
- `GET /api/admin/dashboard` - Admin dashboard stats
- `GET /api/admin/users` - List users (with filters)
- `POST /api/admin/users` - Create user (admin/guard)
- `GET /api/admin/logs` - List entry logs

## Database Schema

### User
- `name`: String
- `email`: String (unique)
- `phone`: String
- `apartment`: String (residents only)
- `password`: String (hashed)
- `role`: 'resident' | 'security' | 'admin'
- `createdAt`: Date

### GuestPass
- `residentId`: ObjectId (ref: User)
- `guestName`: String
- `guestPhone`: String
- `purpose`: String
- `visitDate`: String
- `visitTime`: String
- `duration`: Number (hours)
- `guestId`: String (UUID)
- `qrToken`: String (UUID)
- `expiresAt`: Date
- `status`: 'active' | 'expired' | 'inside' | 'completed'
- `entryTime`: Date
- `exitTime`: Date
- `createdAt`: Date

### EntryLog
- `guestPass`: ObjectId (ref: GuestPass)
- `securityGuard`: ObjectId (ref: User)
- `checkIn`: Date
- `checkOut`: Date

## Security Features

- **JWT Authentication**: HTTP-only cookies for secure token storage
- **Password Hashing**: bcrypt with 12 salt rounds
- **Role-Based Access Control**: Middleware protects routes by role
- **Rate Limiting**: Login attempt limiting (5 attempts per 15 minutes)
- **Input Validation**: Zod schemas on all endpoints
- **Time-Based Expiry**: Passes automatically expire after duration
- **Secure Headers**: Production-only secure cookies

## Development

### Available Scripts

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run start    # Start production server
npm run lint     # Run ESLint
```

### Adding New Features

1. Create API route in `app/api/`
2. Add validation schema in `lib/validations.ts`
3. Create UI components in `components/`
4. Add pages in appropriate `app/` directory
5. Update middleware if needed for route protection

## Troubleshooting

### MongoDB Connection Issues
- Verify `MONGODB_URI` is correct
- Check IP whitelist in MongoDB Atlas
- Ensure database user has correct permissions

### Authentication Issues
- Clear browser cookies
- Verify `JWT_SECRET` is set
- Check token expiry (7 days default)

### QR Scanner Not Working
- Ensure HTTPS (required for camera access)
- Check browser permissions
- Test on mobile device for better camera support

## License

This project is proprietary software. All rights reserved.

## Support

For issues or questions, please contact the development team.

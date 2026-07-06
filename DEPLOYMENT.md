# SecureEntry Deployment Guide

## Prerequisites

- GitHub account
- Vercel account
- Supabase account
- Node.js 18+

## Step 1: Push to GitHub

1. Initialize git repository (if not already done):
   ```bash
   git init
   git add .
   git commit -m "Initial commit: SecureEntry Visitor Management System"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/secureentry.git
   git push -u origin main
   ```

## Step 2: Supabase Setup

### Create Project

1. Go to [Supabase](https://supabase.com)
2. Click "New Project"
3. Fill in project details:
   - Project name: `secureentry`
   - Database password: Generate a strong password
   - Region: Choose closest to your location
4. Click "Create new project"

### Get Connection Details

1. In Supabase dashboard, go to "Settings" → "API"
2. Copy:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - Anon Public Key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### Deploy Database Schema

The database schema is already set up. When you deployed the schema earlier, all tables were created with proper RLS policies.

## Step 3: Deploy to Vercel

### Option A: Using Vercel Dashboard

1. Go to [Vercel Dashboard](https://vercel.com)
2. Click "Add New..." → "Project"
3. Select your GitHub repository
4. Configure project:
   - Framework: Next.js
   - Root Directory: ./
   - Environment Variables:
     - `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase project URL
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase anon key
     - `NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL`: Your Vercel deployment URL + `/auth/callback`

### Option B: Using Vercel CLI

1. Install Vercel CLI:
   ```bash
   npm i -g vercel
   ```

2. Deploy:
   ```bash
   vercel
   ```

3. Follow the prompts and add environment variables

## Step 4: Post-Deployment

### Create Test Users

1. Go to your deployed app URL
2. Sign up as a resident:
   - Name: Test Resident
   - Email: resident@test.com
   - Apartment: A-101
   - Password: TestPassword123!

3. In Supabase, update the profile to test admin:
   ```sql
   UPDATE profiles SET role = 'security' WHERE email = 'security@test.com';
   ```

### Test the Application

1. **Landing Page**: Verify SEO metadata is correct
2. **Authentication Flow**: Test sign up and login
3. **Resident Dashboard**: Create a test guest pass
4. **QR Code**: Verify QR code generation and display
5. **Security Dashboard**: Test QR scanning (requires camera access)

### Configure Custom Domain (Optional)

1. In Vercel dashboard, go to Project Settings
2. Click "Domains"
3. Add your custom domain
4. Update DNS records according to Vercel instructions

## Environment Variables Reference

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL=https://secureentry.vercel.app/auth/callback
```

## Monitoring & Maintenance

### Vercel Analytics

1. In Vercel dashboard, visit "Analytics" to monitor:
   - Page performance
   - Core Web Vitals
   - Real User Monitoring

### Supabase Monitoring

1. In Supabase dashboard:
   - Monitor "Database" section for query performance
   - Check "Auth" section for user growth
   - Review "Logs" for any errors

### Error Tracking

Set up error tracking with Sentry (optional):

1. Create Sentry account
2. Add to your project:
   ```bash
   npm install @sentry/nextjs
   ```
3. Configure in `next.config.js`

## Scaling Considerations

As your application grows:

1. **Database**: Supabase handles auto-scaling
2. **File Storage**: Consider Vercel Blob for QR code archives
3. **Authentication**: Monitor Supabase Auth quota
4. **Edge Functions**: Use Vercel Edge Middleware for custom logic

## Backup & Recovery

### Supabase Backups

1. Navigate to Supabase dashboard
2. Go to "Settings" → "Backups"
3. Enable automated daily backups
4. Store backup encryption key securely

### Manual Backup

```bash
# Export database
pg_dump 'your-connection-string' > backup.sql
```

## Troubleshooting

### Build Errors

**Error**: `Module not found`
- Solution: Ensure all dependencies are installed and environment variables are set

**Error**: `Authentication failed`
- Solution: Verify Supabase credentials and that email confirmation is disabled (if testing)

### Runtime Errors

**404 on routes**: Ensure middleware.ts is properly configured
**QR scanning not working**: Check camera permissions and HTTPS setup

## Rollback

To rollback to a previous version:

1. In Vercel dashboard, go to "Deployments"
2. Find the deployment to rollback to
3. Click "..." and select "Promote to Production"

## Support

For deployment issues:
- Check Vercel status: [status.vercel.com](https://status.vercel.com)
- Check Supabase status: [status.supabase.com](https://status.supabase.com)
- Review error logs in both platforms

## Security Checklist

- [ ] Change default Supabase password
- [ ] Enable two-factor authentication on Vercel
- [ ] Set up custom domain with SSL
- [ ] Enable RLS on all database tables
- [ ] Configure CORS properly
- [ ] Review environment variables (no secrets in code)
- [ ] Enable Supabase backup
- [ ] Set up error monitoring
- [ ] Configure rate limiting
- [ ] Enable database activity logging

## Performance Optimization

### Image Optimization

The app uses Next.js Image component for optimization. QR codes are generated on-the-fly.

### Database Queries

All queries use indexes for fast lookups:
- `idx_guest_passes_resident_id`
- `idx_guest_passes_qr_token`
- `idx_entry_logs_guest_pass_id`

### Caching

- Static assets cached by Vercel
- Database query results cached with SWR on the client
- Use revalidatePath for on-demand revalidation

---

**Deployment completed!** Your SecureEntry system is now live and ready to manage visitors securely.

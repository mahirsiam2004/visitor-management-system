# MongoDB Atlas Setup Guide

This guide will help you set up a free MongoDB Atlas database for the Visitor Management System.

## Step 1: Create MongoDB Atlas Account

1. Go to https://www.mongodb.com/cloud/atlas
2. Click **"Try Free"** or **"Sign Up"**
3. Sign up with your email or Google/GitHub account
4. Verify your email if required

## Step 2: Create a Free Cluster

1. After logging in, click **"Build a Database"**
2. Select **"Shared"** (Free tier)
3. Choose a cloud provider (AWS, GCP, or Azure)
4. Select a region close to your location
5. Leave cluster name as default or name it `visitor-vms`
6. Click **"Create"**
7. Wait for the cluster to be created (takes 2-5 minutes)

## Step 3: Create Database User

1. Click **"Database Access"** in the left sidebar
2. Click **"Add New Database User"**
3. Fill in the form:
   - **Username**: `vmsadmin` (or your preferred username)
   - **Password**: Create a strong password (save this!)
   - **Database User Privileges**: Select **"Read and write to any database"**
4. Click **"Create User"**

## Step 4: Whitelist IP Address

1. Click **"Network Access"** in the left sidebar
2. Click **"Add IP Address"**
3. Select **"Allow Access from Anywhere"** (this adds `0.0.0.0/0`)
   - Note: For production, you should add specific IP addresses
4. Click **"Confirm"**

## Step 5: Get Connection String

1. Click **"Database"** in the left sidebar
2. Click **"Connect"** on your cluster
3. Select **"Connect your application"**
4. Choose driver: **"Node.js"**
5. Select version: **"4.1 or later"**
6. Copy the connection string (it looks like):
   ```
   mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```

## Step 6: Update .env.local File

Create or update the `.env.local` file in your project root:

```env
MONGODB_URI=mongodb+srv://vmsadmin:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/visitor-vms?retryWrites=true&w=majority
JWT_SECRET=your-super-secret-jwt-key-min-32-characters-long
```

**Important:**
- Replace `vmsadmin` with your MongoDB username
- Replace `YOUR_PASSWORD` with your MongoDB password
- Replace `cluster0.xxxxx.mongodb.net` with your cluster address from the connection string
- Generate a random string for `JWT_SECRET` (min 32 characters)

**To generate a JWT_SECRET:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Step 7: Restart Development Server

After updating `.env.local`, restart the server:

```bash
# Stop the current server (Ctrl+C)
# Then restart:
npm run dev
```

## Step 8: Test Registration

1. Open http://localhost:3000/register
2. Fill in the registration form
3. Click "Create Account"
4. If successful, you'll be redirected to the dashboard

## Troubleshooting

### Error: "querySrv ECONNREFUSED"
- Your MongoDB connection string is incorrect
- Check that you replaced `<password>` with your actual password
- Verify the cluster address is correct

### Error: "Authentication failed"
- Username or password is incorrect
- Check Database User in MongoDB Atlas

### Error: "IP not whitelisted"
- Go to Network Access in MongoDB Atlas
- Add your IP address or allow from anywhere

### Connection timeout
- Check that your cluster is fully created (status: "Available")
- Try a different region if connection is slow

## Security Notes

- **Never commit `.env.local` to version control**
- Use strong passwords for MongoDB
- In production, use specific IP addresses instead of allowing from anywhere
- Store JWT_SECRET in environment variables, never in code

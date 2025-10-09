# CodeNinja Hub - Setup Guide

## Quick Start

To get the application running with proper styling:

### 1. Install Dependencies
```bash
npm install --legacy-peer-deps
```

> **✅ Fixed**: Use `--legacy-peer-deps` to resolve React version conflicts. The npm install issue has been resolved by adding the missing `ts-node` dependency and creating the proper `prisma/seed.ts` file.

### 2. Set up Environment Variables
Copy the `.env.example` to `.env` and configure:
```env
DATABASE_URL="sqlserver://CPC-I0105-7YAUX:1433;database=codeninja;user=toxnot.db.admin;password=pvr@mfc@ykt6yrc8AVB;encrypt=false;trustServerCertificate=true"
NEXTAUTH_SECRET="your-secret-key"
NEXTAUTH_URL="http://localhost:3001"

# Microsoft 365 Email Configuration
EMAIL_SMTP_HOST="smtp.office365.com"
EMAIL_SMTP_PORT="587"
EMAIL_SMTP_USER="rashid.abbasi@codeninjaconsulting.com"
EMAIL_SMTP_PASSWORD="Thisismynewpassword123"
EMAIL_FROM="rashid.abbasi@codeninjaconsulting.com"
```

### 3. Set up Database

**Important**: You need SQL Server running locally or update the DATABASE_URL in `.env`

```bash
# Generate Prisma client (with SSL bypass for corporate networks)
$env:NODE_TLS_REJECT_UNAUTHORIZED="0"; npm run db:generate

# Push schema to database (once SQL Server is configured)
npm run db:push

# Seed database with sample data
npm run db:seed
```

**Database Setup Options:**
1. **Local SQL Server**: Install SQL Server Express and update `.env`
2. **Docker**: Run `docker run -e "ACCEPT_EULA=Y" -e "SA_PASSWORD=YourPassword123!" -p 1433:1433 -d mcr.microsoft.com/mssql/server:2019-latest`
3. **Azure SQL**: Use Azure SQL Database and update connection string

### 4. Start Development Server
```bash
npm run dev
```

## Styling Fix

If you see plain text without styling, the issue is likely that Tailwind CSS needs to be properly compiled. Here's how to fix it:

### Option 1: Restart Development Server
```bash
# Stop the server (Ctrl+C) and restart
npm run dev
```

### Option 2: Clear Next.js Cache
```bash
rm -rf .next
npm run dev
```

### Option 3: Force Tailwind Rebuild
```bash
# Install Tailwind CLI globally
npm install -g tailwindcss

# Build CSS manually
npx tailwindcss -i ./src/app/globals.css -o ./public/styles.css --watch
```

## Verification

Once running, you should see:
- ✅ Dark theme with slate-900 background
- ✅ Blue-to-green gradient buttons (CodeNinja branding)
- ✅ Proper card layouts with rounded corners
- ✅ Responsive design that works on mobile
- ✅ Hover effects and animations

## Common Issues

### 1. "Module not found" errors
```bash
npm install --legacy-peer-deps
```

### 2. Database connection issues
- Ensure SQL Server is running
- Check connection string in `.env`
- Verify database exists

### 3. Styling not loading
- Check that `globals.css` imports are correct
- Verify `tailwind.config.ts` is properly configured
- Ensure PostCSS config exists

### 4. TypeScript errors
```bash
npm run build
# Fix any TypeScript errors shown
```

## Features to Test

1. **Homepage** - Should show dark theme with gradient elements
2. **Registration** - Domain validation for @codeninjaconsulting.com emails
3. **Login System** - Passwordless authentication with email only
4. **User Dashboard** - Personalized dashboard after login
5. **Admin Panel** - Full tournament management interface
6. **Game Registration** - Individual and team registration flows
7. **Feed System** - Community posts with image support
8. **News** - Admin announcements with reactions

## 🔐 Authentication Features

The application includes a complete authentication system:

- **Passwordless Login**: Users only need their email to sign in
- **Domain Restriction**: Only `@codeninjaconsulting.com` emails allowed
- **Session Management**: User sessions persist across browser sessions
- **Role-based Access**: Different UI for admins vs regular users
- **Authentication Guards**: Protected routes redirect to login
- **User Context**: Global user state management throughout the app

### Testing Authentication:

1. **Register a new user:**
   - Go to `/auth/register`
   - Use email format: `firstname.lastname@codeninjaconsulting.com`
   - Complete profile information

2. **Login with existing user:**
   - Go to `/auth/login` or click "Sign In"
   - Enter your registered email
   - You'll be automatically logged in

3. **Access user dashboard:**
   - After login, visit `/dashboard`
   - See personalized content and quick actions

4. **Test logout:**
   - Click "Sign Out" from any page
   - Session will be cleared and you'll be logged out

## Production Deployment

For production deployment:

1. **Build the application**
   ```bash
   npm run build
   ```

2. **Set production environment variables**
3. **Deploy to your hosting platform**
4. **Run database migrations**
   ```bash
   npx prisma migrate deploy
   ```

## Support

If you encounter any issues:
1. Check the browser console for errors
2. Verify all dependencies are installed
3. Ensure environment variables are set correctly
4. Check that the database is accessible

The application should now display with full CodeNinja branding and responsive design! 🏆
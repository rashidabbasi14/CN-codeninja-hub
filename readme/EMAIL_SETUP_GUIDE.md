# Email Configuration Setup Guide

## Current Issue
The forgot password functionality is working, but you're getting internal server errors when trying to send emails. This is likely due to Microsoft 365 authentication requirements.

## Microsoft 365 Email Setup

### Option 1: App Password (Recommended)
Microsoft 365 requires App Passwords for SMTP authentication instead of regular passwords.

1. **Enable 2FA on your Microsoft account** (required for App Passwords)
2. **Generate an App Password:**
   - Go to https://account.microsoft.com/security
   - Sign in with your Microsoft account
   - Go to "Security" → "Advanced security options"
   - Under "App passwords", click "Create a new app password"
   - Name it "CodeNinja Hub" or similar
   - Copy the generated password (it will look like: `abcd-efgh-ijkl-mnop`)

3. **Update your .env file:**
   ```env
   EMAIL_SMTP_PASSWORD="abcd-efgh-ijkl-mnop"  # Use the App Password here
   ```

### Option 2: OAuth2 (More Complex)
If App Passwords don't work, you'll need to set up OAuth2 authentication with Microsoft Graph API.

## Alternative Email Providers

### Gmail Setup
If Microsoft 365 continues to have issues, you can use Gmail:

1. **Enable 2FA on your Gmail account**
2. **Generate an App Password:**
   - Go to Google Account settings
   - Security → 2-Step Verification → App passwords
   - Generate password for "Mail"

3. **Update .env file:**
   ```env
   EMAIL_SMTP_HOST="smtp.gmail.com"
   EMAIL_SMTP_PORT="587"
   EMAIL_SMTP_USER="your-email@gmail.com"
   EMAIL_SMTP_PASSWORD="your-app-password"
   EMAIL_FROM="your-email@gmail.com"
   ```

### ZeptoMail Setup (Recommended for Production)
For reliable email delivery, ZeptoMail is recommended:

1. **Sign up at https://www.zoho.com/zeptomail/**
2. **Get your SMTP credentials**
3. **Update .env file:**
  ```env
  EMAIL_SMTP_HOST="smtp.zeptomail.com"
  EMAIL_SMTP_PORT="587"
  EMAIL_SMTP_USER="your-zeptomail-username"
  EMAIL_SMTP_PASSWORD="your-zeptomail-password"
  EMAIL_FROM="your-verified-email@yourdomain.com"
  ```

### SendGrid (Alternative for Production)
For production use, you can also consider using SendGrid:

1. **Sign up at https://sendgrid.com**
2. **Create an API Key**
3. **Update email service to use SendGrid API instead of SMTP**

## ZeptoMail Timeout Configuration

The application is configured with ZeptoMail's recommended timeout settings:

- **Connection Timeout**: 60 seconds (60000ms) - Maximum time to establish SMTP connection
- **Socket Timeout**: 60 seconds (60000ms) - Maximum time for socket inactivity
- **Greeting Timeout**: 30 seconds (30000ms) - Maximum time to wait for server greeting

These settings are automatically applied and help ensure reliable email delivery by preventing connection issues and timeouts during email sending operations.

## Testing Your Email Configuration

### Step 1: Test Email Connection
Use the test endpoint I created:

```bash
curl -X POST http://localhost:3000/api/test-email \
  -H "Content-Type: application/json" \
  -d '{"to": "your-email@codeninjaconsulting.com"}'
```

### Step 2: Test Forgot Password Flow
1. Go to http://localhost:3000/auth/login
2. Click "Forgot your password?"
3. Enter your email address
4. Check for the reset email

## Troubleshooting

### Common Issues:

1. **"Authentication failed"**
   - Use App Password instead of regular password
   - Ensure 2FA is enabled on your Microsoft account

2. **"Connection timeout"**
   - Check if your firewall/antivirus is blocking port 587
   - Try port 25 or 465 instead

3. **"Invalid login"**
   - Verify the email address and password are correct
   - Make sure the account has SMTP access enabled

### Debug Steps:

1. **Check environment variables:**
   ```javascript
   console.log('Email config:', {
     host: process.env.EMAIL_SMTP_HOST,
     port: process.env.EMAIL_SMTP_PORT,
     user: process.env.EMAIL_SMTP_USER,
     from: process.env.EMAIL_FROM
   });
   ```

2. **Test with a simple email client** to verify credentials work outside the app

3. **Check server logs** for detailed error messages

## Current Configuration Status

Your current .env file has:
- ✅ SMTP Host: smtp.office365.com
- ✅ SMTP Port: 587
- ✅ SMTP User: rashid.abbasi@codeninjaconsulting.com
- ❌ SMTP Password: Likely needs to be an App Password
- ✅ From Email: rashid.abbasi@codeninjaconsulting.com

## Next Steps

1. **Generate an App Password** for your Microsoft account
2. **Update EMAIL_SMTP_PASSWORD** in your .env file
3. **Restart your development server** (`npm run dev`)
4. **Test the email functionality** using the test endpoint
5. **Try the forgot password flow**

## Production Considerations

- Use environment-specific email configurations
- Consider using a dedicated email service (SendGrid, AWS SES, etc.)
- Implement email rate limiting
- Add email delivery status tracking
- Set up proper SPF/DKIM records for your domain
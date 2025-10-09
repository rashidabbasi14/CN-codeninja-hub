# Cloudinary Setup Guide

This guide will help you set up Cloudinary for file uploads to resolve the Vercel read-only file system issue.

## Why Cloudinary?

Vercel's serverless environment has a read-only file system, which means you cannot save files directly to the server. Cloudinary provides a cloud-based solution for image and video management.

## Setup Steps

### 1. Create a Cloudinary Account

1. Go to [Cloudinary](https://cloudinary.com/) and sign up for a free account
2. After signing up, you'll be taken to your dashboard
3. Note down your **Cloud Name**, **API Key**, and **API Secret** from the dashboard

### 2. Update Environment Variables

Update your `.env` file with your Cloudinary credentials:

```env
# Cloudinary Configuration
CLOUDINARY_CLOUD_NAME="your-cloud-name"
CLOUDINARY_API_KEY="your-api-key"
CLOUDINARY_API_SECRET="your-api-secret"

# Development SSL Fix (only for local development)
NODE_TLS_REJECT_UNAUTHORIZED=0
```

**Important:**
- Replace the placeholder values with your actual Cloudinary credentials
- The `NODE_TLS_REJECT_UNAUTHORIZED=0` is only needed for local development SSL issues
- **DO NOT** add this SSL setting to your Vercel environment variables - it's only for local development

### 3. Deploy to Vercel

Make sure to add these environment variables to your Vercel project:

1. Go to your Vercel dashboard
2. Select your project
3. Go to Settings → Environment Variables
4. Add **ONLY** the three Cloudinary environment variables:
   - `CLOUDINARY_CLOUD_NAME`
   - `CLOUDINARY_API_KEY`
   - `CLOUDINARY_API_SECRET`

**Important:** Do NOT add `NODE_TLS_REJECT_UNAUTHORIZED` to Vercel - this is only for local development.

### 4. Test the Upload

After deployment, test the avatar upload functionality:

1. Go to your profile page
2. Try uploading an avatar image
3. The image should now be uploaded to Cloudinary instead of the local file system

## What Changed

### Files Modified:
- `src/lib/cloudUpload.ts` - New cloud upload utility
- `src/lib/uploadUtils.ts` - Client-safe validation utilities
- `src/app/api/upload/avatar/route.ts` - Updated to use Cloudinary
- `src/app/api/posts/route.ts` - Updated to use Cloudinary
- `src/app/api/news/route.ts` - Updated to use Cloudinary
- `src/components/AvatarUpload.tsx` - Updated to use new validation
- `next.config.js` - Added Cloudinary domain for Next.js images
- `.env` - Added Cloudinary configuration

### Features:
- ✅ Cloud-based file storage (no more read-only file system errors)
- ✅ Automatic image optimization and transformation
- ✅ CDN delivery for faster loading
- ✅ Automatic cleanup of old avatars when new ones are uploaded
- ✅ Support for multiple image formats (JPEG, PNG, WebP, GIF)
- ✅ File size validation (max 5MB)
- ✅ Next.js Image component compatibility
- ✅ SSL certificate handling for development

## Troubleshooting

### Common Issues:

1. **"Invalid credentials" error**
   - Double-check your Cloudinary credentials in the `.env` file
   - Make sure there are no extra spaces or quotes

2. **Upload still failing**
   - Verify that environment variables are set in Vercel
   - Check the Vercel function logs for detailed error messages

3. **Images not displaying**
   - Check if the Cloudinary URLs are being returned correctly
   - Verify that your Cloudinary account is active

3. **SSL Certificate errors in development**
   - If you see "unable to get local issuer certificate" errors
   - Add `NODE_TLS_REJECT_UNAUTHORIZED=0` to your local `.env` file
   - This setting is automatically ignored in production
   - **Never add this to your Vercel environment variables**
   - Production Vercel has proper SSL certificates and doesn't need this

### Getting Help:

- Check Cloudinary documentation: https://cloudinary.com/documentation
- Verify your account status in the Cloudinary dashboard
- Check Vercel function logs for detailed error messages

## Benefits of This Solution

1. **Scalability**: Cloudinary can handle unlimited file uploads
2. **Performance**: Images are served from a global CDN
3. **Optimization**: Automatic image compression and format conversion
4. **Reliability**: No more file system limitations on serverless platforms
5. **Cost-effective**: Generous free tier for most applications
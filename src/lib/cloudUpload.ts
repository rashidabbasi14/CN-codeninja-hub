import { v2 as cloudinary } from 'cloudinary';
import https from 'https';

// Configure Cloudinary only on server-side
if (typeof window === 'undefined') {
  // Create custom HTTPS agent for development to handle SSL issues
  const httpsAgent = process.env.NODE_ENV === 'development'
    ? new https.Agent({ rejectUnauthorized: false })
    : undefined;

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
    ...(httpsAgent && { agent: httpsAgent }),
  });
}

export interface UploadResult {
  success: boolean;
  url?: string;
  publicId?: string;
  error?: string;
}

export async function uploadToCloudinary(
  file: File,
  folder: string = 'uploads'
): Promise<UploadResult> {
  try {
    // Validate file type (only images)
    if (!file.type.startsWith('image/')) {
      return {
        success: false,
        error: 'Only image files are allowed'
      };
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      return {
        success: false,
        error: 'File size must be less than 5MB'
      };
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Create a promise to handle the upload
    const uploadResult = await new Promise<any>((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        {
          resource_type: 'image',
          folder: folder,
          transformation: [
            { width: 400, height: 400, crop: 'fill', gravity: 'face' },
            { quality: 'auto', fetch_format: 'auto' }
          ],
          allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'gif']
        },
        (error, result) => {
          if (error) {
            reject(error);
          } else {
            resolve(result);
          }
        }
      ).end(buffer);
    });

    return {
      success: true,
      url: uploadResult.secure_url,
      publicId: uploadResult.public_id
    };
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    return {
      success: false,
      error: 'Failed to upload file to cloud storage'
    };
  }
}

export async function deleteFromCloudinary(publicId: string): Promise<boolean> {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return result.result === 'ok';
  } catch (error) {
    console.error('Cloudinary delete error:', error);
    return false;
  }
}

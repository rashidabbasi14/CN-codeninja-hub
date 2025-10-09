// Client-side validation utilities (no Cloudinary imports)
export interface UploadResult {
  success: boolean;
  url?: string;
  publicId?: string;
  error?: string;
}

export function validateImageFile(file: File): { valid: boolean; error?: string } {
  // Check file type
  if (!file.type.startsWith('image/')) {
    return {
      valid: false,
      error: 'Only image files are allowed'
    };
  }

  // Check file size (max 5MB)
  const maxSize = 5 * 1024 * 1024; // 5MB
  if (file.size > maxSize) {
    return {
      valid: false,
      error: 'File size must be less than 5MB'
    };
  }

  // Check supported formats
  const supportedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
  if (!supportedTypes.includes(file.type)) {
    return {
      valid: false,
      error: 'Supported formats: JPEG, PNG, WebP, GIF'
    };
  }

  return { valid: true };
}

// Utility function to extract public ID from Cloudinary URL
export function extractPublicIdFromUrl(url: string): string | null {
  try {
    // Cloudinary URLs have the format: https://res.cloudinary.com/{cloud_name}/image/upload/{transformations}/{public_id}.{format}
    const urlParts = url.split('/');
    const uploadIndex = urlParts.findIndex(part => part === 'upload');
    
    if (uploadIndex === -1) return null;
    
    // Get everything after 'upload' and any transformations
    const pathAfterUpload = urlParts.slice(uploadIndex + 1);
    
    // Remove transformation parameters (they start with letters like 'w_', 'h_', etc.)
    const publicIdParts = pathAfterUpload.filter(part => 
      !part.includes('_') || (!part.startsWith('w_') && !part.startsWith('h_') && !part.startsWith('c_') && !part.startsWith('q_') && !part.startsWith('f_'))
    );
    
    if (publicIdParts.length === 0) return null;
    
    // Join the parts and remove the file extension
    const fullPath = publicIdParts.join('/');
    const lastDotIndex = fullPath.lastIndexOf('.');
    
    return lastDotIndex > 0 ? fullPath.substring(0, lastDotIndex) : fullPath;
  } catch (error) {
    console.error('Error extracting public ID from URL:', error);
    return null;
  }
}
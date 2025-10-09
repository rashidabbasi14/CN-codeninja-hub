// Simple profanity filter implementation
// In a production app, you'd use a more sophisticated service like AWS Comprehend or Google Cloud Natural Language

const PROFANITY_WORDS = [
  // Add common profanity words here
  'damn', 'hell', 'crap', 'stupid', 'idiot', 'moron', 'dumb',
  // Add more words as needed - this is a basic list for demonstration
];

const SEVERITY_LEVELS = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3
};

interface ProfanityResult {
  isClean: boolean;
  severity: number;
  flaggedWords: string[];
  cleanedText: string;
}

export function checkProfanity(text: string): ProfanityResult {
  if (!text) {
    return {
      isClean: true,
      severity: 0,
      flaggedWords: [],
      cleanedText: text
    };
  }

  const words = text.toLowerCase().split(/\s+/);
  const flaggedWords: string[] = [];
  let maxSeverity = 0;
  let cleanedText = text;

  // Check each word against profanity list
  words.forEach(word => {
    // Remove punctuation for checking
    const cleanWord = word.replace(/[^\w]/g, '');
    
    if (PROFANITY_WORDS.includes(cleanWord)) {
      flaggedWords.push(word);
      maxSeverity = Math.max(maxSeverity, SEVERITY_LEVELS.LOW);
      
      // Replace with asterisks
      const replacement = '*'.repeat(word.length);
      cleanedText = cleanedText.replace(new RegExp(word, 'gi'), replacement);
    }
  });

  return {
    isClean: flaggedWords.length === 0,
    severity: maxSeverity,
    flaggedWords,
    cleanedText
  };
}

export function isContentAppropriate(text: string): boolean {
  const result = checkProfanity(text);
  return result.isClean || result.severity <= SEVERITY_LEVELS.LOW;
}

export function cleanContent(text: string): string {
  const result = checkProfanity(text);
  return result.cleanedText;
}

// Rate limiting utility
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

export function checkRateLimit(
  identifier: string, 
  maxRequests: number = 10, 
  windowMs: number = 60000 // 1 minute
): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now();
  const key = identifier;
  
  let record = rateLimitStore.get(key);
  
  if (!record || now > record.resetTime) {
    record = {
      count: 0,
      resetTime: now + windowMs
    };
  }
  
  record.count++;
  rateLimitStore.set(key, record);
  
  const allowed = record.count <= maxRequests;
  const remaining = Math.max(0, maxRequests - record.count);
  
  return {
    allowed,
    remaining,
    resetTime: record.resetTime
  };
}

// Media validation
export function validateMediaFile(file: File): { valid: boolean; error?: string } {
  const maxSize = 5 * 1024 * 1024; // 5MB
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  
  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: 'Only JPEG, PNG, WebP, and GIF images are allowed'
    };
  }
  
  if (file.size > maxSize) {
    return {
      valid: false,
      error: 'File size must be less than 5MB'
    };
  }
  
  return { valid: true };
}

// Content length validation
export function validateContentLength(content: string, maxLength: number = 2000): { valid: boolean; error?: string } {
  if (content.length > maxLength) {
    return {
      valid: false,
      error: `Content must be less than ${maxLength} characters`
    };
  }
  
  return { valid: true };
}

// CSRF token generation and validation
export function generateCSRFToken(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

export function validateCSRFToken(token: string, storedToken: string): boolean {
  return token === storedToken;
}
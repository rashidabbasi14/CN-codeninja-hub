import jwt, { SignOptions } from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production'
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d'

export interface JWTPayload {
  userId: string
  email: string
  role: string
  iat?: number
  exp?: number
}

export function signToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET is not defined')
  }
  
  const options: SignOptions = {
    expiresIn: JWT_EXPIRES_IN as any,
  }
  
  return jwt.sign(payload, JWT_SECRET, options)
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    if (!JWT_SECRET) {
      throw new Error('JWT_SECRET is not defined')
    }
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload
    return decoded
  } catch (error) {
    console.error('JWT verification failed:', error)
    return null
  }
}

export function refreshToken(token: string): string | null {
  const payload = verifyToken(token)
  if (!payload) {
    return null
  }

  // Create new token with fresh expiration
  const { iat, exp, ...tokenData } = payload
  return signToken(tokenData)
}
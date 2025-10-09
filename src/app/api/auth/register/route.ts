import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { emailService } from '@/lib/email';
import { generateEmailVerificationEmail } from '@/app/email-templates/email-verification-email';

// Get allowed domain from environment
const getAllowedDomain = () => {
  return process.env.ALLOWED_EMAIL_DOMAIN || 'codeninjaconsulting.com';
};

const registerSchema = z.object({
  email: z.string().email().refine(email => {
    const allowedDomain = getAllowedDomain();
    return email.endsWith(`@${allowedDomain}`);
  }, {
    message: `Only @${getAllowedDomain()} email addresses are allowed`
  }),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  password: z.string().min(6, 'Password must be at least 6 characters long'),
  gender: z.enum(['MALE', 'FEMALE']),
  age: z.number().min(18).max(100).optional(),
  phone: z.string().optional(),
  department: z.string().min(1, 'Department is required'),
  avatarUrl: z.string().optional(),
  privacyHideAge: z.boolean().default(false),
  privacyHideGender: z.boolean().default(false),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = registerSchema.parse(body);

    // Normalize email to lowercase to prevent case-sensitive duplicates
    const normalizedEmail = validatedData.email.toLowerCase();

    // Capitalize first and last names
    const firstName = validatedData.firstName.charAt(0).toUpperCase() + validatedData.firstName.slice(1).toLowerCase();
    const lastName = validatedData.lastName.charAt(0).toUpperCase() + validatedData.lastName.slice(1).toLowerCase();

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail }
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 409 }
      );
    }

    // Check if department exists, create if it doesn't
    let department = await prisma.department.findUnique({
      where: { name: validatedData.department }
    });

    if (!department) {
      // For now, we'll create the department automatically
      // In a real app, this might be restricted to admins
      department = await prisma.department.create({
        data: {
          name: validatedData.department,
          createdBy: 'system' // We'll update this once we have proper auth
        }
      });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(validatedData.password, 12);

    // Generate email verification token
    const emailVerificationToken = crypto.randomBytes(32).toString('hex');
    const emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now

    // Create the user (inactive by default)
    const user = await prisma.user.create({
      data: {
        firstName,
        lastName,
        email: normalizedEmail,
        password: hashedPassword,
        gender: validatedData.gender,
        age: validatedData.age,
        phone: validatedData.phone,
        departmentId: department.id,
        avatarUrl: validatedData.avatarUrl,
        privacyHideAge: validatedData.privacyHideAge,
        privacyHideGender: validatedData.privacyHideGender,
        role: 'USER',
        isEmailVerified: false,
        emailVerificationToken,
        emailVerificationExpires
      },
      include: {
        department: true
      }
    });

    // Log the registration
    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: 'USER_REGISTERED',
        entity: 'User',
        entityId: user.id,
        payload: JSON.stringify({
          email: user.email,
          department: department.name
        })
      }
    });

    // Send email verification email
    try {
      const verificationUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/auth/verify-email?token=${emailVerificationToken}`;
      
      const verificationEmailHtml = generateEmailVerificationEmail({
        firstName: user.firstName,
        verificationUrl
      });

      await emailService.sendEmail(
        user.email,
        'Verify Your Email - CodeNinja Hub',
        verificationEmailHtml,
        {},
        'system'
      );
      console.log('✅ Email verification sent to:', user.email);
      console.log('🔗 Verification link (for development):', verificationUrl);
    } catch (emailError) {
      console.error('❌ Failed to send verification email:', emailError);
      console.log('📧 Email service error details:', emailError instanceof Error ? emailError.message : 'Unknown error');
      // Continue with the response even if email fails - this allows development without email setup
    }

    return NextResponse.json({
      success: true,
      message: 'Registration successful! Please check your email to verify your account.',
      requiresEmailVerification: true,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        department: department.name,
        role: user.role,
        isEmailVerified: false
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
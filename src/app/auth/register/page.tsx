
"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Zap, Mail, User, Building, Calendar, Image, AtSign } from "lucide-react";
import Link from "next/link";
import AvatarUpload from "@/components/AvatarUpload";
import NextImage from "next/image";
import { useUser } from "@/contexts/UserContext";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const { login } = useUser();
  const router = useRouter();
  const [email, setEmail] = useState('@codeninjaconsulting.com');
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    password: "",
    gender: "MALE",
    age: "",
    phone: "",
    department: "",
    avatarUrl: "",
    privacyHideAge: false,
    privacyHideGender: false,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [departments, setDepartments] = useState<string[]>([]);
  const [loadingDepartments, setLoadingDepartments] = useState(true);
  const [allowedDomain, setAllowedDomain] = useState("codeninjaconsulting.com");

  // Fetch departments and domain configuration from API
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch departments
        const deptResponse = await fetch('/api/departments');
        if (deptResponse.ok) {
          const deptData = await deptResponse.json();
          if (Array.isArray(deptData)) {
            setDepartments(deptData.map((dept: any) => dept.name));
          }
        } else {
          console.error('Failed to fetch departments');
          // Fallback to hardcoded departments if API fails
          setDepartments([
            "Engineering",
            "Product Management",
            "Design",
            "Marketing",
            "Sales",
            "Operations",
            "HR",
            "Finance",
          ]);
        }

        // Fetch allowed domain from environment
        try {
          const configResponse = await fetch('/api/config/domain');
          if (configResponse.ok) {
            const configData = await configResponse.json();
            if (configData.success && configData.domain) {
              setAllowedDomain(configData.domain);
              setEmail(`@${configData.domain}`);
            }
          }
        } catch (error) {
          console.error('Error fetching domain config:', error);
          // Keep default domain
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        // Fallback to hardcoded departments if API fails
        setDepartments([
          "Engineering",
          "Product Management",
          "Design",
          "Marketing",
          "Sales",
          "Operations",
          "HR",
          "Finance",
        ]);
      } finally {
        setLoadingDepartments(false);
      }
    };

    fetchData();
  }, []);

  const handleEmailChange = (emailValue: string) => {
    setEmail(emailValue);
    setError("");

    // Auto-populate name fields from email prefix
    const atIndex = emailValue.indexOf('@');
    if (atIndex > 0) {
      const emailPrefix = emailValue.substring(0, atIndex);
      
      if (emailPrefix.includes("_")) {
        // Format: firstname_lastname
        const [firstName, lastName] = emailPrefix.split("_");
        if (firstName && lastName) {
          setFormData(prev => ({
            ...prev,
            firstName: firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase(),
            lastName: lastName.charAt(0).toUpperCase() + lastName.slice(1).toLowerCase()
          }));
          return;
        }
      } else if (emailPrefix.includes(".")) {
        // Format: firstname.lastname
        const [firstName, lastName] = emailPrefix.split(".");
        if (firstName && lastName) {
          setFormData(prev => ({
            ...prev,
            firstName: firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase(),
            lastName: lastName.charAt(0).toUpperCase() + lastName.slice(1).toLowerCase()
          }));
          return;
        }
      } else {
        // Format: firstname (only first name)
        setFormData(prev => ({
          ...prev,
          firstName: emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1).toLowerCase(),
          lastName: "" // Clear last name if only first name pattern
        }));
        return;
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    // Validate email
    if (!email.trim() || email === `@${allowedDomain}`) {
      setError("Email is required");
      setIsLoading(false);
      return;
    }

    // Validate that first and last names are provided
    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      setError("First name and last name are required");
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email,
          firstName: formData.firstName.trim(),
          lastName: formData.lastName.trim(),
          password: formData.password,
          gender: formData.gender || undefined,
          age: formData.age ? parseInt(formData.age) : undefined,
          phone: formData.phone.trim() || undefined,
          department: formData.department,
          avatarUrl: formData.avatarUrl || undefined,
          privacyHideAge: formData.privacyHideAge,
          privacyHideGender: formData.privacyHideGender,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Registration failed');
      }

      // Show success message for email verification
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAvatarUpload = async (file: File) => {
    setUploading(true);
    setError("");

    try {
      const formDataUpload = new FormData();
      formDataUpload.append('avatar', file);

      const response = await fetch('/api/upload/avatar', {
        method: 'POST',
        body: formDataUpload
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setFormData(prev => ({
          ...prev,
          avatarUrl: result.avatarUrl
        }));
      } else {
        // Handle specific upload errors
        const errorMessage = result.error || 'Failed to upload avatar';
        setError(`Avatar upload failed: ${errorMessage}`);
      }
    } catch (error) {
      console.error('Failed to upload avatar:', error);
      setError('Failed to upload avatar. Please check your internet connection and try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleAvatarRemove = () => {
    setFormData(prev => ({
      ...prev,
      avatarUrl: ""
    }));
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-slate-800/50 border-slate-700 shadow-2xl backdrop-blur-sm">
          <CardHeader className="text-center">
            <div className="h-16 w-16 rounded-full bg-gradient-to-br from-blue-500 to-green-500 flex items-center justify-center mx-auto mb-4 shadow-lg">
              <Mail className="h-8 w-8 text-white" />
            </div>
            <CardTitle className="text-white text-2xl">Check Your Email!</CardTitle>
            <CardDescription className="text-slate-300">
              Registration successful! We've sent a verification email to activate your account.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-blue-500/20 border border-blue-500/50">
                <p className="text-blue-300 text-sm text-center">
                  Please check your inbox and click the verification link to activate your account.
                  You won't be able to log in until your email is verified.
                </p>
              </div>
              
              <div className="space-y-3">
                <Button className="w-full codeninja-gradient hover:shadow-lg transition-all duration-300" asChild>
                  <Link href="/auth/login">Go to Login</Link>
                </Button>
                <Button variant="outline" className="w-full border-slate-600 text-slate-300 hover:bg-slate-700 transition-all duration-300" asChild>
                  <Link href="/auth/register">Register Another Account</Link>
                </Button>
              </div>

              <div className="text-center">
                <p className="text-xs text-slate-400">
                  Didn't receive the email? Check your spam folder or contact support.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center space-x-3 mb-6 group">
            <div className="h-12 w-12 rounded-lg overflow-hidden shadow-lg group-hover:shadow-xl transition-all duration-300">
              <NextImage
                src="/logo.jpg"
                alt="CodeNinja Hub Logo"
                width={48}
                height={48}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="text-left">
              <h1 className="text-xl font-bold text-white group-hover:text-blue-300 transition-colors duration-300">CodeNinja Hub</h1>
              <p className="text-sm text-slate-400">Sports & Events Platform</p>
            </div>
          </Link>
        </div>

        <Card className="bg-slate-800/50 border-slate-700 shadow-2xl backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-white text-2xl text-center">Join CodeNinja Hub</CardTitle>
            <CardDescription className="text-slate-300 text-center">
              Register with your {allowedDomain} email address
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="p-4 rounded-lg bg-red-500/20 border border-red-500/50 text-red-300 text-sm shadow-lg">
                  {error}
                </div>
              )}

              {/* Email with Domain Display */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300 flex items-center">
                  <Mail className="h-4 w-4 mr-2" />
                  Email Address
                </label>
                <Input
                  type="email"
                  placeholder="username@codeninjaconsulting.com"
                  value={email}
                  onChange={(e) => handleEmailChange(e.target.value)}
                  required
                  autoComplete="email"
                  className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 transition-all duration-300"
                />
              </div>

              {/* Name Fields - Side by Side */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* First Name */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300 flex items-center">
                    <User className="h-4 w-4 mr-2" />
                    First Name *
                  </label>
                  <Input
                    type="text"
                    placeholder="John"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    required
                    className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 transition-all duration-300"
                  />
                </div>

                {/* Last Name */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300 flex items-center">
                    <User className="h-4 w-4 mr-2" />
                    Last Name *
                  </label>
                  <Input
                    type="text"
                    placeholder="Doe"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    required
                    className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 transition-all duration-300"
                  />
                </div>
              </div>

              {/* Password Field */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300 flex items-center">
                  <User className="h-4 w-4 mr-2" />
                  Password *
                </label>
                <Input
                  type="password"
                  placeholder="Enter password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 transition-all duration-300"
                />
                <p className="text-xs text-slate-400">
                  Must be at least 6 characters long
                </p>
              </div>

              {/* Phone Number */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300 flex items-center">
                  <User className="h-4 w-4 mr-2" />
                  Phone Number (Optional)
                </label>
                <Input
                  type="tel"
                  placeholder="+92-300-1234567"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 transition-all duration-300"
                />
                <p className="text-xs text-slate-400">
                  Include country code (e.g., +92-300-1234567)
                </p>
              </div>

              {/* Gender and Age - Side by Side */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Gender */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300 flex items-center">
                    <User className="h-4 w-4 mr-2" />
                    Gender *
                  </label>
                  <select
                    value={formData.gender}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                    className="w-full h-10 px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-300"
                    required
                  >
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                  </select>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="hideGender"
                      checked={formData.privacyHideGender}
                      onChange={(e) => setFormData({ ...formData, privacyHideGender: e.target.checked })}
                      className="rounded border-slate-600 bg-slate-700"
                    />
                    <label htmlFor="hideGender" className="text-xs text-slate-400">
                      Hide gender from public views
                    </label>
                  </div>
                </div>

                {/* Age */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300 flex items-center">
                    <Calendar className="h-4 w-4 mr-2" />
                    Age (Optional)
                  </label>
                  <Input
                    type="number"
                    min="18"
                    max="100"
                    placeholder="25"
                    value={formData.age}
                    onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                    className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 transition-all duration-300"
                  />
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="hideAge"
                      checked={formData.privacyHideAge}
                      onChange={(e) => setFormData({ ...formData, privacyHideAge: e.target.checked })}
                      className="rounded border-slate-600 bg-slate-700"
                    />
                    <label htmlFor="hideAge" className="text-xs text-slate-400">
                      Hide age from public views
                    </label>
                  </div>
                </div>
              </div>

              {/* Department */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300 flex items-center">
                  <Building className="h-4 w-4 mr-2" />
                  Department *
                </label>
                <select
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  required
                  className="w-full h-10 px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-300"
                >
                  <option value="">Select your department</option>
                  {departments.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              </div>

              {/* Profile Image */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300 flex items-center">
                  <Image className="h-4 w-4 mr-2" />
                  Profile Image (Optional)
                </label>
                <AvatarUpload
                  currentAvatarUrl={formData.avatarUrl}
                  onUpload={handleAvatarUpload}
                  onRemove={handleAvatarRemove}
                  uploading={uploading}
                />
              </div>

              <Button
                type="submit"
                className="w-full codeninja-gradient hover:shadow-lg transition-all duration-300"
                disabled={isLoading || uploading || loadingDepartments}
              >
                {isLoading ? "Creating Account..." : uploading ? "Uploading..." : loadingDepartments ? "Loading..." : "Register for CodeNinja Hub"}
              </Button>

              <div className="text-center">
                <Link href="/" className="text-sm text-slate-400 hover:text-white transition-colors">
                  ← Back to Login
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
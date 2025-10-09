"use client";

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { User, Save, EyeOff, Lock, Eye } from "lucide-react";
import Link from "next/link";
import { useUser } from "@/contexts/UserContext";
import { useAlert } from "@/contexts/AlertContext";
import Navigation from "@/components/Navigation";
import AvatarUpload from "@/components/AvatarUpload";

interface Department {
  id: string;
  name: string;
}

interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  gender: string;
  age: number | null;
  phone: string | null;
  departmentId: string | null;
  department: Department | null;
  avatarUrl: string | null;
  privacyHideAge: boolean;
  privacyHideGender: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function ProfilePage() {
  const { user, apiCall, updateUser, loading: userLoading } = useUser();
  const { showSuccess, showError } = useAlert();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Password change state
  const [changingPassword, setChangingPassword] = useState(false);
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  // Form state
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    gender: 'MALE',
    age: '',
    phone: '',
    departmentId: '',
    avatarUrl: '',
    privacyHideAge: false,
    privacyHideGender: false
  });

  useEffect(() => {
    // Only load data if user context is ready
    if (!userLoading) {
      if (user) {
        loadProfile();
        loadDepartments();
      } else {
        // User is not logged in, redirect to login
        window.location.href = '/auth/login';
        return;
      }
    }
  }, [user, userLoading]);

  const loadProfile = async () => {
    try {
      const response = await apiCall('/api/profile');
      if (response.ok) {
        const profileData = await response.json();
        setProfile(profileData);
        setFormData({
          firstName: profileData.firstName || '',
          lastName: profileData.lastName || '',
          gender: profileData.gender || 'MALE',
          age: profileData.age?.toString() || '',
          phone: profileData.phone || '',
          departmentId: profileData.departmentId || '',
          avatarUrl: profileData.avatarUrl || '',
          privacyHideAge: profileData.privacyHideAge || false,
          privacyHideGender: profileData.privacyHideGender || false
        });
      }
    } catch (error) {
      console.error('Failed to load profile:', error);
      showError('Failed to load profile data', 'Profile Error');
    } finally {
      setLoading(false);
    }
  };

  const loadDepartments = async () => {
    try {
      const response = await apiCall('/api/departments');
      if (response.ok) {
        const data = await response.json();
        setDepartments(Array.isArray(data) ? data : []);
      } else {
        setDepartments([]);
      }
    } catch (error) {
      console.error('Failed to load departments:', error);
      setDepartments([]);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const updateData: any = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        gender: formData.gender,
        age: formData.age ? parseInt(formData.age) : null,
        phone: formData.phone || null,
        departmentId: formData.departmentId || null,
        avatarUrl: formData.avatarUrl || null,
        privacyHideAge: formData.privacyHideAge,
        privacyHideGender: formData.privacyHideGender
      };

      const response = await apiCall('/api/profile', {
        method: 'PATCH',
        body: JSON.stringify(updateData)
      });

      if (response.ok) {
        const result = await response.json();
        setProfile(result.user);
        // Update the user context with the new profile data
        updateUser(result.user);
        showSuccess('Profile updated successfully!', 'Success');
      } else {
        const errorData = await response.json();
        showError(errorData.error || 'Failed to update profile', 'Update Failed');
      }
    } catch (error) {
      console.error('Failed to update profile:', error);
      showError('Failed to update profile. Please try again.', 'Update Failed');
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (file: File) => {
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('avatar', file);

      const response = await apiCall('/api/upload/avatar', {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        const result = await response.json();
        setProfile(result.user);
        setFormData(prev => ({
          ...prev,
          avatarUrl: result.avatarUrl
        }));
        // Update the user context with the new avatar
        updateUser({ avatarUrl: result.avatarUrl });
        showSuccess('Avatar updated successfully!', 'Success');
      } else {
        const errorData = await response.json();
        showError(errorData.error || 'Failed to upload avatar', 'Upload Failed');
      }
    } catch (error) {
      console.error('Failed to upload avatar:', error);
      showError('Failed to upload avatar. Please try again.', 'Upload Failed');
    } finally {
      setUploading(false);
    }
  };

  const handlePasswordChange = (field: string, value: string) => {
    setPasswordData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const togglePasswordVisibility = (field: 'current' | 'new' | 'confirm') => {
    setShowPasswords(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      showError('New passwords do not match', 'Password Error');
      return;
    }

    if (passwordData.newPassword.length < 6) {
      showError('New password must be at least 6 characters long', 'Password Error');
      return;
    }

    setChangingPassword(true);
    try {
      const response = await apiCall('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword
        })
      });

      if (response.ok) {
        showSuccess('Password changed successfully!', 'Success');
        setPasswordData({
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        });
      } else {
        const errorData = await response.json();
        showError(errorData.error || 'Failed to change password', 'Password Change Failed');
      }
    } catch (error) {
      console.error('Failed to change password:', error);
      showError('Failed to change password. Please try again.', 'Password Change Failed');
    } finally {
      setChangingPassword(false);
    }
  };

  if (userLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p>Loading user data...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-white">Redirecting to login...</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <Navigation />
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-white text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
              <p>Loading profile...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <Navigation currentPage="profile" />
      
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">My Profile</h1>
          <p className="text-slate-300">Manage your account information and preferences</p>
        </div>


        <div className="grid lg:grid-cols-3 gap-6 max-w-7xl items-start">
          {/* Avatar Section */}
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <div className="flex items-center space-x-3">
                <div className="h-10 w-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                  <User className="h-5 w-5 text-green-400" />
                </div>
                <div>
                  <CardTitle className="text-white">Avatar</CardTitle>
                  <CardDescription className="text-slate-300">
                    Update your profile picture
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <AvatarUpload
                currentAvatarUrl={profile?.avatarUrl}
                onUpload={handleAvatarUpload}
                uploading={uploading}
              />
            </CardContent>
          </Card>

          {/* Personal Information Section */}
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <div className="flex items-center space-x-3">
                <div className="h-10 w-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                  <User className="h-5 w-5 text-blue-400" />
                </div>
                <div>
                  <CardTitle className="text-white">Personal Information</CardTitle>
                  <CardDescription className="text-slate-300">
                    Update your personal details and preferences
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      First Name *
                    </label>
                    <Input
                      type="text"
                      value={formData.firstName}
                      onChange={(e) => handleInputChange('firstName', e.target.value)}
                      className="bg-slate-700/50 border-slate-600 text-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Last Name *
                    </label>
                    <Input
                      type="text"
                      value={formData.lastName}
                      onChange={(e) => handleInputChange('lastName', e.target.value)}
                      className="bg-slate-700/50 border-slate-600 text-white"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Email Address
                  </label>
                  <Input
                    type="email"
                    value={profile?.email || ''}
                    className="bg-slate-700/30 border-slate-600 text-slate-400"
                    disabled
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck="false"
                  />
                  <p className="text-xs text-slate-400 mt-1">Email cannot be changed</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Gender *
                  </label>
                  <select
                    value={formData.gender}
                    onChange={(e) => handleInputChange('gender', e.target.value)}
                    className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Age
                  </label>
                  <Input
                    type="number"
                    min="0"
                    max="150"
                    value={formData.age}
                    onChange={(e) => handleInputChange('age', e.target.value)}
                    className="bg-slate-700/50 border-slate-600 text-white"
                    placeholder="Optional"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Phone Number
                  </label>
                  <Input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    className="bg-slate-700/50 border-slate-600 text-white"
                    placeholder="Optional"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Department
                  </label>
                  <select
                    value={formData.departmentId}
                    onChange={(e) => handleInputChange('departmentId', e.target.value)}
                    className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select Department (Optional)</option>
                    {departments && Array.isArray(departments) && departments.map((dept) => (
                      <option key={dept.id} value={dept.id}>
                        {dept.name}
                      </option>
                    ))}
                  </select>
                </div>


                <div className="border-t border-slate-700 pt-6">
                  <h3 className="text-lg font-semibold text-white mb-4">Privacy Settings</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <EyeOff className="h-4 w-4 text-slate-400" />
                        <div>
                          <p className="text-white font-medium">Hide Age</p>
                          <p className="text-sm text-slate-400">Don't show your age to other users</p>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.privacyHideAge}
                          onChange={(e) => handleInputChange('privacyHideAge', e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-slate-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <EyeOff className="h-4 w-4 text-slate-400" />
                        <div>
                          <p className="text-white font-medium">Hide Gender</p>
                          <p className="text-sm text-slate-400">Don't show your gender to other users</p>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.privacyHideGender}
                          onChange={(e) => handleInputChange('privacyHideGender', e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-slate-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-6">
                  <Button type="submit" disabled={saving || uploading} className="bg-blue-600 hover:bg-blue-700">
                    <Save className="h-4 w-4 mr-2" />
                    {saving ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Security Section */}
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="h-10 w-10 rounded-lg bg-red-500/20 flex items-center justify-center">
                    <Lock className="h-5 w-5 text-red-400" />
                  </div>
                  <div>
                    <CardTitle className="text-white">Security</CardTitle>
                    <CardDescription className="text-slate-300">
                      Change your account password
                    </CardDescription>
                  </div>
                </div>
              </div>
            </CardHeader>
            
            <CardContent>
                <form onSubmit={handleChangePassword} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Current Password
                    </label>
                    <div className="relative">
                      <Input
                        type={showPasswords.current ? "text" : "password"}
                        value={passwordData.currentPassword}
                        onChange={(e) => handlePasswordChange('currentPassword', e.target.value)}
                        className="bg-slate-700/50 border-slate-600 text-white pr-10"
                        placeholder="Enter your current password"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => togglePasswordVisibility('current')}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-300"
                      >
                        {showPasswords.current ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      New Password
                    </label>
                    <div className="relative">
                      <Input
                        type={showPasswords.new ? "text" : "password"}
                        value={passwordData.newPassword}
                        onChange={(e) => handlePasswordChange('newPassword', e.target.value)}
                        className="bg-slate-700/50 border-slate-600 text-white pr-10"
                        placeholder="Enter your new password"
                        minLength={6}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => togglePasswordVisibility('new')}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-300"
                      >
                        {showPasswords.new ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">Password must be at least 6 characters long</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Confirm New Password
                    </label>
                    <div className="relative">
                      <Input
                        type={showPasswords.confirm ? "text" : "password"}
                        value={passwordData.confirmPassword}
                        onChange={(e) => handlePasswordChange('confirmPassword', e.target.value)}
                        className="bg-slate-700/50 border-slate-600 text-white pr-10"
                        placeholder="Confirm your new password"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => togglePasswordVisibility('confirm')}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-300"
                      >
                        {showPasswords.confirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex justify-end space-x-4 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setPasswordData({
                          currentPassword: '',
                          newPassword: '',
                          confirmPassword: ''
                        });
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={changingPassword}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      <Lock className="h-4 w-4 mr-2" />
                      {changingPassword ? 'Changing...' : 'Change Password'}
                    </Button>
                  </div>
                </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
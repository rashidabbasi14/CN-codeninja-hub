
"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Shield,
  Flag,
  Trash2,
  Ban,
  Unlock,
  MessageSquare,
  User,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Eye,
  FileText,
  Filter,
  ChevronLeft,
  ChevronRight,
  Search,
  X,
  Users,
  Settings,
  UserCog,
  UserPlus,
  Mail,
  Building,
  Phone,
  Edit
} from "lucide-react";
import Navigation from "@/components/Navigation";
import AdminNavbar from "@/components/AdminNavbar";
import { useUser } from "@/contexts/UserContext";
import { canDelete, hasAdminAccess } from "@/lib/auth";

interface ReportedContent {
  id: string;
  postId?: string;
  type: 'post' | 'comment';
  content: string;
  author: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  reportedBy: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  reason: string;
  createdAt: string;
  status: 'pending' | 'resolved' | 'dismissed';
}

interface BlockedUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  jobTitle?: string;
  isBlocked: boolean;
  blockedAt?: string;
  blockedReason?: string;
  role?: string;
  department?: string;
  createdAt?: string;
  isEmailVerified?: boolean;
}

interface AuditLog {
  id: string;
  action: string;
  entity: string;
  entityId: string;
  actor: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: string;
  };
  payload: any;
  createdAt: string;
}

interface AuditResponse {
  auditLogs: AuditLog[];
  pagination: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  filters: {
    actions: string[];
    entities: string[];
    users: {
      id: string;
      name: string;
      email: string;
    }[];
  };
}

function ModerationContent() {
  const { apiCall, user: currentUser, loading: userLoading } = useUser();
  const [reports, setReports] = useState<ReportedContent[]>([]);
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [allUsers, setAllUsers] = useState<BlockedUser[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditPagination, setAuditPagination] = useState({
    page: 0,
    limit: 50,
    totalCount: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false
  });
  const [auditFilters, setAuditFilters] = useState({
    actions: [] as string[],
    entities: [] as string[],
    users: [] as { id: string; name: string; email: string; }[]
  });
  const [selectedAction, setSelectedAction] = useState('ALL');
  const [selectedEntity, setSelectedEntity] = useState('ALL');
  const [selectedUser, setSelectedUser] = useState('ALL');
  const [selectedRole, setSelectedRole] = useState('ALL');
  const [selectedTimeWindow, setSelectedTimeWindow] = useState('ALL');
  const [entriesPerPage, setEntriesPerPage] = useState(25);
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [roleModalUser, setRoleModalUser] = useState<BlockedUser | null>(null);
  const [newRole, setNewRole] = useState("");
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<BlockedUser | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [addUserForm, setAddUserForm] = useState({
    email: '',
    firstName: '',
    lastName: '',
    phone: '',
    gender: 'MALE',
    department: '',
    password: '',
    role: 'USER',
    isEmailVerified: false
  });
  const [addUserLoading, setAddUserLoading] = useState(false);
  const [addUserError, setAddUserError] = useState('');
  const [departments, setDepartments] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [departmentFilter, setDepartmentFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('name');
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const userDropdownRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<'reports' | 'users' | 'audit'>('reports');
  
  // User management filters
  const [userFilter, setUserFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'users') {
      setActiveTab('users');
    } else if (tabParam === 'audit') {
      setActiveTab('audit');
    }
  }, [searchParams]);

  useEffect(() => {
    if (!userLoading) {
      if (currentUser) {
        if (currentUser.role !== 'ADMIN' && currentUser.role !== 'MODERATOR') {
          window.location.href = '/dashboard';
          return;
        }
        loadModerationData();
        loadDepartments();
      } else {
        // User is not logged in, redirect to login
        window.location.href = '/auth/login';
        return;
      }
    }
  }, [userLoading, currentUser]);

  const loadDepartments = async () => {
    try {
      const response = await apiCall('/api/departments');
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data)) {
          setDepartments(data.map((dept: any) => dept.name));
        }
      }
    } catch (error) {
      console.error('Failed to load departments:', error);
      // Fallback departments
      setDepartments([
        "Engineering",
        "Product Management",
        "Design",
        "Marketing",
        "Sales",
        "Operations",
        "HR",
        "Finance"
      ]);
    }
  };

  const loadModerationData = async () => {
    setLoading(true);
    try {
      const [reportsRes, blockedUsersRes, allUsersRes] = await Promise.all([
        apiCall('/api/admin/reports'),
        apiCall('/api/admin/users/blocked'),
        apiCall('/api/admin/users')
      ]);

      if (reportsRes.ok) {
        const reportsData = await reportsRes.json();
        setReports(reportsData);
      }

      if (blockedUsersRes.ok) {
        const usersData = await blockedUsersRes.json();
        setBlockedUsers(usersData);
      }

      if (allUsersRes.ok) {
        const allUsersData = await allUsersRes.json();
        setAllUsers(allUsersData);
      }
    } catch (error) {
      console.error('Failed to load moderation data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAuditLogs = async (page = 0, action = 'ALL', entity = 'ALL', user = 'ALL', role = 'ALL', timeWindow = 'ALL', limit = entriesPerPage) => {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString()
      });
      
      if (action !== 'ALL') params.append('action', action);
      if (entity !== 'ALL') params.append('entity', entity);
      if (user !== 'ALL') params.append('actorId', user);
      if (role !== 'ALL') params.append('role', role);
      if (timeWindow !== 'ALL') {
        const now = new Date();
        let startDate = new Date();
        
        switch (timeWindow) {
          case '1h':
            startDate.setHours(now.getHours() - 1);
            break;
          case '24h':
            startDate.setDate(now.getDate() - 1);
            break;
          case '7d':
            startDate.setDate(now.getDate() - 7);
            break;
          case '30d':
            startDate.setDate(now.getDate() - 30);
            break;
        }
        
        params.append('startDate', startDate.toISOString());
        params.append('endDate', now.toISOString());
      }

      // Add timeout to prevent hanging requests
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const response = await apiCall(`/api/admin/audit?${params}`, {
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const data: AuditResponse = await response.json();
        setAuditLogs(data.auditLogs || []);
        setAuditPagination(data.pagination || {
          page: 0,
          limit: 25,
          totalCount: 0,
          totalPages: 0,
          hasNext: false,
          hasPrev: false
        });
        setAuditFilters(data.filters || {
          actions: [],
          entities: [],
          users: []
        });
      } else {
        console.error('Failed to load audit logs: HTTP', response.status);
        // Set empty data on error to prevent infinite loading
        setAuditLogs([]);
        setAuditPagination({
          page: 0,
          limit: 25,
          totalCount: 0,
          totalPages: 0,
          hasNext: false,
          hasPrev: false
        });
      }
    } catch (error) {
      console.error('Failed to load audit logs:', error);
      // Set empty data on error to prevent infinite loading
      setAuditLogs([]);
      setAuditPagination({
        page: 0,
        limit: 25,
        totalCount: 0,
        totalPages: 0,
        hasNext: false,
        hasPrev: false
      });
      setAuditFilters({
        actions: [],
        entities: [],
        users: []
      });
    }
  };

  const handleReport = async (reportId: string, action: 'resolve' | 'dismiss') => {
    try {
      const response = await apiCall(`/api/admin/reports/${reportId}`, {
        method: 'PATCH',
        body: JSON.stringify({ action }),
      });

      if (response.ok) {
        await loadModerationData();
      }
    } catch (error) {
      console.error('Failed to handle report:', error);
    }
  };

  const deleteContent = async (contentId: string, type: 'post' | 'comment') => {
    if (!confirm(`Are you sure you want to delete this ${type}?`)) return;

    try {
      const response = await apiCall(`/api/admin/${type}s/${contentId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await loadModerationData();
      }
    } catch (error) {
      console.error('Failed to delete content:', error);
    }
  };

  const toggleUserBlock = async (userId: string, block: boolean, reason?: string) => {
    try {
      const response = await apiCall(`/api/admin/users/${userId}/block`, {
        method: 'PATCH',
        body: JSON.stringify({
          block,
          reason: reason || (block ? 'No reason provided' : 'Unblocked by admin')
        }),
      });

      if (response.ok) {
        await loadModerationData();
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Failed to toggle user block:', errorData);
        alert(`Failed to ${block ? 'block' : 'unblock'} user: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to toggle user block:', error);
      alert(`Failed to ${block ? 'block' : 'unblock'} user. Please try again.`);
    }
  };

  const handleSetRole = (user: BlockedUser) => {
    setRoleModalUser(user);
    setNewRole(user.role || 'USER');
    setShowRoleModal(true);
  };

  const setUserRole = async () => {
    if (!roleModalUser || !newRole) return;

    try {
      const response = await apiCall(`/api/admin/users/${roleModalUser.id}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role: newRole }),
      });

      if (response.ok) {
        setShowRoleModal(false);
        setRoleModalUser(null);
        setNewRole("");
        await loadModerationData();
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Failed to update user role:', errorData);
        alert(`Failed to update user role: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to update user role:', error);
      alert('Failed to update user role. Please try again.');
    }
  };

  const verifyUserEmail = async (userId: string, userName: string) => {
    if (!confirm(`Are you sure you want to verify the email for ${userName}?`)) return;

    try {
      const response = await apiCall(`/api/admin/users/${userId}/verify-email`, {
        method: 'PATCH',
      });

      if (response.ok) {
        await loadModerationData();
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Failed to verify user email:', errorData);
        alert(`Failed to verify email: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to verify user email:', error);
      alert('Failed to verify email. Please try again.');
    }
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const email = e.target.value;
    setAddUserForm(prev => ({ ...prev, email }));
    setAddUserError('');

    // Auto-populate name fields from email
    if (email.includes('@')) {
      const emailPrefix = email.split('@')[0];
      if (emailPrefix.includes('_')) {
        const [firstName, lastName] = emailPrefix.split('_');
        if (firstName && lastName) {
          setAddUserForm(prev => ({
            ...prev,
            firstName: firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase(),
            lastName: lastName.charAt(0).toUpperCase() + lastName.slice(1).toLowerCase()
          }));
        }
      } else if (emailPrefix.includes('.')) {
        const [firstName, lastName] = emailPrefix.split('.');
        if (firstName && lastName) {
          setAddUserForm(prev => ({
            ...prev,
            firstName: firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase(),
            lastName: lastName.charAt(0).toUpperCase() + lastName.slice(1).toLowerCase()
          }));
        }
      }
    }
  };

  const handleEditUser = (user: BlockedUser) => {
    setEditingUser(user);
    setIsEditMode(true);
    setAddUserForm({
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone || '',
      gender: 'MALE', // Default since we don't store gender in BlockedUser interface
      department: user.department || '',
      password: '',
      role: user.role || 'USER',
      isEmailVerified: user.isEmailVerified || false
    });
    setShowAddUserModal(true);
  };

  const handleAddUser = async () => {
    setAddUserLoading(true);
    setAddUserError('');

    // Validation
    if (!addUserForm.email.trim()) {
      setAddUserError('Email is required');
      setAddUserLoading(false);
      return;
    }
    if (!addUserForm.firstName.trim() || !addUserForm.lastName.trim()) {
      setAddUserError('First name and last name are required');
      setAddUserLoading(false);
      return;
    }
    if (!addUserForm.department) {
      setAddUserError('Department is required');
      setAddUserLoading(false);
      return;
    }

    try {
      const url = isEditMode && editingUser
        ? `/api/admin/users?id=${editingUser.id}`
        : '/api/admin/users';
      
      const method = isEditMode ? 'PUT' : 'POST';

      const response = await apiCall(url, {
        method,
        body: JSON.stringify(addUserForm)
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          // Reset form and close modal
          setAddUserForm({
            email: '',
            firstName: '',
            lastName: '',
            phone: '',
            gender: 'MALE',
            department: '',
            password: '',
            role: 'USER',
            isEmailVerified: false
          });
          setShowAddUserModal(false);
          setIsEditMode(false);
          setEditingUser(null);
          // Reload users data
          await loadModerationData();
        } else {
          setAddUserError(data.error || `Failed to ${isEditMode ? 'update' : 'create'} user`);
        }
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        setAddUserError(errorData.error || `Failed to ${isEditMode ? 'update' : 'create'} user`);
      }
    } catch (error) {
      console.error(`Failed to ${isEditMode ? 'update' : 'create'} user:`, error);
      setAddUserError(`Failed to ${isEditMode ? 'update' : 'create'} user. Please try again.`);
    } finally {
      setAddUserLoading(false);
    }
  };

  const deleteUser = async (userId: string, userName: string) => {
    if (!confirm(`Are you sure you want to permanently delete ${userName}? This action cannot be undone.`)) return;

    try {
      const response = await apiCall(`/api/admin/users/${userId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await loadModerationData();
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Failed to delete user:', errorData);
        alert(`Failed to delete user: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to delete user:', error);
      alert('Failed to delete user. Please try again.');
    }
  };

  const deleteAllUsers = async () => {
    const userCount = allUsers.filter(u => u.id !== currentUser?.id).length;
    
    if (userCount === 0) {
      alert('No users to delete.');
      return;
    }

    const confirmMessage = `⚠️ DANGER: This will permanently delete ALL ${userCount} users and their related data including:
    
• Posts and comments
• Game registrations and matches
• Team memberships
• Reactions and interactions
• All user-generated content

This action CANNOT be undone!

Type "DELETE ALL USERS" to confirm:`;

    const userInput = prompt(confirmMessage);
    
    if (userInput !== 'DELETE ALL USERS') {
      alert('Deletion cancelled. You must type "DELETE ALL USERS" exactly to confirm.');
      return;
    }

    const finalConfirm = confirm(`Final confirmation: Delete ${userCount} users and ALL their data?`);
    if (!finalConfirm) return;

    try {
      const response = await apiCall('/api/admin/users?action=delete-all', {
        method: 'DELETE',
        body: JSON.stringify({ confirmed: true }),
      });

      if (response.ok) {
        const result = await response.json();
        alert(`✅ Successfully deleted ${result.deletedCount} users and all their related data.`);
        await loadModerationData();
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Failed to delete all users:', errorData);
        alert(`❌ Failed to delete users: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to delete all users:', error);
      alert('❌ Failed to delete users. Please try again.');
    }
  };

  const handleAuditFilterChange = (filterType: 'action' | 'entity' | 'user' | 'role' | 'timeWindow' | 'entries', value: string) => {
    if (filterType === 'action') {
      setSelectedAction(value);
      loadAuditLogs(0, value, selectedEntity, selectedUser, selectedRole, selectedTimeWindow, entriesPerPage);
    } else if (filterType === 'entity') {
      setSelectedEntity(value);
      loadAuditLogs(0, selectedAction, value, selectedUser, selectedRole, selectedTimeWindow, entriesPerPage);
    } else if (filterType === 'user') {
      setSelectedUser(value);
      setUserSearchTerm(value === 'ALL' ? '' : auditFilters.users.find(u => u.id === value)?.name || '');
      setShowUserDropdown(false);
      loadAuditLogs(0, selectedAction, selectedEntity, value, selectedRole, selectedTimeWindow, entriesPerPage);
    } else if (filterType === 'role') {
      setSelectedRole(value);
      loadAuditLogs(0, selectedAction, selectedEntity, selectedUser, value, selectedTimeWindow, entriesPerPage);
    } else if (filterType === 'timeWindow') {
      setSelectedTimeWindow(value);
      loadAuditLogs(0, selectedAction, selectedEntity, selectedUser, selectedRole, value, entriesPerPage);
    } else if (filterType === 'entries') {
      const newLimit = parseInt(value);
      setEntriesPerPage(newLimit);
      loadAuditLogs(0, selectedAction, selectedEntity, selectedUser, selectedRole, selectedTimeWindow, newLimit);
    }
  };

  const auditFilteredUsers = auditFilters.users.filter(user =>
    user.name.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(userSearchTerm.toLowerCase())
  );

  const handleUserSearch = (searchTerm: string) => {
    setUserSearchTerm(searchTerm);
    setShowUserDropdown(true);
    if (searchTerm === '') {
      setSelectedUser('ALL');
      loadAuditLogs(0, selectedAction, selectedEntity, 'ALL');
    }
  };

  const selectUser = (user: { id: string; name: string; email: string } | null) => {
    if (user) {
      setSelectedUser(user.id);
      setUserSearchTerm(user.name);
      loadAuditLogs(0, selectedAction, selectedEntity, user.id);
    } else {
      setSelectedUser('ALL');
      setUserSearchTerm('');
      loadAuditLogs(0, selectedAction, selectedEntity, 'ALL');
    }
    setShowUserDropdown(false);
  };

  const handleAuditPageChange = (newPage: number) => {
    loadAuditLogs(newPage, selectedAction, selectedEntity, selectedUser, selectedRole, selectedTimeWindow, entriesPerPage);
  };

  const formatAuditAction = (action: string) => {
    if (action.includes('.')) {
      const [entity, verb] = action.split('.');
      return `${verb.charAt(0).toUpperCase() + verb.slice(1).toLowerCase()} ${entity.charAt(0).toUpperCase() + entity.slice(1).toLowerCase()}`;
    } else {
      return action.split('_').map(word =>
        word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
      ).join(' ');
    }
  };

  const getEntityColor = (entity: string) => {
    switch (entity.toLowerCase()) {
      case 'user':
        return 'text-blue-400 bg-blue-500/20';
      case 'post':
      case 'comment':
        return 'text-purple-400 bg-purple-500/20';
      case 'game':
        return 'text-green-400 bg-green-500/20';
      case 'team':
        return 'text-orange-400 bg-orange-500/20';
      case 'event':
      case 'category':
        return 'text-cyan-400 bg-cyan-500/20';
      case 'registration':
        return 'text-emerald-400 bg-emerald-500/20';
      case 'schedule':
      case 'match':
        return 'text-indigo-400 bg-indigo-500/20';
      case 'department':
        return 'text-teal-400 bg-teal-500/20';
      case 'email':
      case 'template':
        return 'text-pink-400 bg-pink-500/20';
      case 'system':
      case 'settings':
        return 'text-gray-400 bg-gray-500/20';
      default:
        return 'text-slate-400 bg-slate-500/20';
    }
  };

  // Legacy function for backward compatibility, now uses entity-based colors
  const getActionColor = (action: string, entity?: string) => {
    // If entity is provided, use entity-based coloring
    if (entity) {
      return getEntityColor(entity);
    }
    
    // Fallback to action-based coloring for legacy actions without entity info
    switch (action) {
      case 'BLOCK_USER':
      case 'DELETE_POST':
      case 'DELETE_COMMENT':
        return 'text-red-400 bg-red-500/20';
      case 'UNBLOCK_USER':
      case 'RESOLVE_REPORT':
        return 'text-green-400 bg-green-500/20';
      case 'FLAG_POST':
      case 'FLAG_COMMENT':
        return 'text-yellow-400 bg-yellow-500/20';
      case 'DISMISS_REPORT':
        return 'text-gray-400 bg-gray-500/20';
      default:
        return 'text-blue-400 bg-blue-500/20';
    }
  };

  useEffect(() => {
    if (activeTab === 'audit' && auditLogs.length === 0) {
      loadAuditLogs();
    }
  }, [activeTab]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userDropdownRef.current && !userDropdownRef.current.contains(event.target as Node)) {
        setShowUserDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
  };

  const getFilteredUsers = () => {
    let users = allUsers;
    
    // Status filter
    switch (statusFilter) {
      case 'ACTIVE':
        users = users.filter(u => !u.isBlocked);
        break;
      case 'BLOCKED':
        users = users.filter(u => u.isBlocked);
        break;
      default:
        break;
    }
    
    // Role filter
    if (roleFilter !== 'ALL') {
      users = users.filter(u => u.role === roleFilter);
    }
    
    // Department filter
    if (departmentFilter !== 'ALL') {
      users = users.filter(u => u.department === departmentFilter);
    }
    
    // Search filter
    if (searchQuery) {
      users = users.filter(u =>
        u.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.lastName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (u.department && u.department.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }
    
    // Sort users
    users.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
        case 'recently_added':
          return new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime();
        case 'email':
          return a.email.localeCompare(b.email);
        case 'role':
          return (a.role || 'USER').localeCompare(b.role || 'USER');
        case 'department':
          return (a.department || '').localeCompare(b.department || '');
        default:
          return 0;
      }
    });
    
    return users;
  };

  // Get unique departments for filter dropdown
  const uniqueDepartments = [...new Set(allUsers.map(user => user.department).filter(Boolean))];

  const pendingReports = Array.isArray(reports) ? reports.filter(r => r.status === 'pending') : [];
  const resolvedReports = Array.isArray(reports) ? reports.filter(r => r.status === 'resolved') : [];
  const displayUsers = getFilteredUsers();

  if (loading || userLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-white">Loading moderation data...</div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-white">Please log in to access the admin panel.</div>
      </div>
    );
  }

  if (currentUser.role !== 'ADMIN' && currentUser.role !== 'MODERATOR') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-white">Access denied. Admin or Moderator privileges required.</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <Navigation currentPage="admin" />
      <AdminNavbar />

      <div className="border-b border-slate-700/50 bg-slate-900/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center space-x-2">
            <Shield className="h-6 w-6 sm:h-8 sm:w-8 text-red-400" />
            <span>Content Moderation</span>
          </h1>
          <p className="text-slate-400 text-sm sm:text-base">Manage reported content and user safety</p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-4 sm:py-8">
        <div className="space-y-4 sm:space-y-6">
          {/* Tab Navigation */}
          <div className="flex flex-col sm:flex-row space-y-1 sm:space-y-0 sm:space-x-1 bg-slate-800/50 p-1 rounded-lg w-full sm:w-fit">
            <Button
              variant={activeTab === 'reports' ? 'default' : 'ghost'}
              onClick={() => setActiveTab('reports')}
              className="flex items-center justify-center sm:justify-start space-x-2 w-full sm:w-auto text-sm"
            >
              <Flag className="h-4 w-4" />
              <span className="hidden xs:inline">Reports ({pendingReports.length})</span>
              <span className="xs:hidden">Reports</span>
            </Button>
            <Button
              variant={activeTab === 'users' ? 'default' : 'ghost'}
              onClick={() => setActiveTab('users')}
              className="flex items-center justify-center sm:justify-start space-x-2 w-full sm:w-auto text-sm"
            >
              <Users className="h-4 w-4" />
              <span className="hidden xs:inline">All Users ({allUsers.length})</span>
              <span className="xs:hidden">Users</span>
            </Button>
            <Button
              variant={activeTab === 'audit' ? 'default' : 'ghost'}
              onClick={() => setActiveTab('audit')}
              className="flex items-center justify-center sm:justify-start space-x-2 w-full sm:w-auto text-sm"
            >
              <FileText className="h-4 w-4" />
              <span>Audit Logs</span>
            </Button>
          </div>

          {/* Reports Tab */}
          {activeTab === 'reports' && (
            <div className="space-y-6">
              {/* Header with Stats */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
                <div className="flex items-center space-x-2">
                  <Flag className="h-5 w-5 text-red-400" />
                  <h2 className="text-lg font-semibold text-white">Content Reports</h2>
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-sm text-slate-400">
                  <span>Pending: {pendingReports.length}</span>
                  <span>Resolved: {resolvedReports.length}</span>
                  <span>Total: {reports.length}</span>
                </div>
              </div>

              {/* Pending Reports */}
              {pendingReports.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-white flex items-center space-x-2">
                    <AlertTriangle className="h-5 w-5 text-yellow-400" />
                    <span>Pending Reports ({pendingReports.length})</span>
                  </h3>
                  
                  {pendingReports.map((report) => (
                    <Card key={report.id} className="bg-slate-800/50 border-slate-700 border-l-4 border-l-yellow-400">
                      <CardContent className="p-4">
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between space-y-4 sm:space-y-0">
                          <div className="flex-1 space-y-3">
                            {/* Report Header */}
                            <div className="flex items-center space-x-3">
                              <div className="flex items-center space-x-2">
                                {report.type === 'post' ? (
                                  <MessageSquare className="h-4 w-4 text-blue-400" />
                                ) : (
                                  <MessageSquare className="h-4 w-4 text-green-400" />
                                )}
                                <span className="text-sm font-medium text-slate-300 capitalize">
                                  {report.type} Report
                                </span>
                              </div>
                              <span className="px-2 py-1 text-xs bg-yellow-500/20 text-yellow-400 rounded">
                                PENDING
                              </span>
                            </div>

                            {/* Reported Content */}
                            <div className="bg-slate-700/50 rounded p-3">
                              <h4 className="text-sm font-medium text-slate-300 mb-2">Reported Content:</h4>
                              <p className="text-slate-400 text-sm break-words">
                                {report.content.length > 200
                                  ? `${report.content.substring(0, 200)}...`
                                  : report.content}
                              </p>
                            </div>

                            {/* Report Details */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-sm">
                              <div>
                                <span className="text-slate-400">Author:</span>
                                <div className="text-white">
                                  {report.author.firstName} {report.author.lastName}
                                </div>
                                <div className="text-slate-400 text-xs break-all">{report.author.email}</div>
                              </div>
                              <div>
                                <span className="text-slate-400">Reported by:</span>
                                <div className="text-white">
                                  {report.reportedBy.firstName} {report.reportedBy.lastName}
                                </div>
                                <div className="text-slate-400 text-xs break-all">{report.reportedBy.email}</div>
                              </div>
                              <div>
                                <span className="text-slate-400">Reason:</span>
                                <div className="text-white break-words">{report.reason}</div>
                              </div>
                              <div>
                                <span className="text-slate-400">Reported:</span>
                                <div className="text-white">{formatTimeAgo(report.createdAt)}</div>
                              </div>
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex flex-col sm:flex-col space-y-2 mt-4 sm:mt-0 sm:ml-4 w-full sm:w-auto">
                            <Button
                              size="sm"
                              onClick={() => handleReport(report.id, 'resolve')}
                              className="bg-green-600 hover:bg-green-700 text-white w-full sm:w-auto"
                            >
                              <CheckCircle className="h-4 w-4 mr-2" />
                              <span className="hidden xs:inline">Resolve</span>
                              <span className="xs:hidden">✓</span>
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleReport(report.id, 'dismiss')}
                              className="border-slate-600 text-slate-300 hover:bg-slate-700 w-full sm:w-auto"
                            >
                              <X className="h-4 w-4 mr-2" />
                              <span className="hidden xs:inline">Dismiss</span>
                              <span className="xs:hidden">✗</span>
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => deleteContent(report.postId || report.id, report.type)}
                              className="bg-red-600 hover:bg-red-700 text-white w-full sm:w-auto"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              <span className="hidden xs:inline">Delete</span>
                              <span className="xs:hidden">🗑</span>
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {/* Resolved Reports */}
              {resolvedReports.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-white flex items-center space-x-2">
                    <CheckCircle className="h-5 w-5 text-green-400" />
                    <span>Resolved Reports ({resolvedReports.length})</span>
                  </h3>
                  
                  {resolvedReports.slice(0, 5).map((report) => (
                    <Card key={report.id} className="bg-slate-800/30 border-slate-700 border-l-4 border-l-green-400">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center space-x-3">
                              <div className="flex items-center space-x-2">
                                {report.type === 'post' ? (
                                  <MessageSquare className="h-4 w-4 text-blue-400" />
                                ) : (
                                  <MessageSquare className="h-4 w-4 text-green-400" />
                                )}
                                <span className="text-sm font-medium text-slate-300 capitalize">
                                  {report.type} Report
                                </span>
                              </div>
                              <span className="px-2 py-1 text-xs bg-green-500/20 text-green-400 rounded">
                                RESOLVED
                              </span>
                            </div>

                            <div className="text-sm text-slate-400">
                              <span className="font-medium">Reason:</span> {report.reason}
                            </div>
                            <div className="text-xs text-slate-500">
                              Resolved {formatTimeAgo(report.createdAt)}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  
                  {resolvedReports.length > 5 && (
                    <div className="text-center text-slate-400 text-sm">
                      ... and {resolvedReports.length - 5} more resolved reports
                    </div>
                  )}
                </div>
              )}

              {/* No Reports */}
              {reports.length === 0 && (
                <Card className="bg-slate-800/50 border-slate-700">
                  <CardContent className="text-center py-12">
                    <Flag className="h-12 w-12 mx-auto mb-4 text-slate-400" />
                    <h3 className="text-lg font-medium text-white mb-2">No reports found</h3>
                    <p className="text-slate-400">No content has been reported yet.</p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Users Tab */}
          {activeTab === 'users' && (
            <div className="space-y-6">
              {/* Header with Stats */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
                <div className="flex items-center space-x-2">
                  <Users className="h-5 w-5 text-blue-400" />
                  <h2 className="text-lg font-semibold text-white">User Management</h2>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4">
                  <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm text-slate-400">
                    <span>Total: {allUsers.length}</span>
                    <span>Active: {allUsers.filter(u => !u.isBlocked).length}</span>
                    <span>Blocked: {allUsers.filter(u => u.isBlocked).length}</span>
                    <span className="text-yellow-400">Unverified: {allUsers.filter(u => u.isEmailVerified === false).length}</span>
                    <span className="hidden sm:inline">Admins: {allUsers.filter(u => u.role === 'ADMIN').length}</span>
                    <span className="hidden sm:inline">Moderators: {allUsers.filter(u => u.role === 'MODERATOR').length}</span>
                  </div>
                  {hasAdminAccess(currentUser) && (
                    <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                      <Button
                        onClick={() => setShowAddUserModal(true)}
                        className="bg-blue-600 hover:bg-blue-700 text-white flex items-center space-x-2 w-full sm:w-auto"
                      >
                        <UserPlus className="h-4 w-4" />
                        <span>Add User</span>
                      </Button>
                      {/* Only show Delete All Users button for ADMIN role, not MODERATOR */}
                      {currentUser?.role === 'ADMIN' && (
                        <Button
                          onClick={deleteAllUsers}
                          className="bg-red-600 hover:bg-red-700 text-white flex items-center space-x-2 w-full sm:w-auto"
                        >
                          <Trash2 className="h-4 w-4" />
                          <span>Delete All Users</span>
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Filters */}
              <Card className="bg-slate-800/50 border-slate-700">
                <CardContent className="p-4">
                  <div className="space-y-4">
                    {/* Filter Header */}
                    <div className="flex items-center space-x-2">
                      <Filter className="h-4 w-4 text-slate-400" />
                      <span className="text-sm font-medium text-slate-300">Filters:</span>
                    </div>
                    
                    {/* Filters Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {/* Status Filter */}
                      <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="bg-slate-700 border border-slate-600 text-white text-sm rounded px-3 py-2 w-full"
                      >
                        <option value="ALL">All Status</option>
                        <option value="ACTIVE">Active</option>
                        <option value="BLOCKED">Blocked</option>
                      </select>
                      
                      {/* Role Filter */}
                      <select
                        value={roleFilter}
                        onChange={(e) => setRoleFilter(e.target.value)}
                        className="bg-slate-700 border border-slate-600 text-white text-sm rounded px-3 py-2 w-full"
                      >
                        <option value="ALL">All Roles</option>
                        <option value="USER">Users</option>
                        <option value="MODERATOR">Moderators</option>
                        <option value="ADMIN">Admins</option>
                      </select>
                      
                      {/* Department Filter */}
                      <select
                        value={departmentFilter}
                        onChange={(e) => setDepartmentFilter(e.target.value)}
                        className="bg-slate-700 border border-slate-600 text-white text-sm rounded px-3 py-2 w-full"
                      >
                        <option value="ALL">All Departments</option>
                        {uniqueDepartments.map(dept => (
                          <option key={dept} value={dept}>{dept}</option>
                        ))}
                      </select>
                    </div>
                    
                    {/* Sort and Search Row */}
                    <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
                      <div className="flex items-center space-x-2 sm:min-w-0">
                        <span className="text-sm font-medium text-slate-300 whitespace-nowrap">Sort:</span>
                        <select
                          value={sortBy}
                          onChange={(e) => setSortBy(e.target.value)}
                          className="bg-slate-700 border border-slate-600 text-white text-sm rounded px-3 py-2 flex-1 sm:min-w-[140px]"
                        >
                          <option value="name">Name (A-Z)</option>
                          <option value="recently_added">Recently Added</option>
                          <option value="email">Email (A-Z)</option>
                          <option value="role">Role</option>
                          <option value="department">Department</option>
                        </select>
                      </div>
                      
                      <div className="flex-1 relative">
                        <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                        <Input
                          placeholder="Search users..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-10 bg-slate-700 border-slate-600 text-white placeholder-slate-400 w-full"
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Users List */}
              {displayUsers.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                  {displayUsers.map((user) => (
                    <Card key={user.id} className={`${
                      user.isBlocked
                        ? 'bg-red-500/10 border-red-500/30'
                        : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'
                    } transition-colors relative`}>
                      <CardContent className="p-3 sm:p-4">
                        <div className="space-y-3">
                          <div className="flex items-start space-x-3">
                            <div className={`h-8 w-8 sm:h-10 sm:w-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                              user.isBlocked
                                ? 'bg-red-500/20'
                                : user.role === 'ADMIN'
                                  ? 'bg-blue-500/20'
                                  : user.role === 'MODERATOR'
                                    ? 'bg-orange-500/20'
                                    : 'bg-green-500/20'
                            }`}>
                              {user.isBlocked ? (
                                <Ban className="h-4 w-4 sm:h-5 sm:w-5 text-red-400" />
                              ) : user.role === 'ADMIN' ? (
                                <Shield className="h-4 w-4 sm:h-5 sm:w-5 text-blue-400" />
                              ) : user.role === 'MODERATOR' ? (
                                <Settings className="h-4 w-4 sm:h-5 sm:w-5 text-orange-400" />
                              ) : (
                                <User className="h-4 w-4 sm:h-5 sm:w-5 text-green-400" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-2">
                                <h4 className="text-white font-medium text-sm sm:text-base truncate">
                                  {user.firstName} {user.lastName}
                                </h4>
                                <div className="flex flex-wrap gap-1 mt-1 sm:mt-0">
                                  {user.role === 'ADMIN' && (
                                    <span className="px-2 py-1 text-xs bg-blue-500/20 text-blue-400 rounded">
                                      ADMIN
                                    </span>
                                  )}
                                  {user.role === 'MODERATOR' && (
                                    <span className="px-2 py-1 text-xs bg-orange-500/20 text-orange-400 rounded">
                                      MODERATOR
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center space-x-2">
                                <p className="text-slate-400 text-xs sm:text-sm truncate">{user.email}</p>
                                {user.isEmailVerified === true ? (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/30">
                                    ✓
                                  </span>
                                ) : user.isEmailVerified === false ? (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                                    ⚠
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-gray-500/20 text-gray-400 border border-gray-500/30">
                                    ?
                                  </span>
                                )}
                              </div>
                              {user.phone && (
                                <p className="text-slate-400 text-xs sm:text-sm truncate">{user.phone}</p>
                              )}
                              {user.jobTitle && (
                                <p className="text-blue-400 text-xs sm:text-sm font-medium truncate">{user.jobTitle}</p>
                              )}
                              {user.department && (
                                <p className="text-slate-500 text-xs">{user.department}</p>
                              )}
                              {user.isBlocked && user.blockedReason && (
                                <p className="text-red-400 text-xs mt-1 break-words">
                                  Reason: {user.blockedReason}
                                </p>
                              )}
                              {user.createdAt && (
                                <p className="text-slate-500 text-xs">
                                  Joined: {formatTimeAgo(user.createdAt)}
                                </p>
                              )}
                            </div>
                            {/* Edit Icon - Top Right */}
                            <div className="absolute top-2 right-2">
                              {hasAdminAccess(currentUser) && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleEditUser(user)}
                                  className="h-8 w-8 p-0 text-slate-400 hover:text-white hover:bg-slate-700/50"
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        
                          {/* Action Buttons */}
                          <div className="flex flex-col sm:flex-row gap-2">
                            {/* Set Role Button - Only show for admins */}
                            {hasAdminAccess(currentUser) && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleSetRole(user)}
                                className="text-blue-400 hover:text-blue-300 border-blue-500/50 hover:bg-blue-500/10 w-full sm:w-auto text-xs sm:text-sm"
                              >
                                <UserCog className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                                <span className="hidden xs:inline">Set Role</span>
                                <span className="xs:hidden">Role</span>
                              </Button>
                            )}
                            
                            {/* Email Verification Button - Only show if email is not verified */}
                            {user.isEmailVerified === false && hasAdminAccess(currentUser) && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => verifyUserEmail(user.id, `${user.firstName} ${user.lastName}`)}
                                className="text-green-400 hover:text-green-300 border-green-500/50 hover:bg-green-500/10 w-full sm:w-auto text-xs sm:text-sm"
                              >
                                <Mail className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                                <span className="hidden xs:inline">Verify Email</span>
                                <span className="xs:hidden">Verify</span>
                              </Button>
                            )}
                            
                            {/* Block/Unblock Button */}
                            {user.role !== 'ADMIN' && (
                              user.isBlocked ? (
                                <Button
                                  size="sm"
                                  onClick={() => toggleUserBlock(user.id, false)}
                                  className="bg-green-600 hover:bg-green-700 text-white w-full sm:w-auto text-xs sm:text-sm"
                                >
                                  <Unlock className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                                  Unblock
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    const reason = prompt('Reason for blocking:');
                                    if (reason) toggleUserBlock(user.id, true, reason);
                                  }}
                                  className="text-orange-400 hover:text-orange-300 border-orange-500/50 hover:bg-orange-500/10 w-full sm:w-auto text-xs sm:text-sm"
                                >
                                  <Ban className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                                  <span className="hidden xs:inline">Block User</span>
                                  <span className="xs:hidden">Block</span>
                                </Button>
                              )
                            )}
                            
                            {/* Delete User Button */}
                            {user.role !== 'ADMIN' && canDelete(currentUser) && (
                              <Button
                                size="sm"
                                onClick={() => deleteUser(user.id, `${user.firstName} ${user.lastName}`)}
                                className="bg-red-600 hover:bg-red-700 text-white w-full sm:w-auto text-xs sm:text-sm"
                              >
                                <Trash2 className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                                <span className="hidden xs:inline">Delete User</span>
                                <span className="xs:hidden">Delete</span>
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card className="bg-slate-800/50 border-slate-700">
                  <CardContent className="text-center py-12">
                    <Users className="h-12 w-12 mx-auto mb-4 text-slate-400" />
                    <h3 className="text-lg font-medium text-white mb-2">No users found</h3>
                    <p className="text-slate-400">Try adjusting your filters or search query.</p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Audit Logs Tab */}
          {activeTab === 'audit' && (
            <div className="space-y-6">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
                <div className="flex items-center space-x-2">
                  <FileText className="h-5 w-5 text-blue-400" />
                  <h2 className="text-lg font-semibold text-white">Audit Logs</h2>
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm text-slate-400">
                  <span>Total: {auditPagination.totalCount}</span>
                  <span>Page: {auditPagination.page + 1} of {auditPagination.totalPages}</span>
                </div>
              </div>

              {/* Entity Color Legend */}
              <Card className="bg-slate-800/50 border-slate-700">
                <CardContent className="p-4">
                  <div className="flex items-center space-x-2 mb-3">
                    <div className="w-2 h-2 rounded-full bg-slate-400"></div>
                    <span className="text-sm font-medium text-white">Action Tag Colors by Entity Type</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 text-xs">
                    <div className="flex items-center space-x-2">
                      <div className="px-2 py-1 rounded-full text-blue-400 bg-blue-500/20 text-xs font-medium">User</div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="px-2 py-1 rounded-full text-green-400 bg-green-500/20 text-xs font-medium">Game</div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="px-2 py-1 rounded-full text-orange-400 bg-orange-500/20 text-xs font-medium">Team</div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="px-2 py-1 rounded-full text-cyan-400 bg-cyan-500/20 text-xs font-medium">Event</div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="px-2 py-1 rounded-full text-emerald-400 bg-emerald-500/20 text-xs font-medium">Registration</div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="px-2 py-1 rounded-full text-indigo-400 bg-indigo-500/20 text-xs font-medium">Schedule</div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="px-2 py-1 rounded-full text-purple-400 bg-purple-500/20 text-xs font-medium">Post</div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="px-2 py-1 rounded-full text-teal-400 bg-teal-500/20 text-xs font-medium">Department</div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="px-2 py-1 rounded-full text-pink-400 bg-pink-500/20 text-xs font-medium">Email</div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="px-2 py-1 rounded-full text-gray-400 bg-gray-500/20 text-xs font-medium">System</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Filters */}
              <Card className="bg-slate-800/50 border-slate-700">
                <CardContent className="p-4">
                  <div className="space-y-4">
                    {/* Filter Header */}
                    <div className="flex items-center space-x-2">
                      <Filter className="h-4 w-4 text-slate-400" />
                      <span className="text-sm font-medium text-slate-300">Filters:</span>
                    </div>
                    
                    {/* Filters Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                      {/* Entries Per Page Filter - First */}
                      <select
                        value={entriesPerPage}
                        onChange={(e) => handleAuditFilterChange('entries', e.target.value)}
                        className="bg-slate-700 border border-slate-600 text-white text-sm rounded px-3 py-2 w-full"
                      >
                        <option value={10}>10 entries</option>
                        <option value={25}>25 entries</option>
                        <option value={50}>50 entries</option>
                        <option value={100}>100 entries</option>
                      </select>

                      {/* Entity Filter */}
                      <select
                        value={selectedEntity}
                        onChange={(e) => handleAuditFilterChange('entity', e.target.value)}
                        className="bg-slate-700 border border-slate-600 text-white text-sm rounded px-3 py-2 w-full"
                      >
                        <option value="ALL">All Entities</option>
                        {auditFilters.entities.map(entity => (
                          <option key={entity} value={entity}>
                            {entity.charAt(0).toUpperCase() + entity.slice(1)}
                          </option>
                        ))}
                      </select>

                      {/* Action Filter */}
                      <select
                        value={selectedAction}
                        onChange={(e) => handleAuditFilterChange('action', e.target.value)}
                        className="bg-slate-700 border border-slate-600 text-white text-sm rounded px-3 py-2 w-full"
                      >
                        <option value="ALL">All Actions</option>
                        {auditFilters.actions.map(action => (
                          <option key={action} value={action}>{formatAuditAction(action)}</option>
                        ))}
                      </select>
                      
                      {/* Role Filter */}
                      <select
                        value={selectedRole}
                        onChange={(e) => handleAuditFilterChange('role', e.target.value)}
                        className="bg-slate-700 border border-slate-600 text-white text-sm rounded px-3 py-2 w-full"
                      >
                        <option value="ALL">All Roles</option>
                        <option value="ADMIN">Admin</option>
                        <option value="MODERATOR">Moderator</option>
                        <option value="USER">User</option>
                      </select>

                      {/* Time Window Filter */}
                      <select
                        value={selectedTimeWindow}
                        onChange={(e) => handleAuditFilterChange('timeWindow', e.target.value)}
                        className="bg-slate-700 border border-slate-600 text-white text-sm rounded px-3 py-2 w-full"
                      >
                        <option value="ALL">All Time</option>
                        <option value="1h">Last Hour</option>
                        <option value="24h">Last 24 Hours</option>
                        <option value="7d">Last 7 Days</option>
                        <option value="30d">Last 30 Days</option>
                      </select>
                      
                      {/* User Filter with Search */}
                      <div className="relative xl:col-span-2" ref={userDropdownRef}>
                        <div className="relative">
                          <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                          <Input
                            placeholder="Search users..."
                            value={userSearchTerm}
                            onChange={(e) => handleUserSearch(e.target.value)}
                            onFocus={() => setShowUserDropdown(true)}
                            className="pl-10 bg-slate-700 border-slate-600 text-white placeholder-slate-400 w-full"
                          />
                          {userSearchTerm && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => selectUser(null)}
                              className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0 text-slate-400 hover:text-white"
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                        
                        {showUserDropdown && auditFilteredUsers.length > 0 && (
                          <div className="absolute top-full left-0 right-0 mt-1 bg-slate-700 border border-slate-600 rounded-md shadow-lg z-10 max-h-48 overflow-y-auto">
                            {auditFilteredUsers.slice(0, 10).map(user => (
                              <button
                                key={user.id}
                                onClick={() => selectUser(user)}
                                className="w-full text-left px-3 py-2 hover:bg-slate-600 text-white text-sm border-b border-slate-600 last:border-b-0"
                              >
                                <div className="font-medium truncate">{user.name}</div>
                                <div className="text-xs text-slate-400 truncate">{user.email}</div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Audit Logs List */}
              {auditLogs.length > 0 ? (
                <div className="space-y-4">
                  {auditLogs.map((log) => (
                    <Card key={log.id} className="bg-slate-800/50 border-slate-700 hover:border-slate-600 transition-colors">
                      <CardContent className="p-3 sm:p-4">
                        <div className="space-y-3">
                          {/* Header Row */}
                          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between space-y-2 sm:space-y-0">
                            <div className="flex flex-col space-y-2">
                              {/* Action Badge */}
                              <div className={`px-2 sm:px-3 py-1 rounded-full text-xs font-medium self-start ${getActionColor(log.action, log.entity)}`}>
                                {formatAuditAction(log.action)}
                              </div>
                              
                              {/* Actor Info */}
                              <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-2 space-y-1 sm:space-y-0">
                                <span className="text-white font-medium text-sm">
                                  {log.actor.firstName} {log.actor.lastName}
                                </span>
                                <span className="text-slate-400 text-xs sm:text-sm break-all">({log.actor.email})</span>
                                <span className={`px-2 py-1 text-xs rounded self-start ${
                                  log.actor.role === 'ADMIN'
                                    ? 'bg-blue-500/20 text-blue-400'
                                    : log.actor.role === 'MODERATOR'
                                      ? 'bg-orange-500/20 text-orange-400'
                                      : 'bg-green-500/20 text-green-400'
                                }`}>
                                  {log.actor.role}
                                </span>
                              </div>
                            </div>
                            
                            {/* Timestamp */}
                            <div className="text-xs text-slate-400 sm:text-right sm:ml-4 flex-shrink-0">
                              <div className="font-medium">{formatTimeAgo(log.createdAt)}</div>
                              <div className="hidden sm:block mt-1">
                                {new Date(log.createdAt).toLocaleDateString()} {new Date(log.createdAt).toLocaleTimeString()}
                              </div>
                            </div>
                          </div>
                          
                          {/* Entity Info */}
                          <div className="text-slate-300 text-sm">
                            <span className="font-medium">{log.entity}</span>
                            {log.entityId && (
                              <span className="text-slate-400 text-xs sm:text-sm"> (ID: {log.entityId})</span>
                            )}
                          </div>
                          
                          {/* Payload Details */}
                          {log.payload && Object.keys(log.payload).length > 0 && (
                            <div className="bg-slate-700/50 rounded p-2 sm:p-3">
                              <h4 className="text-xs font-medium text-slate-300 mb-2">Details:</h4>
                              <div className="text-xs text-slate-400 space-y-1">
                                {Object.entries(log.payload).map(([key, value]) => (
                                  <div key={key} className="flex flex-col sm:flex-row">
                                    <span className="font-medium text-slate-300 sm:min-w-[100px] mb-1 sm:mb-0">
                                      {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}:
                                    </span>
                                    <span className="sm:ml-2 break-all">
                                      {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  
                  {/* Pagination */}
                  {auditPagination.totalPages > 1 && (
                    <Card className="bg-slate-800/50 border-slate-700">
                      <CardContent className="p-3 sm:p-4">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
                          <div className="text-xs sm:text-sm text-slate-400 text-center sm:text-left">
                            Showing {auditPagination.page * auditPagination.limit + 1} to{' '}
                            {Math.min((auditPagination.page + 1) * auditPagination.limit, auditPagination.totalCount)} of{' '}
                            {auditPagination.totalCount} entries
                          </div>
                          
                          <div className="flex items-center justify-center space-x-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleAuditPageChange(auditPagination.page - 1)}
                              disabled={!auditPagination.hasPrev}
                              className="border-slate-600 text-slate-300 hover:bg-slate-700"
                            >
                              <ChevronLeft className="h-4 w-4" />
                              <span className="hidden xs:inline ml-1">Previous</span>
                            </Button>
                            
                            <span className="text-xs sm:text-sm text-slate-400 px-2 sm:px-3 whitespace-nowrap">
                              {auditPagination.page + 1} / {auditPagination.totalPages}
                            </span>
                            
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleAuditPageChange(auditPagination.page + 1)}
                              disabled={!auditPagination.hasNext}
                              className="border-slate-600 text-slate-300 hover:bg-slate-700"
                            >
                              <span className="hidden xs:inline mr-1">Next</span>
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              ) : (
                <Card className="bg-slate-800/50 border-slate-700">
                  <CardContent className="text-center py-12">
                    <FileText className="h-12 w-12 mx-auto mb-4 text-slate-400" />
                    <h3 className="text-lg font-medium text-white mb-2">No audit logs found</h3>
                    <p className="text-slate-400">
                      {selectedAction !== 'ALL' || selectedEntity !== 'ALL' || selectedUser !== 'ALL' || selectedRole !== 'ALL' || selectedTimeWindow !== 'ALL'
                        ? 'Try adjusting your filters to see more results.'
                        : 'No audit logs have been recorded yet.'}
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>

        {/* Set Role Modal */}
        {showRoleModal && roleModalUser && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-3 sm:p-4 z-50">
            <Card className="w-full max-w-sm sm:max-w-md bg-slate-800 border-slate-700 max-h-[90vh] overflow-y-auto">
              <CardHeader className="pb-3 sm:pb-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1 pr-2">
                    <CardTitle className="text-white text-lg">Set User Role</CardTitle>
                    <CardDescription className="text-slate-300 text-sm mt-1">
                      Change role for {roleModalUser.firstName} {roleModalUser.lastName}
                    </CardDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowRoleModal(false)}
                    className="text-slate-400 hover:text-white flex-shrink-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Current Role: <span className="text-blue-400">{roleModalUser.role || 'USER'}</span>
                    </label>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Select New Role
                    </label>
                    <select
                      value={newRole}
                      onChange={(e) => setNewRole(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    >
                      <option value="USER">User</option>
                      <option value="MODERATOR">Moderator</option>
                      <option value="ADMIN">Admin</option>
                    </select>
                  </div>
                  
                  <div className="bg-slate-700/50 p-3 rounded-md">
                    <h4 className="text-sm font-medium text-slate-300 mb-2">Role Permissions:</h4>
                    <div className="text-xs text-slate-400 space-y-1">
                      {newRole === 'USER' && (
                        <div>• Basic user access to events and games</div>
                      )}
                      {newRole === 'MODERATOR' && (
                        <>
                          <div>• All user permissions</div>
                          <div>• Content moderation capabilities</div>
                          <div>• User management (limited)</div>
                        </>
                      )}
                      {newRole === 'ADMIN' && (
                        <>
                          <div>• Full system access</div>
                          <div>• User and role management</div>
                          <div>• System configuration</div>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row justify-end gap-3 sm:gap-4 mt-6 pt-4 border-t border-slate-600">
                  <Button
                    variant="outline"
                    onClick={() => setShowRoleModal(false)}
                    className="border-slate-600 text-slate-300 hover:bg-slate-700 w-full sm:w-auto"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={setUserRole}
                    className="bg-blue-600 hover:bg-blue-700 text-white w-full sm:w-auto"
                    disabled={!newRole || newRole === roleModalUser.role}
                  >
                    Update Role
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Add User Modal */}
        {showAddUserModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-3 sm:p-4 z-50">
            <Card className="w-full max-w-md bg-slate-800 border-slate-700 max-h-[90vh] overflow-y-auto">
              <CardHeader className="pb-3 sm:pb-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1 pr-2">
                    <CardTitle className="text-white text-lg">
                      {isEditMode ? 'Edit User' : 'Add New User'}
                    </CardTitle>
                    <CardDescription className="text-slate-300 text-sm mt-1">
                      {isEditMode
                        ? `Update user information for ${editingUser?.firstName} ${editingUser?.lastName}`
                        : 'Create a new user account with blank password'
                      }
                    </CardDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowAddUserModal(false);
                      setIsEditMode(false);
                      setEditingUser(null);
                      setAddUserForm({
                        email: '',
                        firstName: '',
                        lastName: '',
                        phone: '',
                        gender: 'MALE',
                        department: '',
                        password: '',
                        role: 'USER',
                        isEmailVerified: false
                      });
                    }}
                    className="text-slate-400 hover:text-white flex-shrink-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-4">
                  {addUserError && (
                    <div className="p-3 rounded-lg bg-red-500/20 border border-red-500/50 text-red-300 text-sm">
                      {addUserError}
                    </div>
                  )}

                  {/* Email Field */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300 flex items-center">
                      <Mail className="h-4 w-4 mr-2" />
                      Email Address *
                    </label>
                    <Input
                      type="email"
                      placeholder="user@company.com"
                      value={addUserForm.email}
                      onChange={handleEmailChange}
                      className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Name Fields */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-300 flex items-center">
                        <User className="h-4 w-4 mr-2" />
                        First Name *
                      </label>
                      <Input
                        type="text"
                        placeholder="John"
                        value={addUserForm.firstName}
                        onChange={(e) => setAddUserForm(prev => ({ ...prev, firstName: e.target.value }))}
                        className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-300 flex items-center">
                        <User className="h-4 w-4 mr-2" />
                        Last Name *
                      </label>
                      <Input
                        type="text"
                        placeholder="Doe"
                        value={addUserForm.lastName}
                        onChange={(e) => setAddUserForm(prev => ({ ...prev, lastName: e.target.value }))}
                        className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  {/* Phone Field */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300 flex items-center">
                      <Phone className="h-4 w-4 mr-2" />
                      Phone Number
                    </label>
                    <Input
                      type="tel"
                      placeholder="+92-300-1234567"
                      value={addUserForm.phone}
                      onChange={(e) => setAddUserForm(prev => ({ ...prev, phone: e.target.value }))}
                      className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Gender Field */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300 flex items-center">
                      <User className="h-4 w-4 mr-2" />
                      Gender *
                    </label>
                    <select
                      value={addUserForm.gender}
                      onChange={(e) => setAddUserForm(prev => ({ ...prev, gender: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="MALE">Male</option>
                      <option value="FEMALE">Female</option>
                    </select>
                  </div>

                  {/* Department Field */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300 flex items-center">
                      <Building className="h-4 w-4 mr-2" />
                      Department *
                    </label>
                    <select
                      value={addUserForm.department}
                      onChange={(e) => setAddUserForm(prev => ({ ...prev, department: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select Department</option>
                      {departments.map((dept) => (
                        <option key={dept} value={dept}>{dept}</option>
                      ))}
                    </select>
                  </div>

                  {/* Role Field */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300 flex items-center">
                      <UserCog className="h-4 w-4 mr-2" />
                      Role *
                    </label>
                    <select
                      value={addUserForm.role}
                      onChange={(e) => setAddUserForm(prev => ({ ...prev, role: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="USER">User</option>
                      <option value="MODERATOR">Moderator</option>
                      <option value="ADMIN">Admin</option>
                    </select>
                  </div>

                  {/* Password Field */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300 flex items-center">
                      <Settings className="h-4 w-4 mr-2" />
                      Password
                    </label>
                    <Input
                      type="password"
                      placeholder="Leave blank for user to set up later"
                      value={addUserForm.password}
                      onChange={(e) => setAddUserForm(prev => ({ ...prev, password: e.target.value }))}
                      className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Email Verification Checkbox */}
                  <div className="space-y-2">
                    <label className="flex items-center space-x-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={addUserForm.isEmailVerified}
                        onChange={(e) => setAddUserForm(prev => ({ ...prev, isEmailVerified: e.target.checked }))}
                        className="w-4 h-4 text-blue-600 bg-slate-700 border-slate-600 rounded focus:ring-blue-500 focus:ring-2"
                      />
                      <span className="text-sm font-medium text-slate-300 flex items-center">
                        <Mail className="h-4 w-4 mr-2" />
                        Mark email as verified
                      </span>
                    </label>
                    <p className="text-xs text-slate-400 ml-7">
                      Check this if the user's email address has already been verified
                    </p>
                  </div>

                  <div className="bg-slate-700/50 p-3 rounded-md">
                    <p className="text-xs text-slate-400">
                      <strong>Note:</strong> If no password is provided, the user will need to set up their password when they first log in.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row justify-end gap-3 sm:gap-4 mt-6 pt-4 border-t border-slate-600">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowAddUserModal(false);
                      setIsEditMode(false);
                      setEditingUser(null);
                      setAddUserForm({
                        email: '',
                        firstName: '',
                        lastName: '',
                        phone: '',
                        gender: 'MALE',
                        department: '',
                        password: '',
                        role: 'USER',
                        isEmailVerified: false
                      });
                    }}
                    className="border-slate-600 text-slate-300 hover:bg-slate-700 w-full sm:w-auto"
                    disabled={addUserLoading}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleAddUser}
                    className="bg-blue-600 hover:bg-blue-700 text-white w-full sm:w-auto"
                    disabled={addUserLoading}
                  >
                    {addUserLoading
                      ? (isEditMode ? 'Updating...' : 'Creating...')
                      : (isEditMode ? 'Update User' : 'Create User')
                    }
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ModerationPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    }>
      <ModerationContent />
    </Suspense>
  );
}
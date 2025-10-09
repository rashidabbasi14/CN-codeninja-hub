"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Users, Settings, Trophy, Mail, Shield, Activity, Plus, Search, Filter, X, FileText, Clock, ChevronDown, ChevronUp } from "lucide-react";
import { useUser } from "@/contexts/UserContext";
import Link from "next/link";
import Navigation from "@/components/Navigation";
import AdminNavbar from "@/components/AdminNavbar";
import { hasAdminAccess } from "@/lib/auth";

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  department: string;
  role: string;
  isBlocked: boolean;
  createdAt: string;
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

interface Stats {
  totalUsers: number;
  activeUsers: number;
  blockedUsers: number;
  admins: number;
  totalGames: number;
  activeGames: number;
  completedMatches: number;
  totalRegistrations: number;
}

export default function AdminDashboard() {
  const { apiCall, user, loading: userLoading } = useUser();
  const [users, setUsers] = useState<User[]>([]);
  const [recentActivity, setRecentActivity] = useState<AuditLog[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    activeUsers: 0,
    blockedUsers: 0,
    admins: 0,
    totalGames: 0,
    activeGames: 0,
    completedMatches: 0,
    totalRegistrations: 0
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRole, setSelectedRole] = useState("ALL");
  const [selectedStatus, setSelectedStatus] = useState("ALL");
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [newRole, setNewRole] = useState("");
  const [statsCollapsed, setStatsCollapsed] = useState(true);
  const [quickActionsCollapsed, setQuickActionsCollapsed] = useState(false);
  const [recentActivityCollapsed, setRecentActivityCollapsed] = useState(false);

  useEffect(() => {
    // Only load data if user context is ready
    if (!userLoading) {
      if (user) {
        // Check if user is admin or moderator
        if (user.role !== 'ADMIN' && user.role !== 'MODERATOR') {
          // Redirect non-admin/moderator users
          window.location.href = '/dashboard';
          return;
        }
        loadData();
      } else {
        // User is not logged in, redirect to login
        window.location.href = '/auth/login';
        return;
      }
    }
  }, [userLoading, user]);

  // Auto-refresh recent activity every 5 seconds
  useEffect(() => {
    if (!userLoading && user && (user.role === 'ADMIN' || user.role === 'MODERATOR')) {
      const interval = setInterval(async () => {
        try {
          const auditRes = await apiCall('/api/admin/audit?limit=20');
          if (auditRes.ok) {
            const auditData = await auditRes.json();
            setRecentActivity(auditData.auditLogs || []);
          }
        } catch (error) {
          console.error('Failed to refresh recent activity:', error);
        }
      }, 5000); // Refresh every 5 seconds

      return () => clearInterval(interval);
    }
  }, [userLoading, user, apiCall]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [usersRes, statsRes, auditRes] = await Promise.all([
        apiCall('/api/admin/users'),
        apiCall('/api/admin/stats'),
        apiCall('/api/admin/audit?limit=20')
      ]);

      if (usersRes.ok) {
        const usersData = await usersRes.json();
        setUsers(usersData);
      }

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }

      if (auditRes.ok) {
        const auditData = await auditRes.json();
        setRecentActivity(auditData.auditLogs || []);
      }
    } catch (error) {
      console.error('Failed to load admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = `${user.firstName} ${user.lastName} ${user.email}`.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = selectedRole === "ALL" || user.role === selectedRole;
    const matchesStatus = selectedStatus === "ALL" || 
      (selectedStatus === "ACTIVE" && !user.isBlocked) ||
      (selectedStatus === "BLOCKED" && user.isBlocked);
    
    return matchesSearch && matchesRole && matchesStatus;
  });

  const handleSetRole = (user: User) => {
    setSelectedUser(user);
    setNewRole(user.role);
    setShowRoleModal(true);
  };

  const handleUpdateRole = async () => {
    if (!selectedUser || !newRole) return;

    try {
      const response = await apiCall(`/api/admin/users/${selectedUser.id}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role: newRole })
      });
      
      if (response.ok) {
        setShowRoleModal(false);
        setSelectedUser(null);
        setNewRole("");
        await loadData(); // Reload data
      } else {
        const errorData = await response.json();
        alert(errorData.error || 'Failed to update user role');
      }
    } catch (error) {
      console.error('Failed to update user role:', error);
      alert('Failed to update user role. Please try again.');
    }
  };

  const handleBlockUser = async (userId: string) => {
    try {
      // Find the user to determine current block status
      const targetUser = users.find(u => u.id === userId);
      if (!targetUser) {
        console.error('User not found');
        return;
      }

      const willBlock = !targetUser.isBlocked;
      const reason = willBlock
        ? prompt('Reason for blocking this user:') || 'No reason provided'
        : 'Unblocked by admin';

      // If blocking and user cancelled the prompt, don't proceed
      if (willBlock && reason === 'No reason provided' && !confirm('Block user without reason?')) {
        return;
      }

      console.log('handleBlockUser - userId:', userId);
      console.log('handleBlockUser - willBlock:', willBlock);
      console.log('handleBlockUser - reason:', reason);

      const response = await apiCall(`/api/admin/users/${userId}/block`, {
        method: 'PATCH',
        body: JSON.stringify({
          block: willBlock,
          reason: reason
        })
      });
      
      if (response.ok) {
        await loadData(); // Reload data
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Failed to toggle user block:', errorData);
        alert(`Failed to ${willBlock ? 'block' : 'unblock'} user: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to block user:', error);
      alert('Failed to toggle user block. Please try again.');
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
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

  const getActionColor = (action: string) => {
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

  if (loading || userLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-white">Loading admin dashboard...</div>
      </div>
    );
  }

  // Show loading if user is not loaded yet
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-white">Redirecting to login...</div>
      </div>
    );
  }

  // Check if user is admin or moderator
  if (user.role !== 'ADMIN' && user.role !== 'MODERATOR') {
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

      <div className="container mx-auto px-4 py-4 sm:py-6 lg:py-8">
        {/* Stats Cards */}
        <div className="mb-6 lg:mb-8">
          <div className="flex items-center justify-between mb-4 cursor-pointer" onClick={() => setStatsCollapsed(!statsCollapsed)}>
            <h2 className="text-lg lg:text-xl font-bold text-white flex items-center">
              <Activity className="h-4 w-4 lg:h-5 lg:w-5 mr-2 text-blue-400" />
              Dashboard Statistics
            </h2>
            <Button
              variant="ghost"
              size="sm"
              className="text-slate-300 hover:text-white"
              onClick={() => setStatsCollapsed(!statsCollapsed)}
            >
              {statsCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            </Button>
          </div>
          <div className={`grid grid-cols-2 gap-3 transition-all duration-300 ease-in-out ${statsCollapsed ? 'max-h-0 opacity-0 overflow-hidden' : 'max-h-96 opacity-100'}`}>
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Users className="h-6 w-6 text-blue-400" />
                    <div>
                      <p className="text-xs text-slate-400">Total Users</p>
                      <p className="text-lg font-bold text-white">{stats.totalUsers}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Activity className="h-6 w-6 text-green-400" />
                    <div>
                      <p className="text-xs text-slate-400">Active Games</p>
                      <p className="text-lg font-bold text-white">{stats.activeGames}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Trophy className="h-6 w-6 text-yellow-400" />
                    <div>
                      <p className="text-xs text-slate-400">Completed</p>
                      <p className="text-lg font-bold text-white">{stats.completedMatches}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Shield className="h-6 w-6 text-red-400" />
                    <div>
                      <p className="text-xs text-slate-400">Blocked Users</p>
                      <p className="text-lg font-bold text-white">{stats.blockedUsers}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mb-6 lg:mb-8">
          <div className="flex items-center justify-between mb-4 cursor-pointer" onClick={() => setQuickActionsCollapsed(!quickActionsCollapsed)}>
            <h2 className="text-lg lg:text-xl font-bold text-white flex items-center">
              <Settings className="h-4 w-4 lg:h-5 lg:w-5 mr-2 text-blue-400" />
              Quick Actions
            </h2>
            <Button
              variant="ghost"
              size="sm"
              className="text-slate-300 hover:text-white"
              onClick={() => setQuickActionsCollapsed(!quickActionsCollapsed)}
            >
              {quickActionsCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            </Button>
          </div>
          <div className={`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 transition-all duration-300 ease-in-out ${quickActionsCollapsed ? 'max-h-0 opacity-0 overflow-hidden' : 'max-h-96 opacity-100'}`}>
            <Link href="/admin/moderation?tab=users">
              <Card className="bg-slate-800/50 border-slate-700 hover:bg-slate-700/50 transition-colors cursor-pointer">
                <CardContent className="p-4 flex items-center space-x-3">
                  <Users className="h-6 w-6 text-blue-400" />
                  <span className="text-white font-medium text-sm">Manage Users</span>
                </CardContent>
              </Card>
            </Link>

            <Link href="/admin/events">
              <Card className="bg-slate-800/50 border-slate-700 hover:bg-slate-700/50 transition-colors cursor-pointer">
                <CardContent className="p-4 flex items-center space-x-3">
                  <Trophy className="h-6 w-6 text-yellow-400" />
                  <span className="text-white font-medium text-sm">Events & Games</span>
                </CardContent>
              </Card>
            </Link>

            <Link href="/admin/departments">
              <Card className="bg-slate-800/50 border-slate-700 hover:bg-slate-700/50 transition-colors cursor-pointer">
                <CardContent className="p-4 flex items-center space-x-3">
                  <Users className="h-6 w-6 text-purple-400" />
                  <span className="text-white font-medium text-sm">Departments</span>
                </CardContent>
              </Card>
            </Link>

            <Link href="/admin/moderation">
              <Card className="bg-slate-800/50 border-slate-700 hover:bg-slate-700/50 transition-colors cursor-pointer">
                <CardContent className="p-4 flex items-center space-x-3">
                  <Shield className="h-6 w-6 text-red-400" />
                  <span className="text-white font-medium text-sm">Moderation</span>
                </CardContent>
              </Card>
            </Link>

            {/* Automated Jobs - Only show for admins */}
            {hasAdminAccess(user) && (
              <Link href="/admin/cron">
                <Card className="bg-slate-800/50 border-slate-700 hover:bg-slate-700/50 transition-colors cursor-pointer">
                  <CardContent className="p-4 flex items-center space-x-3">
                    <Clock className="h-6 w-6 text-green-400" />
                    <span className="text-white font-medium text-sm">Automated Jobs</span>
                  </CardContent>
                </Card>
              </Link>
            )}

            {/* System Configurations - Only show for admins */}
            {hasAdminAccess(user) && (
              <Link href="/admin/configurations">
                <Card className="bg-slate-800/50 border-slate-700 hover:bg-slate-700/50 transition-colors cursor-pointer">
                  <CardContent className="p-4 flex items-center space-x-3">
                    <Settings className="h-6 w-6 text-cyan-400" />
                    <span className="text-white font-medium text-sm">Configurations</span>
                  </CardContent>
                </Card>
              </Link>
            )}

            {/* Email Logs - Only show for admins */}
            {hasAdminAccess(user) && (
              <Link href="/admin/emails">
                <Card className="bg-slate-800/50 border-slate-700 hover:bg-slate-700/50 transition-colors cursor-pointer">
                  <CardContent className="p-4 flex items-center space-x-3">
                    <Mail className="h-6 w-6 text-indigo-400" />
                    <span className="text-white font-medium text-sm">Email</span>
                  </CardContent>
                </Card>
              </Link>
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Activity className="h-5 w-5 text-blue-400" />
                <div>
                  <CardTitle className="text-white">Recent Activity</CardTitle>
                  <CardDescription className="text-slate-400">
                    Latest system actions and changes
                  </CardDescription>
                </div>
              </div>
              <Link href="/admin/moderation?tab=audit">
                <Button variant="outline" size="sm" className="border-slate-600 text-slate-300 hover:bg-slate-700">
                  <FileText className="h-4 w-4 mr-2" />
                  View All
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="transition-all duration-300 ease-in-out max-h-[500px] opacity-100 overflow-y-auto">
              {recentActivity.length > 0 ? (
                <div className="space-y-3">
                  {recentActivity.map((log) => (
                    <div key={log.id} className="flex items-start space-x-3 p-3 rounded-lg border border-slate-700 bg-slate-700/30 hover:bg-slate-700/50 transition-colors">
                      {/* Action Badge */}
                      <div className={`px-2 py-1 rounded-full text-xs font-medium flex-shrink-0 ${getActionColor(log.action)}`}>
                        {formatAuditAction(log.action)}
                      </div>
                      
                      {/* Activity Details */}
                      <div className="flex-1 min-w-0 break-words">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                          <div className="flex items-center space-x-2">
                            <span className="text-white font-medium text-sm truncate">
                              {log.actor.firstName} {log.actor.lastName}
                            </span>
                            <span className={`px-1.5 py-0.5 text-xs rounded ${
                              log.actor.role === 'ADMIN'
                                ? 'bg-blue-500/20 text-blue-400'
                                : log.actor.role === 'MODERATOR'
                                  ? 'bg-orange-500/20 text-orange-400'
                                  : 'bg-green-500/20 text-green-400'
                            }`}>
                              {log.actor.role}
                            </span>
                          </div>
                          <div className="flex items-center space-x-2 text-xs text-slate-400">
                            <Clock className="h-3 w-3" />
                            <span>{formatTimeAgo(log.createdAt)}</span>
                          </div>
                        </div>
                        
                        <div className="mt-1 text-sm text-slate-300">
                          <span className="font-medium truncate">{log.entity}</span>
                          {log.entityId && (
                            <span className="text-slate-400 ml-1">(ID: {log.entityId.substring(0, 8)}...)</span>
                          )}
                        </div>
                        
                        {/* Payload Summary for Mobile */}
                        {log.payload && Object.keys(log.payload).length > 0 && (
                          <div className="mt-2 text-xs text-slate-400">
                            {log.payload.reason && (
                              <div className="truncate"><span className="font-medium">Reason:</span> {log.payload.reason}</div>
                            )}
                            {log.payload.targetUserEmail && (
                              <div className="truncate"><span className="font-medium">Target:</span> {log.payload.targetUserEmail}</div>
                            )}
                            {log.payload.content && (
                              <div className="truncate"><span className="font-medium">Content:</span> {log.payload.content.substring(0, 50)}...</div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 border border-slate-700 rounded-lg">
                  <Activity className="h-12 w-12 mx-auto mb-4 text-slate-400" />
                  <h3 className="text-lg font-medium text-white mb-2">No recent activity</h3>
                  <p className="text-slate-400">System activity will appear here as actions are performed.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Set Role Modal */}
        {showRoleModal && selectedUser && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <Card className="w-full max-w-md bg-slate-800 border-slate-700">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-white">Set User Role</CardTitle>
                    <CardDescription className="text-slate-300">
                      Change role for {selectedUser.firstName} {selectedUser.lastName}
                    </CardDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowRoleModal(false)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Current Role: <span className="text-blue-400">{selectedUser.role}</span>
                    </label>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Select New Role
                    </label>
                    <select
                      value={newRole}
                      onChange={(e) => setNewRole(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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

                <div className="flex justify-end space-x-4 mt-6 pt-4 border-t border-slate-600">
                  <Button
                    variant="outline"
                    onClick={() => setShowRoleModal(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleUpdateRole}
                    disabled={newRole === selectedUser.role}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    Update Role
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

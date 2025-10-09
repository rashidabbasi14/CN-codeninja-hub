"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Building2,
  Plus,
  Edit,
  Trash2,
  Users,
  Search,
  Save,
  X
} from "lucide-react";
import Navigation from "@/components/Navigation";
import AdminNavbar from "@/components/AdminNavbar";
import { useUser } from "@/contexts/UserContext";
import { canDelete, hasAdminAccess } from "@/lib/auth";

interface Department {
  id: string;
  name: string;
  createdBy: string;
  createdAt: Date;
  _count: {
    users: number;
  };
}

export default function DepartmentsPage() {
  const { apiCall, user, loading: userLoading } = useUser();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [newDepartmentName, setNewDepartmentName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

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
        loadDepartments();
      } else {
        // User is not logged in, redirect to login
        window.location.href = '/auth/login';
        return;
      }
    }
  }, [userLoading, user]);

  const loadDepartments = async () => {
    setLoading(true);
    try {
      const response = await apiCall('/api/departments?includeDetails=true');
      if (response.ok) {
        const data = await response.json();
        setDepartments(data);
      }
    } catch (error) {
      console.error('Failed to load departments:', error);
    } finally {
      setLoading(false);
    }
  };

  const createDepartment = async () => {
    if (!newDepartmentName.trim()) return;

    try {
      const response = await apiCall('/api/departments', {
        method: 'POST',
        body: JSON.stringify({ name: newDepartmentName.trim() }),
      });

      if (response.ok) {
        setNewDepartmentName('');
        setIsCreating(false);
        await loadDepartments();
      }
    } catch (error) {
      console.error('Failed to create department:', error);
    }
  };

  const updateDepartment = async (id: string, name: string) => {
    if (!name.trim()) return;

    try {
      const response = await apiCall(`/api/departments/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ name: name.trim() }),
      });

      if (response.ok) {
        setEditingId(null);
        setEditingName('');
        await loadDepartments();
      }
    } catch (error) {
      console.error('Failed to update department:', error);
    }
  };

  const deleteDepartment = async (id: string) => {
    if (!confirm('Are you sure you want to delete this department? Users in this department will need to be reassigned.')) {
      return;
    }

    try {
      const response = await apiCall(`/api/departments/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await loadDepartments();
      }
    } catch (error) {
      console.error('Failed to delete department:', error);
    }
  };

  const startEditing = (department: Department) => {
    setEditingId(department.id);
    setEditingName(department.name);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditingName('');
  };

  const filteredDepartments = Array.isArray(departments) ? departments.filter(dept =>
    dept.name.toLowerCase().includes(searchTerm.toLowerCase())
  ) : [];

  if (loading || userLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-white">Loading departments...</div>
      </div>
    );
  }

  // Show loading if user is not loaded yet
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-white">Please log in to access the admin panel.</div>
      </div>
    );
  }

  // Check if user is admin
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
      
      {/* Page Header */}
      <div className="border-b border-slate-700/50 bg-slate-900/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center space-x-2">
                <Building2 className="h-8 w-8 text-blue-400" />
                <span>Department Management</span>
              </h1>
              <p className="text-slate-400">Manage organizational departments</p>
            </div>
            
            {hasAdminAccess(user) && (
              <Button
                onClick={() => setIsCreating(true)}
                className="codeninja-gradient"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Department
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="space-y-6">
          {/* Search */}
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search departments..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-slate-700 border-slate-600 text-white"
                />
              </div>
            </CardContent>
          </Card>

          {/* Create New Department */}
          {isCreating && (
            <Card className="bg-slate-800/50 border-slate-700 border-blue-500/50">
              <CardHeader>
                <CardTitle className="text-white">Create New Department</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-4">
                  <Input
                    placeholder="Department name..."
                    value={newDepartmentName}
                    onChange={(e) => setNewDepartmentName(e.target.value)}
                    className="bg-slate-700 border-slate-600 text-white"
                    onKeyPress={(e) => e.key === 'Enter' && createDepartment()}
                  />
                  <Button
                    onClick={createDepartment}
                    disabled={!newDepartmentName.trim()}
                    className="codeninja-gradient"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Create
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsCreating(false);
                      setNewDepartmentName('');
                    }}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Departments List */}
          {loading ? (
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="text-center py-12">
                <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                <p className="text-slate-400">Loading departments...</p>
              </CardContent>
            </Card>
          ) : filteredDepartments.length === 0 ? (
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="text-center py-12">
                <Building2 className="h-12 w-12 mx-auto mb-4 text-slate-400" />
                <h3 className="text-lg font-medium text-white mb-2">No departments found</h3>
                <p className="text-slate-400">
                  {searchTerm ? 'Try adjusting your search terms.' : 'Create your first department to get started.'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredDepartments.map((department) => (
                <Card key={department.id} className="bg-slate-800/50 border-slate-700 hover:border-slate-600 transition-colors">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Building2 className="h-5 w-5 text-blue-400" />
                        {editingId === department.id ? (
                          <Input
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            className="bg-slate-700 border-slate-600 text-white text-lg font-semibold"
                            onKeyPress={(e) => e.key === 'Enter' && updateDepartment(department.id, editingName)}
                          />
                        ) : (
                          <CardTitle className="text-white">{department.name}</CardTitle>
                        )}
                      </div>
                      
                      <div className="flex items-center space-x-1">
                        {editingId === department.id ? (
                          <>
                            <Button
                              size="sm"
                              onClick={() => updateDepartment(department.id, editingName)}
                              disabled={!editingName.trim()}
                              className="codeninja-gradient"
                            >
                              <Save className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={cancelEditing}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </>
                        ) : (
                          <>
                            {hasAdminAccess(user) && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => startEditing(department)}
                              >
                                <Edit className="h-3 w-3" />
                              </Button>
                            )}
                            {canDelete(user) && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => deleteDepartment(department.id)}
                                className="text-red-400 hover:text-red-300"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center space-x-2 text-slate-400">
                          <Users className="h-4 w-4" />
                          <span>{department._count.users} members</span>
                        </div>
                        <div className="text-slate-500">
                          Created {new Date(department.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                      
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Statistics */}
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">Department Statistics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-400">{departments.length}</div>
                  <div className="text-sm text-slate-400">Total Departments</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-400">
                    {Array.isArray(departments) ? departments.reduce((sum, dept) => sum + dept._count.users, 0) : 0}
                  </div>
                  <div className="text-sm text-slate-400">Total Members</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-400">
                    {Array.isArray(departments) && departments.length > 0 ? Math.round(departments.reduce((sum, dept) => sum + dept._count.users, 0) / departments.length) : 0}
                  </div>
                  <div className="text-sm text-slate-400">Avg Members/Dept</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
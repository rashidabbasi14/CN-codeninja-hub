"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { RotateCcw, Copy, Calendar, MapPin, Users, Clock, CheckCircle, XCircle } from "lucide-react";
import { useUser } from "@/contexts/UserContext";
import Link from "next/link";
import Navigation from "@/components/Navigation";
import AdminNavbar from "@/components/AdminNavbar";

interface ArchivedCategory {
  id: string;
  name: string;
  status: string;
  gamesCountMode: string;
  startDate: string;
  endDate: string;
  dailyWindows: Array<{ start: string; end: string }>;
  perPersonCap: number;
  locationName: string;
  locationMapsLink: string;
  games: Array<{
    id: string;
    name: string;
    weightage: number;
    typeFormat: string;
    contestType: string;
  }>;
}

export default function ArchivePage() {
  const { apiCall, user, loading: userLoading } = useUser();
  const [categories, setCategories] = useState<ArchivedCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<ArchivedCategory | null>(null);
  const [copyName, setCopyName] = useState('');

  useEffect(() => {
    if (!userLoading && user) {
      loadArchivedCategories();
    }
  }, [userLoading, user]);

  const loadArchivedCategories = async () => {
    setLoading(true);
    try {
      // Load completed, abandoned, and archived categories
      const [completedRes, abandonedRes, archivedRes] = await Promise.all([
        apiCall('/api/categories?status=COMPLETED'),
        apiCall('/api/categories?status=ABANDONED'),
        apiCall('/api/categories?status=ARCHIVED')
      ]);

      const allCategories = [];
      
      if (completedRes.ok) {
        const completed = await completedRes.json();
        allCategories.push(...completed.map((cat: any) => ({ ...cat, status: 'COMPLETED' })));
      }
      
      if (abandonedRes.ok) {
        const abandoned = await abandonedRes.json();
        allCategories.push(...abandoned.map((cat: any) => ({ ...cat, status: 'ABANDONED' })));
      }
      
      if (archivedRes.ok) {
        const archived = await archivedRes.json();
        allCategories.push(...archived.map((cat: any) => ({ ...cat, status: 'ARCHIVED' })));
      }

      setCategories(allCategories);
    } catch (error) {
      console.error('Failed to load archived categories:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRestoreCategory = async (categoryId: string) => {
    if (!confirm('Are you sure you want to restore this category to active status?')) return;
    
    try {
      const response = await apiCall(`/api/categories/${categoryId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'ACTIVE' })
      });
      
      if (response.ok) {
        await loadArchivedCategories();
      } else {
        const error = await response.json();
        alert('Failed to restore category: ' + (error.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Failed to restore category:', error);
      alert('Failed to restore category. Please try again.');
    }
  };

  const handleCopyCategory = (category: ArchivedCategory) => {
    setSelectedCategory(category);
    setCopyName(`${category.name} (Copy)`);
    setShowCopyModal(true);
  };

  const handleSubmitCopy = async () => {
    if (!selectedCategory || !copyName.trim()) {
      alert('Please enter a name for the copied category');
      return;
    }

    setSubmitting(true);
    try {
      const response = await apiCall(`/api/categories/${selectedCategory.id}/copy`, {
        method: 'POST',
        body: JSON.stringify({ name: copyName.trim() })
      });
      
      if (response.ok) {
        setShowCopyModal(false);
        setSelectedCategory(null);
        setCopyName('');
        alert('Category copied successfully! You can find it in the main events page.');
      } else {
        const error = await response.json();
        alert('Failed to copy category: ' + (error.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Failed to copy category:', error);
      alert('Failed to copy category. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-900/50 text-green-400 border border-green-700">
            <CheckCircle className="h-3 w-3 mr-1" />
            Completed
          </span>
        );
      case 'ABANDONED':
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-900/50 text-orange-400 border border-orange-700">
            <XCircle className="h-3 w-3 mr-1" />
            Abandoned
          </span>
        );
      case 'ARCHIVED':
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-slate-700 text-slate-300 border border-slate-600">
            Archived
          </span>
        );
      default:
        return null;
    }
  };

  if (userLoading) {
    return <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
      <div className="text-white">Loading...</div>
    </div>;
  }

  if (!user || (user.role !== 'ADMIN' && user.role !== 'MODERATOR')) {
    return <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
      <div className="text-white">Access denied. Admin or Moderator privileges required.</div>
    </div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <Navigation />
      <AdminNavbar />

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center mb-4">
              <h1 className="text-4xl font-bold text-white">Category Archive</h1>
            </div>
            <p className="text-xl text-slate-300">
              Manage completed, abandoned, and archived categories.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="text-white">Loading archived categories...</div>
          </div>
        ) : categories.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-slate-400">No archived categories found.</div>
          </div>
        ) : (
          <div className="grid gap-6">
            {categories.map((category) => (
              <Card key={category.id} className="bg-slate-800/50 border-slate-700">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <CardTitle className="text-white text-2xl">{category.name}</CardTitle>
                        {getStatusBadge(category.status)}
                      </div>
                      <div className="flex flex-wrap gap-4 text-sm text-slate-300">
                        <div className="flex items-center">
                          <Calendar className="h-4 w-4 mr-1" />
                          {category.startDate === category.endDate 
                            ? new Date(category.startDate).toLocaleDateString()
                            : `${new Date(category.startDate).toLocaleDateString()} - ${new Date(category.endDate).toLocaleDateString()}`
                          }
                        </div>
                        <div className="flex items-center">
                          <Clock className="h-4 w-4 mr-1" />
                          {category.dailyWindows.map((window: any) => `${window.start} - ${window.end}`).join(", ")}
                        </div>
                        <div className="flex items-center">
                          <MapPin className="h-4 w-4 mr-1" />
                          {category.locationName}
                        </div>
                        <div className="flex items-center">
                          <Users className="h-4 w-4 mr-1" />
                          {category.perPersonCap === 2147483647 ? "No Limit" : `${category.perPersonCap} games per person`}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {category.status === 'ABANDONED' && (
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="border-blue-600 text-blue-400 hover:bg-blue-600/20"
                          onClick={() => handleRestoreCategory(category.id)}
                        >
                          <RotateCcw className="h-4 w-4 mr-1" />
                          Restore
                        </Button>
                      )}
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="border-purple-600 text-purple-400 hover:bg-purple-600/20"
                        onClick={() => handleCopyCategory(category)}
                      >
                        <Copy className="h-4 w-4 mr-1" />
                        Copy
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="mb-4">
                    <h3 className="text-lg font-semibold text-white mb-3">
                      Games ({category.games?.length || 0})
                    </h3>
                    {category.games && category.games.length > 0 ? (
                      <div className="grid gap-2">
                        {category.games.map((game) => (
                          <div key={game.id} className="bg-slate-700/50 rounded-lg p-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <h4 className="font-medium text-white">{game.name}</h4>
                                <div className="text-sm text-slate-400">
                                  {game.typeFormat} • {game.contestType.replace(/_/g, ' ')} • Weight: {game.weightage}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-slate-400 text-sm">No games in this category</div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Copy Category Modal */}
      {showCopyModal && selectedCategory && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">Copy Category</CardTitle>
              <CardDescription className="text-slate-300">
                Create a copy of "{selectedCategory.name}" with all games but no registrations.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    New Category Name
                  </label>
                  <Input
                    value={copyName}
                    onChange={(e) => setCopyName(e.target.value)}
                    placeholder="Enter name for the copied category"
                    className="bg-slate-700 border-slate-600 text-white"
                  />
                </div>
                <div className="flex justify-end space-x-4 pt-4">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => {
                      setShowCopyModal(false);
                      setSelectedCategory(null);
                      setCopyName('');
                    }}
                  >
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleSubmitCopy}
                    disabled={submitting || !copyName.trim()}
                    className="codeninja-gradient"
                  >
                    {submitting ? 'Copying...' : 'Copy Category'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
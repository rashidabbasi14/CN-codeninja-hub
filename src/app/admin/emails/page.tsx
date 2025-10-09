
"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Mail,
  Search,
  Filter,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Users,
  Send,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Eye,
  RotateCcw,
  X
} from "lucide-react";
import { useUser } from "@/contexts/UserContext";
import Navigation from "@/components/Navigation";
import AdminNavbar from "@/components/AdminNavbar";
import EmailPlayersModal from "@/components/EmailPlayersModal";
import Link from "next/link";

interface EmailLog {
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
  createdAt: string;
  status: 'success' | 'failed';
  subject: string;
  recipientCount: number;
  recipients: string[];
  recipientType: string;
  gameId: string | null;
  customEmails: string[] | null;
  error: string | null;
  adminEmail: string;
  adminName: string;
  sentAt: string;
  content: string | null;
}

interface EmailStats {
  total: number;
  successful: number;
  failed: number;
  totalRecipients: number;
}

export default function EmailLogsPage() {
  const { apiCall, user, loading: userLoading } = useUser();
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);
  const [stats, setStats] = useState<EmailStats>({
    total: 0,
    successful: 0,
    failed: 0,
    totalRecipients: 0
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [selectedLog, setSelectedLog] = useState<EmailLog | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [resendingEmails, setResendingEmails] = useState<Set<string>>(new Set());
  
  // Email Modal State
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [allGames, setAllGames] = useState<any[]>([]);

  useEffect(() => {
    if (!userLoading) {
      if (user) {
        if (user.role !== 'ADMIN' && user.role !== 'MODERATOR') {
          window.location.href = '/admin';
          return;
        }
        loadEmailLogs();
      } else {
        window.location.href = '/auth/login';
        return;
      }
    }
  }, [userLoading, user, currentPage, statusFilter]);

  const loadAllGames = async () => {
    try {
      const response = await apiCall('/api/categories');
      if (response.ok) {
        const categories = await response.json();
        const allGamesData: any[] = [];
        
        // Extract games from all categories
        categories.forEach((category: any) => {
          if (category.games && category.games.length > 0) {
            category.games.forEach((game: any) => {
              allGamesData.push({
                id: game.id,
                name: game.name,
                categoryName: category.name,
                displayName: `${game.name} (${category.name})`
              });
            });
          }
        });
        
        setAllGames(allGamesData);
      }
    } catch (error) {
      console.error('Error loading games:', error);
    }
  };

  const loadEmailLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '20',
        status: statusFilter,
        ...(searchTerm && { search: searchTerm })
      });

      const response = await apiCall(`/api/admin/email-logs?${params}`);
      if (response.ok) {
        const data = await response.json();
        setEmailLogs(data.emailLogs || []);
        setStats(data.stats || { total: 0, successful: 0, failed: 0, totalRecipients: 0 });
        setTotalPages(data.pagination?.totalPages || 0);
      }
    } catch (error) {
      console.error('Failed to load email logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setCurrentPage(0);
    loadEmailLogs();
  };

  const handleResendEmail = async (log: EmailLog) => {
    if (!log.recipients || log.recipients.length === 0) {
      alert('No recipients found for this email');
      return;
    }

    const confirmResend = confirm(
      `Resend email "${log.subject}" to ${log.recipientCount} recipients?`
    );
    
    if (!confirmResend) return;

    setResendingEmails(prev => new Set(prev).add(log.id));

    try {
      const response = await apiCall('/api/admin/email-players', {
        method: 'POST',
        body: JSON.stringify({
          subject: `[RESEND] ${log.subject}`,
          content: log.content || 'Original email content not available.',
          recipientType: 'custom',
          customEmails: log.recipients
        })
      });

      if (response.ok) {
        alert('Email resent successfully!');
        loadEmailLogs(); // Refresh the logs
      } else {
        const errorData = await response.json();
        alert(`Failed to resend email: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to resend email:', error);
      alert('Failed to resend email. Please try again.');
    } finally {
      setResendingEmails(prev => {
        const newSet = new Set(prev);
        newSet.delete(log.id);
        return newSet;
      });
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

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const showEmailDetails = (log: EmailLog) => {
    setSelectedLog(log);
    setShowDetailsModal(true);
  };

  if (loading || userLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-white">Loading email logs...</div>
      </div>
    );
  }

  if (!user || (user.role !== 'ADMIN' && user.role !== 'MODERATOR')) {
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
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-white flex items-center">
                <Mail className="h-6 w-6 lg:h-8 lg:w-8 mr-3 text-blue-400" />
                Email Logs
              </h1>
              <p className="text-slate-400 mt-1">Monitor and manage email communications</p>
            </div>
          </div>
          <div className="flex space-x-3">
            <Button
              onClick={() => {
                loadAllGames();
                setShowEmailModal(true);
              }}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              <Send className="h-4 w-4 mr-2" />
              Send Email
            </Button>
            <Button
              onClick={loadEmailLogs}
              className="bg-blue-600 hover:bg-blue-700 text-white"
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-400">Total Emails</p>
                  <p className="text-2xl font-bold text-white">{stats.total}</p>
                </div>
                <Mail className="h-8 w-8 text-blue-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-400">Successful</p>
                  <p className="text-2xl font-bold text-green-400">{stats.successful}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-400">Failed</p>
                  <p className="text-2xl font-bold text-red-400">{stats.failed}</p>
                </div>
                <XCircle className="h-8 w-8 text-red-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-400">Recipients</p>
                  <p className="text-2xl font-bold text-purple-400">{stats.totalRecipients}</p>
                </div>
                <Users className="h-8 w-8 text-purple-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="bg-slate-800/50 border-slate-700 mb-6">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
                  <Input
                    placeholder="Search emails by subject, sender, recipients..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                    className="pl-10 bg-slate-700 border-slate-600 text-white placeholder-slate-400"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white text-sm"
                >
                  <option value="all">All Status</option>
                  <option value="success">Successful</option>
                  <option value="failed">Failed</option>
                </select>
                <Button onClick={handleSearch} className="bg-blue-600 hover:bg-blue-700">
                  <Filter className="h-4 w-4 mr-2" />
                  Filter
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Email Logs Table */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Email History</CardTitle>
            <CardDescription className="text-slate-400">
              Recent email communications and their status
            </CardDescription>
          </CardHeader>
          <CardContent>
            {emailLogs.length > 0 ? (
              <div className="space-y-4">
                {emailLogs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-center justify-between p-4 rounded-lg border border-slate-700 bg-slate-700/30 hover:bg-slate-700/50 transition-colors"
                  >
                    <div className="flex items-start space-x-4 flex-1">
                      {/* Status Icon */}
                      <div className="flex-shrink-0 mt-1">
                        {log.status === 'success' ? (
                          <CheckCircle className="h-5 w-5 text-green-400" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-400" />
                        )}
                      </div>

                      {/* Email Details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-1">
                          <h3 className="text-white font-medium truncate">{log.subject}</h3>
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            log.status === 'success' 
                              ? 'bg-green-500/20 text-green-400' 
                              : 'bg-red-500/20 text-red-400'
                          }`}>
                            {log.status === 'success' ? 'Sent' : 'Failed'}
                          </span>
                        </div>
                        
                        <div className="flex flex-wrap items-center gap-4 text-sm text-slate-400">
                          <span className="flex items-center">
                            <Users className="h-4 w-4 mr-1" />
                            {log.recipientCount} recipients
                          </span>
                          <span className="flex items-center">
                            <Clock className="h-4 w-4 mr-1" />
                            {formatTimeAgo(log.createdAt)}
                          </span>
                          <span>By: {log.adminName}</span>
                        </div>

                        {log.error && (
                          <div className="mt-2 p-2 bg-red-500/10 border border-red-500/20 rounded text-red-400 text-sm">
                            <AlertTriangle className="h-4 w-4 inline mr-1" />
                            {log.error}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center space-x-2 ml-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => showEmailDetails(log)}
                        className="border-slate-600 text-slate-300 hover:bg-slate-700"
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        Details
                      </Button>
                      
                      {log.status === 'failed' && log.recipients && log.recipients.length > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleResendEmail(log)}
                          disabled={resendingEmails.has(log.id)}
                          className="border-orange-600 text-orange-400 hover:bg-orange-600/10"
                        >
                          {resendingEmails.has(log.id) ? (
                            <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                          ) : (
                            <RotateCcw className="h-4 w-4 mr-1" />
                          )}
                          Resend
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-400">
                <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No email logs found</p>
                <p className="text-sm">Email communications will appear here</p>
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-700">
                <div className="text-sm text-slate-400">
                  Page {currentPage + 1} of {totalPages}
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
                    disabled={currentPage === 0}
                    className="border-slate-600 text-slate-300 hover:bg-slate-700"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(Math.min(totalPages - 1, currentPage + 1))}
                    disabled={currentPage >= totalPages - 1}
                    className="border-slate-600 text-slate-300 hover:bg-slate-700"
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Email Details Modal */}
      {showDetailsModal && selectedLog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-2xl bg-slate-800 border border-slate-700 rounded-lg">
            <div className="flex items-center justify-between p-6 border-b border-slate-700">
              <h2 className="text-xl font-bold text-white">Email Details</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDetailsModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="p-6 space-y-4 max-h-96 overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-slate-400">Status</label>
                  <div className={`mt-1 px-2 py-1 text-sm rounded-full inline-block ${
                    selectedLog.status === 'success'
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-red-500/20 text-red-400'
                  }`}>
                    {selectedLog.status === 'success' ? 'Sent Successfully' : 'Failed'}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-400">Recipients</label>
                  <p className="text-white mt-1">{selectedLog.recipientCount} recipients</p>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-400">Subject</label>
                <p className="text-white mt-1">{selectedLog.subject}</p>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-400">Sent By</label>
                <p className="text-white mt-1">{selectedLog.adminName} ({selectedLog.adminEmail})</p>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-400">Sent At</label>
                <p className="text-white mt-1">{formatDateTime(selectedLog.sentAt)}</p>
              </div>

              {selectedLog.error && (
                <div>
                  <label className="text-sm font-medium text-slate-400">Error</label>
                  <div className="mt-1 p-3 bg-red-500/10 border border-red-500/20 rounded text-red-400 text-sm">
                    {selectedLog.error}
                  </div>
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-slate-400">Recipients List</label>
                <div className="mt-1 max-h-32 overflow-y-auto bg-slate-700/50 rounded p-3">
                  {selectedLog.recipients && selectedLog.recipients.length > 0 ? (
                    <div className="space-y-1">
                      {selectedLog.recipients.map((email, index) => (
                        <div key={index} className="text-sm text-slate-300">{email}</div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-400 text-sm">No recipients data available</p>
                  )}
                </div>
              </div>

              {selectedLog.content && (
                <div>
                  <label className="text-sm font-medium text-slate-400">Content Preview</label>
                  <div className="mt-1 p-3 bg-slate-700/50 rounded text-sm text-slate-300 max-h-32 overflow-y-auto">
                    {selectedLog.content}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-3 p-6 border-t border-slate-700">
              {selectedLog.status === 'failed' && selectedLog.recipients && selectedLog.recipients.length > 0 && (
                <Button
                  onClick={() => {
                    setShowDetailsModal(false);
                    handleResendEmail(selectedLog);
                  }}
                  disabled={resendingEmails.has(selectedLog.id)}
                  className="bg-orange-600 hover:bg-orange-700 text-white"
                >
                  {resendingEmails.has(selectedLog.id) ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RotateCcw className="h-4 w-4 mr-2" />
                  )}
                  Resend Email
                </Button>
              )}
              <Button
                variant="outline"
                onClick={() => setShowDetailsModal(false)}
                className="border-slate-600 text-slate-300 hover:bg-slate-700"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Email Players Modal */}
      <EmailPlayersModal
        isOpen={showEmailModal}
        onClose={() => setShowEmailModal(false)}
        allGames={allGames}
        onSuccess={() => {
          loadEmailLogs(); // Refresh the email logs after sending
        }}
      />
    </div>
  );
}
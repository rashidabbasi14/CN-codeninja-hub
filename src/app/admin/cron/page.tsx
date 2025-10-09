
"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Clock, 
  Play, 
  Square, 
  RotateCcw, 
  Trash2, 
  Activity, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Mail,
  Calendar,
  Database,
  RefreshCw,
  Settings
} from "lucide-react";
import { useUser } from "@/contexts/UserContext";
import Navigation from "@/components/Navigation";
import AdminNavbar from "@/components/AdminNavbar";

interface CronStatus {
  success: boolean;
  initialized: boolean;
  jobs: Record<string, boolean>;
  availableJobs: string[];
  message?: string;
}

interface CronActionResponse {
  success: boolean;
  message: string;
  startedCount?: number;
  stoppedCount?: number;
  destroyedCount?: number;
}

const JOB_DESCRIPTIONS = {
  gameReminders: {
    name: "Game Reminders",
    description: "Sends reminder emails 10 minutes before games start",
    schedule: "Every minute",
    icon: Mail,
    color: "text-blue-500"
  },
  earlyGameReminders: {
    name: "Early Game Reminders", 
    description: "Sends reminder emails 30 minutes before games start",
    schedule: "Every 5 minutes",
    icon: Calendar,
    color: "text-green-500"
  },
  cacheCleanup: {
    name: "Cache Cleanup",
    description: "Cleans up expired cache entries",
    schedule: "Every hour",
    icon: Database,
    color: "text-purple-500"
  }
};

export default function CronManagement() {
  const { user } = useUser();
  const [cronStatus, setCronStatus] = useState<CronStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchCronStatus();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    fetchCronStatus();
  }, []);

  const fetchCronStatus = async () => {
    try {
      const response = await fetch('/api/admin/cron');
      const data = await response.json();
      setCronStatus(data);
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Failed to fetch cron status:', error);
      setMessage({ type: 'error', text: 'Failed to fetch cron status' });
    } finally {
      setLoading(false);
    }
  };

  const performAction = async (action: string, jobName?: string) => {
    const actionKey = jobName ? `${action}-${jobName}` : action;
    setActionLoading(actionKey);
    setMessage(null);

    try {
      const response = await fetch('/api/admin/cron', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action, jobName }),
      });

      const data: CronActionResponse = await response.json();
      
      if (data.success) {
        setMessage({ type: 'success', text: data.message });
        // Refresh status after action
        setTimeout(() => fetchCronStatus(), 1000);
      } else {
        setMessage({ type: 'error', text: data.message || 'Action failed' });
      }
    } catch (error) {
      console.error('Action failed:', error);
      setMessage({ type: 'error', text: 'Failed to perform action' });
    } finally {
      setActionLoading(null);
    }
  };

  const testReminders = async () => {
    setActionLoading('test-reminders');
    setMessage(null);

    try {
      const response = await fetch('/api/admin/test-reminders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ minutesBefore: 10 }),
      });

      const data = await response.json();
      
      if (data.success) {
        setMessage({ type: 'success', text: 'Test reminders sent successfully' });
      } else {
        setMessage({ type: 'error', text: data.error || 'Test failed' });
      }
    } catch (error) {
      console.error('Test failed:', error);
      setMessage({ type: 'error', text: 'Failed to send test reminders' });
    } finally {
      setActionLoading(null);
    }
  };

  const healthCheck = async () => {
    setActionLoading('health-check');
    setMessage(null);

    try {
      const response = await fetch('/api/admin/cron/health');
      const data = await response.json();
      
      if (data.success) {
        setMessage({ type: 'success', text: data.message });
        // Refresh status after health check
        setTimeout(() => fetchCronStatus(), 1000);
      } else {
        setMessage({ type: 'error', text: data.error || 'Health check failed' });
      }
    } catch (error) {
      console.error('Health check failed:', error);
      setMessage({ type: 'error', text: 'Failed to perform health check' });
    } finally {
      setActionLoading(null);
    }
  };

  const forceRestart = async () => {
    setActionLoading('force-restart');
    setMessage(null);

    try {
      const response = await fetch('/api/admin/cron/health', {
        method: 'POST',
      });
      const data = await response.json();
      
      if (data.success) {
        setMessage({ type: 'success', text: data.message });
        // Refresh status after restart
        setTimeout(() => fetchCronStatus(), 1000);
      } else {
        setMessage({ type: 'error', text: data.error || 'Force restart failed' });
      }
    } catch (error) {
      console.error('Force restart failed:', error);
      setMessage({ type: 'error', text: 'Failed to force restart' });
    } finally {
      setActionLoading(null);
    }
  };

  if (!user || (user.role !== 'ADMIN' && user.role !== 'MODERATOR')) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100">
        <Navigation />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-red-400 mb-4">Access Denied</h1>
            <p className="text-slate-300">You need admin or moderator privileges to access this page.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <Navigation />
      <AdminNavbar />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-white flex items-center">
                <Clock className="h-8 w-8 mr-3 text-blue-400" />
                Cron Job Management
              </h1>
              <p className="text-slate-300 mt-2">
                Manage automated tasks and game reminder schedules
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                onClick={fetchCronStatus}
                disabled={loading}
                variant="outline"
                size="sm"
                className="border-slate-600 text-slate-300 hover:bg-slate-700"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <span className="text-xs text-slate-400">
                Last updated: {lastRefresh.toLocaleTimeString()}
              </span>
            </div>
          </div>

          {message && (
            <div className={`p-4 rounded-lg mb-4 ${
              message.type === 'success' ? 'bg-green-900/50 border border-green-700 text-green-300' :
              message.type === 'error' ? 'bg-red-900/50 border border-red-700 text-red-300' :
              'bg-blue-900/50 border border-blue-700 text-blue-300'
            }`}>
              <div className="flex items-center">
                {message.type === 'success' && <CheckCircle className="h-5 w-5 mr-2" />}
                {message.type === 'error' && <XCircle className="h-5 w-5 mr-2" />}
                {message.type === 'info' && <AlertCircle className="h-5 w-5 mr-2" />}
                {message.text}
              </div>
            </div>
          )}
        </div>

        {loading ? (
          <div className="text-center py-12">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-400" />
            <p className="text-slate-300">Loading cron job status...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* System Status */}
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center">
                  <Activity className="h-5 w-5 mr-2 text-green-400" />
                  System Status
                </CardTitle>
                <CardDescription className="text-slate-300">
                  Overall cron service health and statistics
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-slate-700 p-4 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300">Service Status</span>
                      {cronStatus?.initialized ? (
                        <CheckCircle className="h-5 w-5 text-green-400" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-400" />
                      )}
                    </div>
                    <p className="text-lg font-semibold text-white mt-1">
                      {cronStatus?.initialized ? 'Initialized' : 'Not Initialized'}
                    </p>
                  </div>
                  
                  <div className="bg-slate-700 p-4 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300">Active Jobs</span>
                      <Settings className="h-5 w-5 text-blue-400" />
                    </div>
                    <p className="text-lg font-semibold text-white mt-1">
                      {cronStatus?.jobs ? Object.values(cronStatus.jobs).filter(Boolean).length : 0} / {cronStatus?.availableJobs?.length || 0}
                    </p>
                  </div>
                  
                  <div className="bg-slate-700 p-4 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300">Total Jobs</span>
                      <Clock className="h-5 w-5 text-purple-400" />
                    </div>
                    <p className="text-lg font-semibold text-white mt-1">
                      {cronStatus?.availableJobs?.length || 0}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Global Actions */}
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Global Actions</CardTitle>
                <CardDescription className="text-slate-300">
                  Control all cron jobs at once
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-3">
                  <Button
                    onClick={() => performAction('start')}
                    disabled={actionLoading === 'start'}
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    <Play className="h-4 w-4 mr-2" />
                    {actionLoading === 'start' ? 'Starting...' : 'Start All'}
                  </Button>
                  
                  <Button
                    onClick={() => performAction('stop')}
                    disabled={actionLoading === 'stop'}
                    className="bg-red-600 hover:bg-red-700 text-white"
                  >
                    <Square className="h-4 w-4 mr-2" />
                    {actionLoading === 'stop' ? 'Stopping...' : 'Stop All'}
                  </Button>
                  
                  <Button
                    onClick={() => performAction('restart')}
                    disabled={actionLoading === 'restart'}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    {actionLoading === 'restart' ? 'Restarting...' : 'Restart All'}
                  </Button>
                  
                  <Button
                    onClick={() => performAction('initialize')}
                    disabled={actionLoading === 'initialize'}
                    variant="outline"
                    className="border-slate-600 text-slate-300 hover:bg-slate-700"
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    {actionLoading === 'initialize' ? 'Initializing...' : 'Initialize'}
                  </Button>
                  
                  <Button
                    onClick={testReminders}
                    disabled={actionLoading === 'test-reminders'}
                    variant="outline"
                    className="border-blue-600 text-blue-300 hover:bg-blue-900/20"
                  >
                    <Mail className="h-4 w-4 mr-2" />
                    {actionLoading === 'test-reminders' ? 'Testing...' : 'Test Reminders'}
                  </Button>
                  
                  <Button
                    onClick={healthCheck}
                    disabled={actionLoading === 'health-check'}
                    variant="outline"
                    className="border-green-600 text-green-300 hover:bg-green-900/20"
                  >
                    <Activity className="h-4 w-4 mr-2" />
                    {actionLoading === 'health-check' ? 'Checking...' : 'Health Check'}
                  </Button>
                  
                  <Button
                    onClick={forceRestart}
                    disabled={actionLoading === 'force-restart'}
                    variant="outline"
                    className="border-orange-600 text-orange-300 hover:bg-orange-900/20"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    {actionLoading === 'force-restart' ? 'Restarting...' : 'Force Restart'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Individual Jobs */}
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {cronStatus?.availableJobs?.map((jobName) => {
                const jobInfo = JOB_DESCRIPTIONS[jobName as keyof typeof JOB_DESCRIPTIONS];
                const isRunning = cronStatus.jobs[jobName];
                const IconComponent = jobInfo?.icon || Clock;
                
                return (
                  <Card key={jobName} className="bg-slate-800 border-slate-700">
                    <CardHeader>
                      <CardTitle className="text-white flex items-center justify-between">
                        <div className="flex items-center">
                          <IconComponent className={`h-5 w-5 mr-2 ${jobInfo?.color || 'text-gray-400'}`} />
                          {jobInfo?.name || jobName}
                        </div>
                        <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                          isRunning 
                            ? 'bg-green-900/50 text-green-300 border border-green-700' 
                            : 'bg-red-900/50 text-red-300 border border-red-700'
                        }`}>
                          {isRunning ? 'Running' : 'Stopped'}
                        </div>
                      </CardTitle>
                      <CardDescription className="text-slate-300">
                        {jobInfo?.description || 'No description available'}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="text-sm text-slate-400">
                          <strong>Schedule:</strong> {jobInfo?.schedule || 'Unknown'}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            onClick={() => performAction('start', jobName)}
                            disabled={actionLoading === `start-${jobName}` || isRunning}
                            size="sm"
                            className="bg-green-600 hover:bg-green-700 text-white disabled:opacity-50"
                          >
                            <Play className="h-3 w-3 mr-1" />
                            {actionLoading === `start-${jobName}` ? 'Starting...' : 'Start'}
                          </Button>
                          
                          <Button
                            onClick={() => performAction('stop', jobName)}
                            disabled={actionLoading === `stop-${jobName}` || !isRunning}
                            size="sm"
                            className="bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
                          >
                            <Square className="h-3 w-3 mr-1" />
                            {actionLoading === `stop-${jobName}` ? 'Stopping...' : 'Stop'}
                          </Button>
                          
                          <Button
                            onClick={() => performAction('restart', jobName)}
                            disabled={actionLoading === `restart-${jobName}`}
                            size="sm"
                            variant="outline"
                            className="border-slate-600 text-slate-300 hover:bg-slate-700 disabled:opacity-50"
                          >
                            <RotateCcw className="h-3 w-3 mr-1" />
                            {actionLoading === `restart-${jobName}` ? 'Restarting...' : 'Restart'}
                          </Button>
                          
                          <Button
                            onClick={() => performAction('destroy', jobName)}
                            disabled={actionLoading === `destroy-${jobName}`}
                            size="sm"
                            variant="outline"
                            className="border-red-600 text-red-300 hover:bg-red-900/20 disabled:opacity-50"
                          >
                            <Trash2 className="h-3 w-3 mr-1" />
                            {actionLoading === `destroy-${jobName}` ? 'Destroying...' : 'Destroy'}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
                
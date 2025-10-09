
"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Settings, Save, RefreshCw, Plus, Trash2, Edit, Power, PowerOff, ChevronRight, Info, Mail, Database, Shield, Globe } from "lucide-react";
import { useUser } from "@/contexts/UserContext";
import { useAlert } from "@/contexts/AlertContext";
import Navigation from "@/components/Navigation";
import AdminNavbar from "@/components/AdminNavbar";
import { hasAdminAccess } from "@/lib/auth";

interface ConfigItem {
  key: string;
  value: string;
  description?: string;
  category: string;
}

type ConfigCategory = 'EMAIL' | 'SYSTEM' | 'SECURITY' | 'GENERAL';

interface CategoryInfo {
  id: ConfigCategory;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

const categories: CategoryInfo[] = [
  {
    id: 'EMAIL',
    name: 'Email Settings',
    description: 'Configure email notifications and templates',
    icon: Mail,
    color: 'blue'
  },
  {
    id: 'SYSTEM',
    name: 'System Settings',
    description: 'Core system configuration options',
    icon: Database,
    color: 'green'
  },
  {
    id: 'SECURITY',
    name: 'Security Settings',
    description: 'Authentication and security policies',
    icon: Shield,
    color: 'red'
  },
  {
    id: 'GENERAL',
    name: 'General Settings',
    description: 'Miscellaneous application settings',
    icon: Globe,
    color: 'purple'
  }
];

export default function ConfigurationsPage() {
  const { user, apiCall } = useUser();
  const { showSuccess, showError } = useAlert();
  const [configs, setConfigs] = useState<ConfigItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeCategory, setActiveCategory] = useState<ConfigCategory>('EMAIL');
  const [editingConfig, setEditingConfig] = useState<ConfigItem | null>(null);
  const [newConfig, setNewConfig] = useState({ key: '', value: '', description: '', category: 'EMAIL' });
  const [showAddForm, setShowAddForm] = useState(false);

  const loadConfigs = async (category?: ConfigCategory) => {
    setLoading(true);
    try {
      const url = category ? `/api/admin/config?category=${category}` : '/api/admin/config';
      const response = await apiCall(url);
      if (response.ok) {
        const data = await response.json();
        setConfigs(data.configs || []);
      } else {
        showError('Failed to load configurations');
      }
    } catch (error) {
      console.error('Error loading configs:', error);
      showError('Error loading configurations');
    } finally {
      setLoading(false);
    }
  };

  const initializeDefaults = async () => {
    setSaving(true);
    try {
      const response = await apiCall('/api/admin/config', {
        method: 'PUT',
        body: JSON.stringify({ action: 'initialize_defaults' })
      });

      if (response.ok) {
        showSuccess('Default configurations initialized successfully');
        await loadConfigs(activeCategory);
      } else {
        showError('Failed to initialize default configurations');
      }
    } catch (error) {
      console.error('Error initializing defaults:', error);
      showError('Error initializing configurations');
    } finally {
      setSaving(false);
    }
  };

  const saveConfig = async (config: ConfigItem) => {
    setSaving(true);
    try {
      const response = await apiCall('/api/admin/config', {
        method: 'POST',
        body: JSON.stringify(config)
      });

      if (response.ok) {
        showSuccess('Configuration saved successfully');
        setEditingConfig(null);
        await loadConfigs(activeCategory);
      } else {
        showError('Failed to save configuration');
      }
    } catch (error) {
      console.error('Error saving config:', error);
      showError('Error saving configuration');
    } finally {
      setSaving(false);
    }
  };

  const addConfig = async () => {
    if (!newConfig.key || !newConfig.value) {
      showError('Key and value are required');
      return;
    }

    const configToSave = { ...newConfig, category: activeCategory };
    await saveConfig(configToSave);
    setNewConfig({ key: '', value: '', description: '', category: activeCategory });
    setShowAddForm(false);
  };

  const deleteConfig = async (key: string) => {
    if (!confirm('Are you sure you want to delete this configuration?')) {
      return;
    }

    setSaving(true);
    try {
      const response = await apiCall(`/api/admin/config?key=${encodeURIComponent(key)}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        showSuccess('Configuration deleted successfully');
        await loadConfigs(activeCategory);
      } else {
        showError('Failed to delete configuration');
      }
    } catch (error) {
      console.error('Error deleting config:', error);
      showError('Error deleting configuration');
    } finally {
      setSaving(false);
    }
  };

  const getConfigDisplayName = (key: string) => {
    const names: { [key: string]: string } = {
      'email.match_scheduled.enabled': 'Match Scheduled Notifications',
      'email.game_reminders.enabled': 'Game Reminder Notifications',
      'email.team_join.enabled': 'Team Join Notifications',
      'email.welcome.enabled': 'Welcome Email Notifications',
      'email.password_reset.enabled': 'Password Reset Notifications',
      'system.maintenance_mode.enabled': 'Maintenance Mode',
      'system.registration.enabled': 'User Registration',
      'system.max_team_size': 'Maximum Team Size',
      'security.password_min_length': 'Minimum Password Length',
      'security.session_timeout': 'Session Timeout (minutes)',
      'security.max_login_attempts': 'Maximum Login Attempts'
    };
    return names[key] || key;
  };

  const getConfigDescription = (key: string) => {
    const descriptions: { [key: string]: string } = {
      'email.match_scheduled.enabled': 'Send notifications when matches are scheduled by administrators',
      'email.game_reminders.enabled': 'Send reminder emails before games start',
      'email.team_join.enabled': 'Notify team members when someone joins their team',
      'email.welcome.enabled': 'Send welcome emails to new users',
      'email.password_reset.enabled': 'Send password reset emails when requested',
      'system.maintenance_mode.enabled': 'Enable maintenance mode to restrict access',
      'system.registration.enabled': 'Allow new user registrations',
      'system.max_team_size': 'Maximum number of members allowed per team',
      'security.password_min_length': 'Minimum required password length',
      'security.session_timeout': 'Session timeout duration in minutes',
      'security.max_login_attempts': 'Maximum failed login attempts before lockout'
    };
    return descriptions[key] || 'Custom configuration setting';
  };

  const getBooleanValue = (value: string) => {
    return value.toLowerCase() === 'true' || value === '1';
  };

  const toggleBooleanConfig = async (config: ConfigItem) => {
    const newValue = getBooleanValue(config.value) ? 'false' : 'true';
    await saveConfig({ ...config, value: newValue });
  };

  const getCategoryColor = (category: string) => {
    const categoryInfo = categories.find(c => c.id === category);
    return categoryInfo?.color || 'blue';
  };

  const getCategoryIcon = (category: string) => {
    const categoryInfo = categories.find(c => c.id === category);
    return categoryInfo?.icon || Settings;
  };

  const getCategoryGradient = (category: ConfigCategory) => {
    const gradientMap = {
      'EMAIL': 'from-blue-500 to-blue-600',
      'SYSTEM': 'from-green-500 to-green-600',
      'SECURITY': 'from-red-500 to-red-600',
      'GENERAL': 'from-purple-500 to-purple-600'
    };
    return gradientMap[category] || 'from-slate-500 to-slate-600';
  };

  const getCategoryButtonClass = (category: ConfigCategory) => {
    const buttonMap = {
      'EMAIL': 'bg-blue-600 hover:bg-blue-700',
      'SYSTEM': 'bg-green-600 hover:bg-green-700',
      'SECURITY': 'bg-red-600 hover:bg-red-700',
      'GENERAL': 'bg-purple-600 hover:bg-purple-700'
    };
    return buttonMap[category] || 'bg-slate-600 hover:bg-slate-700';
  };

  const getCategoryIconClasses = (category: ConfigCategory, isEnabled?: boolean) => {
    if (isEnabled === false) return 'bg-slate-600/20 border border-slate-600/30';
    
    const classMap = {
      'EMAIL': 'bg-blue-500/20 border border-blue-500/30',
      'SYSTEM': 'bg-green-500/20 border border-green-500/30',
      'SECURITY': 'bg-red-500/20 border border-red-500/30',
      'GENERAL': 'bg-purple-500/20 border border-purple-500/30'
    };
    return classMap[category] || 'bg-slate-500/20 border border-slate-500/30';
  };

  const getCategoryTextClasses = (category: ConfigCategory, isEnabled?: boolean) => {
    if (isEnabled === false) return 'text-slate-400';
    
    const classMap = {
      'EMAIL': 'text-blue-400',
      'SYSTEM': 'text-green-400',
      'SECURITY': 'text-red-400',
      'GENERAL': 'text-purple-400'
    };
    return classMap[category] || 'text-slate-400';
  };

  const getCategoryBadgeClasses = (category: ConfigCategory, isEnabled?: boolean) => {
    if (isEnabled === false) return 'bg-slate-600/20 text-slate-400';
    
    const classMap = {
      'EMAIL': 'bg-blue-500/20 text-blue-400',
      'SYSTEM': 'bg-green-500/20 text-green-400',
      'SECURITY': 'bg-red-500/20 text-red-400',
      'GENERAL': 'bg-purple-500/20 text-purple-400'
    };
    return classMap[category] || 'bg-slate-500/20 text-slate-400';
  };

  const getEmptyStateTitle = (category: ConfigCategory) => {
    const titleMap = {
      'EMAIL': 'No Email Configurations',
      'SYSTEM': 'No System Configurations',
      'SECURITY': 'No Security Configurations',
      'GENERAL': 'No General Configurations'
    };
    return titleMap[category] || 'No Configurations';
  };

  const getEmptyStateDescription = (category: ConfigCategory) => {
    const descriptionMap = {
      'EMAIL': 'Set up email notifications, SMTP settings, and template configurations to enable automated communications.',
      'SYSTEM': 'Configure core system settings, performance options, and operational parameters to optimize your application.',
      'SECURITY': 'Establish security policies, authentication settings, and access controls to protect your system.',
      'GENERAL': 'Customize general application settings, user preferences, and miscellaneous configuration options.'
    };
    return descriptionMap[category] || 'No configurations found for this category.';
  };

  const filteredConfigs = configs.filter(config => config.category === activeCategory);

  useEffect(() => {
    // Only load configs if user is authenticated and has admin access
    if (user && hasAdminAccess(user)) {
      loadConfigs(activeCategory);
    }
  }, [activeCategory, user]);

  // Redirect logged out users to login
  useEffect(() => {
    if (user === null) {
      // Check if we're still loading user context
      const token = localStorage.getItem('codeninja-token');
      if (!token) {
        // No token, redirect to login
        window.location.href = '/auth/login';
      }
    }
  }, [user]);

  // Show loading while user context is initializing
  if (user === null) {
    return (
      <div className="min-h-screen bg-slate-900 text-white">
        <Navigation />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <RefreshCw className="h-12 w-12 animate-spin mx-auto mb-4 text-blue-400" />
            <h1 className="text-2xl font-bold text-white mb-2">Redirecting to login...</h1>
            <p className="text-slate-400">Please wait while we redirect you.</p>
          </div>
        </div>
      </div>
    );
  }

  // Check admin access after user is loaded
  if (!hasAdminAccess(user)) {
    return (
      <div className="min-h-screen bg-slate-900 text-white">
        <Navigation />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-red-400 mb-4">Access Denied</h1>
            <p className="text-slate-300">You don't have permission to access this page.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <Navigation />
      <AdminNavbar />
      
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-blue-500/20 rounded-xl border border-blue-500/30">
                <Settings className="h-8 w-8 text-blue-400" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white mb-1">System Configurations</h1>
                <p className="text-slate-400">Manage system-wide settings and preferences</p>
              </div>
            </div>
            
            {/* Quick Stats */}
            <div className="hidden md:flex items-center space-x-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-400">{filteredConfigs.filter(c => getBooleanValue(c.value)).length}</div>
                <div className="text-xs text-slate-400 uppercase tracking-wide">Enabled</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-slate-400">{filteredConfigs.filter(c => !getBooleanValue(c.value)).length}</div>
                <div className="text-xs text-slate-400 uppercase tracking-wide">Disabled</div>
              </div>
            </div>
          </div>

          {/* Category Tabs */}
          <div className="flex flex-wrap gap-2 mb-6">
            {categories.map((category) => {
              const Icon = category.icon;
              const isActive = activeCategory === category.id;
              return (
                <button
                  key={category.id}
                  onClick={() => setActiveCategory(category.id)}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-lg border transition-all duration-200 ${
                    isActive
                      ? `bg-${category.color}-500/20 border-${category.color}-500/50 text-${category.color}-300`
                      : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:bg-slate-700/50 hover:border-slate-600'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="font-medium">{category.name}</span>
                </button>
              );
            })}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={() => loadConfigs(activeCategory)}
              disabled={loading}
              variant="outline"
              size="sm"
              className="border-slate-600 hover:border-slate-500 hover:bg-slate-700"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            
            <Button
              onClick={initializeDefaults}
              disabled={saving}
              variant="outline"
              size="sm"
              className="border-slate-600 hover:border-slate-500 hover:bg-slate-700"
            >
              <Settings className="h-4 w-4 mr-2" />
              Initialize Defaults
            </Button>

            <Button
              onClick={() => setShowAddForm(!showAddForm)}
              variant="outline"
              size="sm"
              className="border-slate-600 hover:border-slate-500 hover:bg-slate-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Configuration
            </Button>
          </div>
        </div>

        {/* Category Description */}
        <div className="mb-6">
          <Card className="bg-slate-800/30 border-slate-700 backdrop-blur-sm">
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                {(() => {
                  const categoryInfo = categories.find(c => c.id === activeCategory);
                  const Icon = categoryInfo?.icon || Settings;
                  return (
                    <>
                      <div className={`p-2 bg-${categoryInfo?.color || 'blue'}-500/20 rounded-lg`}>
                        <Icon className={`h-5 w-5 text-${categoryInfo?.color || 'blue'}-400`} />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-white">{categoryInfo?.name}</h3>
                        <p className="text-slate-400 text-sm">{categoryInfo?.description}</p>
                      </div>
                    </>
                  );
                })()}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Add Config Form */}
        {showAddForm && (
          <Card className="mb-8 bg-slate-800/50 border-slate-700 backdrop-blur-sm">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-green-500/20 rounded-lg">
                    <Plus className="h-5 w-5 text-green-400" />
                  </div>
                  <div>
                    <CardTitle className="text-white text-lg">Add New Configuration</CardTitle>
                    <CardDescription className="text-slate-400">Create a custom configuration setting for {categories.find(c => c.id === activeCategory)?.name}</CardDescription>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-300">Configuration Key</label>
                  <Input
                    value={newConfig.key}
                    onChange={(e) => setNewConfig({ ...newConfig, key: e.target.value })}
                    placeholder={`e.g., ${activeCategory.toLowerCase()}.custom.enabled`}
                    className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-blue-500"
                  />
                  <p className="text-xs text-slate-500">Use dot notation for hierarchical keys</p>
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-300">Value</label>
                  <Input
                    value={newConfig.value}
                    onChange={(e) => setNewConfig({ ...newConfig, value: e.target.value })}
                    placeholder="e.g., true"
                    className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-blue-500"
                  />
                  <p className="text-xs text-slate-500">Use 'true' or 'false' for boolean settings</p>
                </div>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-300">Description</label>
                <Input
                  value={newConfig.description}
                  onChange={(e) => setNewConfig({ ...newConfig, description: e.target.value })}
                  placeholder="Brief description of what this configuration controls"
                  className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-blue-500"
                />
              </div>
              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-700">
                <Button
                  onClick={() => setShowAddForm(false)}
                  variant="outline"
                  className="border-slate-600 hover:border-slate-500"
                >
                  Cancel
                </Button>
                <Button
                  onClick={addConfig}
                  disabled={saving}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Save className="h-4 w-4 mr-2" />
                  Add Configuration
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Configurations List */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {loading ? (
            <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
              <CardContent className="p-12 text-center">
                <RefreshCw className="h-12 w-12 animate-spin mx-auto mb-6 text-blue-400" />
                <h3 className="text-xl font-semibold text-white mb-2">Loading Configurations</h3>
                <p className="text-slate-400">Please wait while we fetch your settings...</p>
              </CardContent>
            </Card>
          ) : filteredConfigs.length === 0 ? (
            <div className="col-span-full">
              <Card className="bg-gradient-to-br from-slate-800/40 to-slate-900/60 border-slate-700/50 backdrop-blur-sm overflow-hidden">
                <CardContent className="p-0">
                  <div className="relative">
                    {/* Background Pattern */}
                    <div className="absolute inset-0 opacity-5">
                      <div className="absolute inset-0" style={{
                        backgroundImage: `radial-gradient(circle at 25% 25%, ${getCategoryColor(activeCategory)} 2px, transparent 2px)`,
                        backgroundSize: '24px 24px'
                      }}></div>
                    </div>
                    
                    {/* Content */}
                    <div className="relative p-12 text-center">
                      <div className={`inline-flex p-6 rounded-2xl mb-6 bg-gradient-to-br ${getCategoryGradient(activeCategory)} shadow-lg`}>
                        {(() => {
                          const Icon = getCategoryIcon(activeCategory);
                          return <Icon className="h-12 w-12 text-white" />;
                        })()}
                      </div>
                      
                      <h3 className="text-2xl font-bold text-white mb-3">
                        {getEmptyStateTitle(activeCategory)}
                      </h3>
                      
                      <p className="text-slate-400 mb-8 max-w-lg mx-auto leading-relaxed">
                        {getEmptyStateDescription(activeCategory)}
                      </p>
                      
                      <div className="flex flex-col sm:flex-row justify-center gap-4">
                        <Button
                          onClick={initializeDefaults}
                          disabled={saving}
                          className={`${getCategoryButtonClass(activeCategory)} shadow-lg hover:shadow-xl transition-all duration-200`}
                          size="lg"
                        >
                          <Settings className="h-5 w-5 mr-2" />
                          Initialize Defaults
                        </Button>
                        <Button
                          onClick={() => setShowAddForm(true)}
                          variant="outline"
                          className="border-slate-600/50 hover:border-slate-500 hover:bg-slate-700/50 backdrop-blur-sm"
                          size="lg"
                        >
                          <Plus className="h-5 w-5 mr-2" />
                          Add Custom Setting
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            filteredConfigs.map((config) => {
              const CategoryIcon = getCategoryIcon(activeCategory);
              const isEnabled = getBooleanValue(config.value);
              const isToggleable = config.key.includes('.enabled');
              
              return (
                <Card key={config.key} className="bg-slate-800/50 border-slate-700 backdrop-blur-sm hover:bg-slate-800/70 transition-all duration-200 group">
                  <CardContent className="p-4">
                    <div className="space-y-4">
                      {/* Header with category icon and status */}
                      <div className="flex items-center justify-between">
                        <div className={`p-2 rounded-lg transition-colors ${
                          getCategoryIconClasses(activeCategory, isToggleable ? isEnabled : undefined)
                        }`}>
                          {isToggleable ? (
                            isEnabled ? (
                              <Power className={`h-5 w-5 ${getCategoryTextClasses(activeCategory, true)}`} />
                            ) : (
                              <PowerOff className="h-5 w-5 text-slate-400" />
                            )
                          ) : (
                            <CategoryIcon className={`h-5 w-5 ${getCategoryTextClasses(activeCategory, true)}`} />
                          )}
                        </div>
                        <span className={`text-xs px-2 py-1 rounded font-medium ${
                          getCategoryBadgeClasses(activeCategory, isToggleable ? isEnabled : undefined)
                        }`}>
                          {config.value}
                        </span>
                      </div>

                      {/* Title and description */}
                      <div>
                        <h3 className="text-sm font-semibold text-white mb-1 line-clamp-2 group-hover:text-slate-100 transition-colors">
                          {getConfigDisplayName(config.key)}
                        </h3>
                        <p className="text-slate-400 text-xs line-clamp-2 mb-2 group-hover:text-slate-300 transition-colors">
                          {config.description || getConfigDescription(config.key)}
                        </p>
                        <span className="text-xs text-slate-500 font-mono bg-slate-700/50 px-2 py-1 rounded block truncate">
                          {config.key}
                        </span>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center justify-between space-x-2">
                        {isToggleable ? (
                          <Button
                            onClick={() => toggleBooleanConfig(config)}
                            disabled={saving}
                            variant={isEnabled ? "default" : "outline"}
                            size="sm"
                            className={`flex-1 text-xs transition-all ${
                              isEnabled
                                ? getCategoryButtonClass(activeCategory)
                                : "border-slate-600 hover:border-slate-500 hover:bg-slate-700"
                            }`}
                          >
                            {isEnabled ? (
                              <>
                                <Power className="h-3 w-3 mr-1" />
                                On
                              </>
                            ) : (
                              <>
                                <PowerOff className="h-3 w-3 mr-1" />
                                Off
                              </>
                            )}
                          </Button>
                        ) : (
                          <Button
                            onClick={() => setEditingConfig(config)}
                            variant="outline"
                            size="sm"
                            className="flex-1 text-xs border-slate-600 hover:border-slate-500 hover:bg-slate-700"
                          >
                            <Edit className="h-3 w-3 mr-1" />
                            Edit
                          </Button>
                        )}
                        
                        <Button
                          onClick={() => deleteConfig(config.key)}
                          disabled={saving}
                          variant="outline"
                          size="sm"
                          className="text-red-400 hover:text-red-300 border-red-600/30 hover:border-red-500/50 hover:bg-red-500/10 px-2"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {/* Edit Config Modal */}
        {editingConfig && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
            <Card className="w-full max-w-lg bg-slate-800 border-slate-700">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-blue-500/20 rounded-lg">
                      <Edit className="h-5 w-5 text-blue-400" />
                    </div>
                    <div>
                      <CardTitle className="text-white">Edit Configuration</CardTitle>
                      <CardDescription className="text-slate-400">Modify the configuration value</CardDescription>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-300">Configuration Key</label>
                  <Input
                    value={editingConfig.key}
                    disabled
                    className="bg-slate-700/30 border-slate-600 text-slate-400 cursor-not-allowed"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-300">Value</label>
                  <Input
                    value={editingConfig.value}
                    onChange={(e) => setEditingConfig({ ...editingConfig, value: e.target.value })}
                    className="bg-slate-700/50 border-slate-600 text-white focus:border-blue-500"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-300">Description</label>
                  <Input
                    value={editingConfig.description || ''}
                    onChange={(e) => setEditingConfig({ ...editingConfig, description: e.target.value })}
                    className="bg-slate-700/50 border-slate-600 text-white focus:border-blue-500"
                  />
                </div>
                <div className="flex justify-end space-x-3 pt-4 border-t border-slate-700">
                  <Button
                    onClick={() => setEditingConfig(null)}
                    variant="outline"
                    className="border-slate-600 hover:border-slate-500"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => saveConfig(editingConfig)}
                    disabled={saving}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
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
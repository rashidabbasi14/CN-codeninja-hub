
"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Trophy, Plus, Edit, Trash2, Calendar, MapPin, Users, Target, Clock, Settings, UserPlus, X, UserMinus, Search, Filter, Archive, CheckCircle, XCircle, AlertCircle, RotateCcw, Mail } from "lucide-react";
import { useUser } from "@/contexts/UserContext";
import Link from "next/link";
import Navigation from "@/components/Navigation";
import AdminNavbar from "@/components/AdminNavbar";
import GameSchedulingInterface from "@/components/GameSchedulingInterface";
import { RichTextEditor } from "@/components/RichTextEditor";
import EmailPlayersModal from "@/components/EmailPlayersModal";
import { hasAdminAccess } from "@/lib/auth";

interface Category {
  id: string;
  name: string;
  gamesCountMode: string;
  startDate: string;
  endDate: string;
  registrationDeadline?: string;
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

interface TeamData {
  game: {
    id: string;
    name: string;
    typeFormat: string;
    contestType: string;
    levels?: string | string[];
  };
  teams: Array<{
    id: string;
    name: string;
    teamLead: string;
    leader: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      avatarUrl?: string;
    };
    members: Array<{
      user: {
        id: string;
        firstName: string;
        lastName: string;
        email: string;
        avatarUrl?: string;
      };
    }>;
  }>;
  individualRegistrations: Array<{
    id: string;
    user: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      avatarUrl?: string;
    };
  }>;
  availableUsers: Array<{
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    avatarUrl?: string;
  }>;
}

const contestTypeLabels = {
  SINGLE_ELIMINATION: "Single Elimination",
  SINGLE_ELIMINATION_1V1V1V1: "Single Elimination (4 Participants)",
  DOUBLE_ELIMINATION: "Double Elimination",
  ROUND_ROBIN: "Round Robin",
  ROUND_ROBIN_HOME_AWAY: "Round Robin (Home/Away)",
  GROUP_STAGE_KNOCKOUT: "Group Stage → Knockout",
  SWISS_SYSTEM: "Swiss System",
  LADDER: "Ladder",
  TIME_BOXED_LEAGUE: "Time-boxed League",
  FRIENDLY: "Friendly",
  SCORING: "Scoring Contest"
};

export default function AdminEventsPage() {
  const { apiCall, user, loading: userLoading } = useUser();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [scrollPosition, setScrollPosition] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [showAddGameForm, setShowAddGameForm] = useState(false);
  const [showAddVenueForm, setShowAddVenueForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: '',
    startDate: '',
    endDate: '',
    registrationDeadline: '',
    locationName: '',
    locationMapsLink: '',
    perPersonCap: 2,
    isUnlimitedCap: false,
    dailyWindows: [{ start: '09:00', end: '17:00' }]
  });
  const [gameFormData, setGameFormData] = useState({
    name: '',
    description: '',
    weightage: 1,
    typeFormat: '1v1',
    contestType: 'SINGLE_ELIMINATION',
    avgGameTime: 30,
    levels: ['Beginner'],
    simultaneousGames: 1,
    oneLoserMode: false
  });
  const [submitting, setSubmitting] = useState(false);
  const [showTeamManagement, setShowTeamManagement] = useState(false);
  const [selectedGameForTeams, setSelectedGameForTeams] = useState<string | null>(null);
  const [teamData, setTeamData] = useState<TeamData | null>(null);
  const [loadingTeams, setLoadingTeams] = useState(false);
  const [memberSearchTerms, setMemberSearchTerms] = useState<Record<string, string>>({});
  const [showIncompleteOnly, setShowIncompleteOnly] = useState(false);
  const [gameStats, setGameStats] = useState<Record<string, any>>({});
  const [editingGame, setEditingGame] = useState<any>(null);
  const [showSchedulingInterface, setShowSchedulingInterface] = useState(false);
  const [selectedGameForScheduling, setSelectedGameForScheduling] = useState<string | null>(null);

  // Register Player Modal State
  const [showRegisterPlayerModal, setShowRegisterPlayerModal] = useState(false);
  const [selectedGameForRegistration, setSelectedGameForRegistration] = useState<any>(null);
  const [availableUsers, setAvailableUsers] = useState<any[]>([]);
  const [selectedUsersForRegistration, setSelectedUsersForRegistration] = useState<string[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [globalSearchTerm, setGlobalSearchTerm] = useState('');

  // Helper functions to check if sections have matching results
  const hasRegisteredPlayersMatches = () => {
    if (!teamData || !globalSearchTerm.trim()) return true;
    const searchLower = globalSearchTerm.toLowerCase();
    return teamData.individualRegistrations.some((reg: any) => {
      const fullName = `${reg.user.firstName} ${reg.user.lastName}`.toLowerCase();
      const email = reg.user.email.toLowerCase();
      return fullName.includes(searchLower) || email.includes(searchLower);
    });
  };

  const hasUnregisteredPlayersMatches = () => {
    if (!teamData || !globalSearchTerm.trim()) return true;
    const searchLower = globalSearchTerm.toLowerCase();
    return teamData.availableUsers.some((user: any) => {
      const fullName = `${user.firstName} ${user.lastName}`.toLowerCase();
      const email = user.email.toLowerCase();
      return fullName.includes(searchLower) || email.includes(searchLower);
    });
  };

  const hasTeamsMatches = () => {
    if (!teamData || !globalSearchTerm.trim()) return true;
    return getFilteredTeams().length > 0;
  };

  const hasIndividualRegistrationsMatches = () => {
    if (!teamData || !globalSearchTerm.trim()) return true;
    const searchLower = globalSearchTerm.toLowerCase();
    return teamData.individualRegistrations.some((reg: any) => {
      const fullName = `${reg.user.firstName} ${reg.user.lastName}`.toLowerCase();
      const email = reg.user.email.toLowerCase();
      return fullName.includes(searchLower) || email.includes(searchLower);
    });
  };

  // Auto-manage section visibility based on search results
  useEffect(() => {
    if (!globalSearchTerm.trim()) {
      // When no search term, show default sections
      setShowRegisteredPlayersSection(true);
      setShowUnregisteredPlayersSection(false);
      setShowTeamsSection(true);
      setShowIndividualRegistrationsSection(true);
    } else {
      // When searching, show sections with matches and hide empty ones
      setShowRegisteredPlayersSection(hasRegisteredPlayersMatches());
      setShowUnregisteredPlayersSection(hasUnregisteredPlayersMatches());
      setShowTeamsSection(hasTeamsMatches());
      setShowIndividualRegistrationsSection(hasIndividualRegistrationsMatches());
    }
  }, [globalSearchTerm, teamData]);
  const [registrationFormData, setRegistrationFormData] = useState({
    level: 'Beginner',
    mode: 'INDIVIDUAL'
  });

  // State for collapsible sections in Player Management Modal
  const [showRegisteredPlayersSection, setShowRegisteredPlayersSection] = useState(true);
  const [showUnregisteredPlayersSection, setShowUnregisteredPlayersSection] = useState(false);
  const [showTeamsSection, setShowTeamsSection] = useState(true);
  const [showIndividualRegistrationsSection, setShowIndividualRegistrationsSection] = useState(true);
  
  // State for collapsible create team section in Player Management Modal
  const [showCreateTeamSection, setShowCreateTeamSection] = useState(false);

  // State for team name editing
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [editingTeamName, setEditingTeamName] = useState('');

  // Email Players Modal State
  const [showEmailPlayersModal, setShowEmailPlayersModal] = useState(false);
  const [allGames, setAllGames] = useState<any[]>([]);

  // Bulk Registration Modal State
  const [showBulkRegisterModal, setShowBulkRegisterModal] = useState(false);
  const [bulkRegisterData, setBulkRegisterData] = useState({
    emails: '',
    selectedCategoryId: '',
    selectedGameId: ''
  });
  const [bulkRegisterLoading, setBulkRegisterLoading] = useState(false);
  const [bulkRegisterResults, setBulkRegisterResults] = useState<any>(null);

  useEffect(() => {
    // Only load data when user context is ready
    if (!userLoading) {
      if (user) {
        // Check if user is admin or moderator
        if (user.role !== 'ADMIN' && user.role !== 'MODERATOR') {
          // Redirect non-admin/moderator users
          window.location.href = '/dashboard';
          return;
        }
        loadCategories();
      } else {
        // User is not logged in, redirect to login
        window.location.href = '/auth/login';
        return;
      }
    }
  }, [userLoading, user]);

  useEffect(() => {
    // Load game stats when categories are loaded
    if (categories.length > 0) {
      loadGameStats();
    }
  }, [categories]);

  const loadCategories = async (preserveScroll = false) => {
    // Save current scroll position if preserving
    if (preserveScroll) {
      setScrollPosition(window.scrollY);
    }
    
    setLoading(true);
    try {
      const response = await apiCall('/api/categories');
      if (response.ok) {
        const data = await response.json();
        setCategories(data);
        
        // Restore scroll position after a brief delay to allow DOM updates
        if (preserveScroll) {
          setTimeout(() => {
            window.scrollTo(0, scrollPosition);
          }, 100);
        }
      }
    } catch (error) {
      console.error('Failed to load categories:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCategory = async (categoryId: string) => {
    if (!confirm('Are you sure you want to delete this category?')) return;
    
    try {
      const response = await apiCall(`/api/categories/${categoryId}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        await loadCategories(true);
      }
    } catch (error) {
      console.error('Failed to delete category:', error);
    }
  };

  const handleCategoryStatusChange = async (categoryId: string, status: string) => {
    const statusLabels = {
      'COMPLETED': 'complete',
      'ABANDONED': 'abandon',
      'ARCHIVED': 'archive'
    };
    
    const action = statusLabels[status as keyof typeof statusLabels] || 'update';
    
    if (!confirm(`Are you sure you want to ${action} this category?`)) return;
    
    try {
      const response = await apiCall(`/api/categories/${categoryId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status })
      });
      
      if (response.ok) {
        await loadCategories(true);
      } else {
        const error = await response.json();
        alert(`Failed to ${action} category: ` + (error.error || 'Unknown error'));
      }
    } catch (error) {
      console.error(`Failed to ${action} category:`, error);
      alert(`Failed to ${action} category. Please try again.`);
    }
  };

  const handleDeleteGame = async (gameId: string) => {
    if (!confirm('Are you sure you want to delete this game?')) return;
    
    try {
      const response = await apiCall(`/api/games/${gameId}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        await loadCategories(true);
      }
    } catch (error) {
      console.error('Failed to delete game:', error);
    }
  };

  const handleResetGame = async (gameId: string) => {
    if (!confirm('Are you sure you want to reset this game? This will remove all registrations and schedules for this game.')) return;
    
    try {
      const response = await apiCall(`/api/admin/games/${gameId}/reset`, {
        method: 'POST'
      });
      
      if (response.ok) {
        await loadCategories(true);
      }
    } catch (error) {
      console.error('Failed to reset game:', error);
      alert('Failed to reset game. Please try again.');
    }
  };

  const handleResetAllGames = async (categoryId: string, categoryName: string) => {
    if (!confirm(`Are you sure you want to reset ALL games in "${categoryName}"? This will remove all registrations, matches, and teams for ALL games in this category. This action cannot be undone.`)) return;
    
    try {
      const response = await apiCall(`/api/categories/${categoryId}/reset-all-games`, {
        method: 'POST'
      });
      
      if (response.ok) {
        const result = await response.json();
        alert(`Successfully reset ${result.gamesReset} game(s) in "${categoryName}"`);
        await loadCategories(true);
      } else {
        const error = await response.json();
        alert('Failed to reset all games: ' + (error.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Failed to reset all games:', error);
      alert('Failed to reset all games. Please try again.');
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    
    try {
      // Convert local datetime to UTC for registration deadline
      let registrationDeadlineUTC = null;
      if (formData.registrationDeadline) {
        const localDate = new Date(formData.registrationDeadline);
        registrationDeadlineUTC = localDate.toISOString();
      }

      const response = await apiCall('/api/categories', {
        method: 'POST',
        body: JSON.stringify({
          name: formData.name,
          gamesCountMode: 'UNLIMITED',
          startDate: formData.startDate,
          endDate: formData.endDate,
          registrationDeadline: registrationDeadlineUTC,
          dailyWindows: formData.dailyWindows,
          perPersonCap: formData.isUnlimitedCap ? 2147483647 : formData.perPersonCap,
          locationName: formData.locationName,
          locationMapsLink: formData.locationMapsLink || null
        })
      });
      
      if (response.ok) {
        setShowCreateForm(false);
        // Save scroll position before closing modal
        setScrollPosition(window.scrollY);
        
        setFormData({
          name: '',
          startDate: '',
          endDate: '',
          registrationDeadline: '',
          locationName: '',
          locationMapsLink: '',
          perPersonCap: 2,
          isUnlimitedCap: false,
          dailyWindows: [{ start: '09:00', end: '17:00' }]
        });
        
        // Load categories and restore scroll position
        await loadCategories();
        setTimeout(() => {
          window.scrollTo(0, scrollPosition);
        }, 100);
      } else {
        const error = await response.json();
        alert('Failed to create category: ' + (error.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Failed to create category:', error);
      alert('Failed to create category. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleEditCategory = (category: any) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      startDate: category.startDate.split('T')[0],
      endDate: category.endDate.split('T')[0],
      registrationDeadline: category.registrationDeadline ? (() => {
        const date = new Date(category.registrationDeadline);
        // Convert UTC to local timezone for datetime-local input
        const localDate = new Date(date.getTime() - (date.getTimezoneOffset() * 60000));
        return localDate.toISOString().slice(0, 16);
      })() : '',
      locationName: category.locationName,
      locationMapsLink: category.locationMapsLink || '',
      perPersonCap: category.perPersonCap === 2147483647 ? 2 : category.perPersonCap,
      isUnlimitedCap: category.perPersonCap === 2147483647,
      dailyWindows: category.dailyWindows
    });
    setShowEditForm(true);
  };

  const handleUpdateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    
    try {
      // Convert local datetime to UTC for registration deadline
      let registrationDeadlineUTC = null;
      if (formData.registrationDeadline) {
        const localDate = new Date(formData.registrationDeadline);
        registrationDeadlineUTC = localDate.toISOString();
      }

      const response = await apiCall(`/api/categories/${editingCategory.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: formData.name,
          startDate: formData.startDate,
          endDate: formData.endDate,
          registrationDeadline: registrationDeadlineUTC,
          dailyWindows: formData.dailyWindows,
          perPersonCap: formData.isUnlimitedCap ? 2147483647 : formData.perPersonCap,
          locationName: formData.locationName,
          locationMapsLink: formData.locationMapsLink || null
        })
      });
      
      if (response.ok) {
        // Save scroll position before closing modal
        setScrollPosition(window.scrollY);
        
        setShowEditForm(false);
        setEditingCategory(null);
        
        // Load categories and restore scroll position
        await loadCategories();
        setTimeout(() => {
          window.scrollTo(0, scrollPosition);
        }, 100);
      } else {
        const error = await response.json();
        alert('Failed to update category: ' + (error.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Failed to update category:', error);
      alert('Failed to update category. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddGame = (categoryId: string) => {
    setSelectedCategory(categoryId);
    setGameFormData({
      name: '',
      description: '',
      weightage: 1,
      typeFormat: '1v1',
      contestType: 'SINGLE_ELIMINATION',
      avgGameTime: 30,
      levels: ['Beginner'],
      simultaneousGames: 1,
      oneLoserMode: false
    });
    setShowAddGameForm(true);
  };

  const handleCreateGame = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    
    try {
      if (editingGame) {
        // Update existing game
        const response = await apiCall(`/api/games/${editingGame.id}`, {
          method: 'PUT',
          body: JSON.stringify(gameFormData),
        });

        if (response.ok) {
          // Save scroll position before closing modal
          setScrollPosition(window.scrollY);
          
          setShowAddGameForm(false);
          setSelectedCategory(null);
          setEditingGame(null);
          setGameFormData({
            name: '',
            description: '',
            weightage: 1,
            typeFormat: '1v1',
            contestType: 'SINGLE_ELIMINATION',
            avgGameTime: 30,
            levels: ['Beginner'],
            simultaneousGames: 1,
            oneLoserMode: false
          });
          
          // Load categories and restore scroll position
          await loadCategories();
          setTimeout(() => {
            window.scrollTo(0, scrollPosition);
          }, 100);
        } else {
          const errorData = await response.json();
          alert(`Failed to update game: ${errorData.error || 'Unknown error'}`);
        }
      } else {
        // Create new game
        const response = await apiCall('/api/games', {
          method: 'POST',
          body: JSON.stringify({
            categoryId: selectedCategory,
            name: gameFormData.name,
            description: gameFormData.description,
            weightage: gameFormData.weightage,
            typeFormat: gameFormData.typeFormat,
            contestType: gameFormData.contestType,
            avgGameTime: gameFormData.avgGameTime,
            levels: gameFormData.levels,
            oneLoserMode: gameFormData.oneLoserMode
          })
        });
        
        if (response.ok) {
          // Save scroll position before closing modal
          setScrollPosition(window.scrollY);
          
          setShowAddGameForm(false);
          setSelectedCategory(null);
          setGameFormData({
            name: '',
            description: '',
            weightage: 1,
            typeFormat: '1v1',
            contestType: 'SINGLE_ELIMINATION',
            avgGameTime: 30,
            levels: ['Beginner'],
            simultaneousGames: 1,
            oneLoserMode: false
          });
          
          // Load categories and restore scroll position
          await loadCategories();
          setTimeout(() => {
            window.scrollTo(0, scrollPosition);
          }, 100);
        } else {
          const error = await response.json();
          alert('Failed to create game: ' + (error.error || 'Unknown error'));
        }
      }
    } catch (error) {
      console.error('Failed to save game:', error);
      alert('Failed to save game. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddVenue = (categoryId: string) => {
    setSelectedCategory(categoryId);
    setShowAddVenueForm(true);
  };

  const handleConfigureGame = async (gameId: string) => {
    setSelectedGameForTeams(gameId);
    setLoadingTeams(true);
    setShowTeamManagement(true);
    
    try {
      const response = await apiCall(`/api/admin/games/${gameId}/teams`);
      if (response.ok) {
        const data = await response.json();
        setTeamData(data);
        // Also load available users for the registration functionality
        await loadAvailableUsers(data.game);
        // Refresh stats for this game
        await refreshGameStats(gameId);
      } else {
        console.error('Failed to load team data');
      }
    } catch (error) {
      console.error('Error loading team data:', error);
    } finally {
      setLoadingTeams(false);
    }
  };


  const handleAddMembersToTeam = async (teamId: string, userIds: string[]) => {
    if (!selectedGameForTeams || userIds.length === 0) return;

    try {
      const response = await apiCall(`/api/admin/games/${selectedGameForTeams}/teams`, {
        method: 'PUT',
        body: JSON.stringify({
          action: 'ADD_MEMBERS',
          teamId,
          userIds
        })
      });

      if (response.ok) {
        // Reload team data and refresh stats
        await handleConfigureGame(selectedGameForTeams);
      } else {
        const error = await response.json();
        alert('Failed to add members: ' + (error.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error adding members:', error);
      alert('Failed to add members. Please try again.');
    }
  };

  const handleRemoveMemberFromTeam = async (teamId: string, userId: string) => {
    if (!selectedGameForTeams) return;

    if (!confirm('Are you sure you want to remove this member from the team?')) return;

    try {
      const response = await apiCall(`/api/admin/games/${selectedGameForTeams}/teams`, {
        method: 'PUT',
        body: JSON.stringify({
          action: 'REMOVE_MEMBERS',
          teamId,
          userIds: [userId]
        })
      });

      if (response.ok) {
        // Reload team data and refresh stats
        await handleConfigureGame(selectedGameForTeams);
      } else {
        const error = await response.json();
        alert('Failed to remove member: ' + (error.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error removing member:', error);
      alert('Failed to remove member. Please try again.');
    }
  };

  const handleDeleteTeam = async (teamId: string, teamName: string) => {
    if (!selectedGameForTeams) return;

    if (!confirm(`Are you sure you want to delete the team "${teamName}"? This will remove all team members and their schedules. This action cannot be undone.`)) return;

    try {
      const response = await apiCall(`/api/admin/games/${selectedGameForTeams}/teams`, {
        method: 'DELETE',
        body: JSON.stringify({
          action: 'DELETE_TEAM',
          teamId
        })
      });

      if (response.ok) {
        // Reload team data and refresh stats
        await handleConfigureGame(selectedGameForTeams);
      } else {
        const error = await response.json();
        alert('Failed to delete team: ' + (error.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error deleting team:', error);
      alert('Failed to delete team. Please try again.');
    }
  };

  const handleEditTeamName = (teamId: string, currentName: string) => {
    setEditingTeamId(teamId);
    setEditingTeamName(currentName);
  };

  const handleSaveTeamName = async (teamId: string) => {
    if (!editingTeamName.trim()) {
      alert('Team name cannot be empty');
      return;
    }

    try {
      const response = await apiCall(`/api/admin/games/${selectedGameForTeams}/teams`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'UPDATE_TEAM_NAME',
          teamId,
          name: editingTeamName.trim()
        }),
      });

      if (response.ok) {
        // Reset editing state
        setEditingTeamId(null);
        setEditingTeamName('');

        // Reload team data and refresh stats
        if (selectedGameForTeams) {
          await handleConfigureGame(selectedGameForTeams);
        }
      } else {
        const error = await response.json();
        alert('Failed to update team name: ' + (error.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error updating team name:', error);
      alert('Failed to update team name. Please try again.');
    }
  };

  const handleCancelEditTeamName = () => {
    setEditingTeamId(null);
    setEditingTeamName('');
  };

  const isTeamGame = (format: string) => {
    const playersPerSide = parseInt(format.split('v')[0]);
    return playersPerSide > 1;
  };

  const filterAvailableUsers = (teamId: string) => {
    const searchTerm = memberSearchTerms[teamId] || '';
    if (!teamData) return [];

    // Only show users who have registered for this game
    const registeredUsers = teamData.individualRegistrations.map(reg => ({ ...reg.user, isRegistered: true }));

    if (!searchTerm.trim()) {
      return registeredUsers.slice(0, 8); // Show first 8 registered users when no search
    }

    return registeredUsers.filter(user => {
      const fullName = `${user.firstName} ${user.lastName}`.toLowerCase();
      const email = user.email.toLowerCase();
      const search = searchTerm.toLowerCase();
      return fullName.includes(search) || email.includes(search);
    });
  };

  const isTeamIncomplete = (team: any) => {
    if (!teamData?.game.typeFormat) return false;
    
    // Extract expected team size from format (e.g., "2v2" = 2 players per side)
    const playersPerSide = parseInt(teamData.game.typeFormat.split('v')[0]);
    return team.members.length < playersPerSide;
  };

  const getFilteredTeams = () => {
    if (!teamData) return [];
    
    let filteredTeams = teamData.teams;
    
    // Apply search filter
    if (globalSearchTerm) {
      const searchLower = globalSearchTerm.toLowerCase();
      filteredTeams = filteredTeams.filter(team => {
        // Search by team name
        const teamNameMatch = team.name.toLowerCase().includes(searchLower);
        
        // Search by team member names
        const memberMatch = team.members.some(member => {
          const fullName = `${member.user.firstName} ${member.user.lastName}`.toLowerCase();
          const email = member.user.email.toLowerCase();
          return fullName.includes(searchLower) || email.includes(searchLower);
        });
        
        return teamNameMatch || memberMatch;
      });
    }
    
    // Apply incomplete filter
    if (showIncompleteOnly) {
      filteredTeams = filteredTeams.filter(team => isTeamIncomplete(team));
    }
    
    // Sort teams: incomplete teams first, then alphabetically by name
    filteredTeams = filteredTeams.sort((a, b) => {
      const aIncomplete = isTeamIncomplete(a);
      const bIncomplete = isTeamIncomplete(b);
      
      // If one is incomplete and the other is not, incomplete comes first
      if (aIncomplete && !bIncomplete) return -1;
      if (!aIncomplete && bIncomplete) return 1;
      
      // If both have the same completion status, sort alphabetically by name
      return a.name.localeCompare(b.name);
    });
    
    return filteredTeams;
  };

  const loadGameStats = async () => {
    const stats: Record<string, any> = {};
    
    for (const category of categories) {
      for (const game of category.games) {
        try {
          const response = await apiCall(`/api/admin/games/${game.id}/stats`);
          if (response.ok) {
            const data = await response.json();
            stats[game.id] = data;
          }
        } catch (error) {
          console.error(`Failed to load stats for game ${game.id}:`, error);
        }
      }
    }
    
    setGameStats(stats);
  };

  const refreshGameStats = async (gameId: string) => {
    try {
      const response = await apiCall(`/api/admin/games/${gameId}/stats`);
      if (response.ok) {
        const data = await response.json();
        setGameStats(prev => ({
          ...prev,
          [gameId]: data
        }));
      }
    } catch (error) {
      console.error(`Failed to refresh stats for game ${gameId}:`, error);
    }
  };

  const handleEditGame = async (game: any) => {
    // Check if game has registrations
    const stats = gameStats[game.id];
    const hasRegistrations = stats && (
      (stats.totalPlayers && stats.totalPlayers > 0) ||
      (stats.totalTeams && stats.totalTeams > 0) ||
      (stats.individualPlayers && stats.individualPlayers > 0)
    );
    
    // if (hasRegistrations) {
    //   alert('Cannot edit this game because it has existing registrations. Games with registrations cannot be modified as it might affect the tournament structure.');
    //   return;
    // }

    // Set up form data for editing
    setEditingGame(game);
    
    // Parse levels - should now be properly parsed from the API
    let parsedLevels = ['Beginner']; // Default fallback
    try {
      if (Array.isArray(game.levels)) {
        // Already parsed by the API
        parsedLevels = game.levels;
      } else if (typeof game.levels === 'string') {
        // Fallback if still a string
        parsedLevels = JSON.parse(game.levels);
      }
      
      // Ensure we have at least one level
      if (!parsedLevels || parsedLevels.length === 0) {
        parsedLevels = ['Beginner'];
      }
    } catch (e) {
      console.error('Error parsing levels:', e, 'Game data:', game);
      parsedLevels = ['Beginner'];
    }
    
    // Set the game form data for editing
    console.log('Setting game form data for editing:', {
      name: game.name,
      description: game.description,
      fullGame: game
    });
    
    setGameFormData({
      name: game.name || '',
      description: game.description || '',
      weightage: Number(game.weightage) || 1,
      typeFormat: game.typeFormat || '1v1',
      avgGameTime: Number(game.avgGameTime) || 30,
      levels: parsedLevels,
      contestType: game.contestType || 'SINGLE_ELIMINATION',
      simultaneousGames: Number(game.simultaneousGames) || 1,
      oneLoserMode: game.oneLoserMode || false
    });
    
    // Find the category this game belongs to
    const category = categories.find(cat => cat.games.some(g => g.id === game.id));
    if (category) {
      setSelectedCategory(category.id);
    }
    
    setShowAddGameForm(true);
  };

  const loadAvailableUsers = async (gameForRegistration?: any) => {
    setLoadingUsers(true);
    try {
      const response = await apiCall('/api/admin/users');
      if (response.ok) {
        const allUsers = await response.json();
        
        // Use the passed game or the state variable
        const targetGame = gameForRegistration || selectedGameForRegistration;
        
        // If we have a selected game, filter out users who are already registered and blocked users
        if (targetGame) {
          console.log('Loading users for game:', targetGame.id, targetGame.name);
          
          // Get existing registrations for this game
          const registrationsResponse = await apiCall(`/api/games/${targetGame.id}`);
          let registeredUserIds = [];
          
          if (registrationsResponse.ok) {
            const gameData = await registrationsResponse.json();
            registeredUserIds = gameData.registrations?.map((reg: any) => reg.userId) || [];
            console.log('Found registered user IDs:', registeredUserIds);
          } else {
            console.error('Failed to load game registrations');
          }
          
          // Filter out registered users and blocked users
          const availableUsers = allUsers.filter((user: any) =>
            !registeredUserIds.includes(user.id) && !user.isBlocked
          );
          
          console.log('Total users:', allUsers.length, 'Available users:', availableUsers.length);
          setAvailableUsers(availableUsers);
        } else {
          // If no game selected, just filter out blocked users
          const availableUsers = allUsers.filter((user: any) => !user.isBlocked);
          setAvailableUsers(availableUsers);
        }
      } else {
        console.error('Failed to load users');
        setAvailableUsers([]);
      }
    } catch (error) {
      console.error('Error loading users:', error);
      setAvailableUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleRegisterPlayer = async (game?: any) => {
    // If called from team management modal, use teamData.game, otherwise use passed game
    const gameToRegister = game || teamData?.game;
    if (!gameToRegister) return;
    
    setSelectedGameForRegistration(gameToRegister);
    setSelectedUsersForRegistration([]);
    setGlobalSearchTerm('');
    
    // Reset registration form data with appropriate defaults
    const isTeamGame = gameToRegister.typeFormat !== '1v1' && gameToRegister.typeFormat !== 'Individual';
    setRegistrationFormData({
      level: 'Beginner',
      mode: isTeamGame ? 'TEAM' : 'INDIVIDUAL'
    });
    
    setShowRegisterPlayerModal(true);
    // Pass the game directly to avoid state timing issues
    await loadAvailableUsers(gameToRegister);
  };

  const getFilteredUsers = () => {
    if (!globalSearchTerm.trim()) {
      return availableUsers;
    }

    const searchLower = globalSearchTerm.toLowerCase();
    return availableUsers.filter(user => {
      const fullName = `${user.firstName} ${user.lastName}`.toLowerCase();
      const email = user.email.toLowerCase();
      return fullName.includes(searchLower) || email.includes(searchLower);
    });
  };

  const handleUserSelectionToggle = (userId: string) => {
    setSelectedUsersForRegistration(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleSubmitPlayerRegistration = async () => {
    if (!selectedGameForRegistration || selectedUsersForRegistration.length === 0) {
      alert('Please select at least one user to register');
      return;
    }

    setSubmitting(true);
    try {
      const isTeamGame = selectedGameForRegistration.typeFormat !== '1v1' && selectedGameForRegistration.typeFormat !== 'Individual';
      const mode = isTeamGame ? 'TEAM' : registrationFormData.mode;
      
      // Use the dedicated admin registration API
      const response = await apiCall('/api/admin/registrations', {
        method: 'POST',
        body: JSON.stringify({
          gameId: selectedGameForRegistration.id,
          userIds: selectedUsersForRegistration,
          level: registrationFormData.level,
          mode: mode
        }),
      });

      if (response.ok) {
        const data = await response.json();
        
        // Refresh game stats and close modal
        await refreshGameStats(selectedGameForRegistration.id);
        
        // If we're in team management modal, refresh team data
        if (showTeamManagement && selectedGameForTeams === selectedGameForRegistration.id) {
          await handleConfigureGame(selectedGameForRegistration.id);
        }
        
        setShowRegisterPlayerModal(false);
        setSelectedGameForRegistration(null);
        setSelectedUsersForRegistration([]);
        setRegistrationFormData({
          level: 'Beginner',
          mode: 'INDIVIDUAL'
        });
        
        // Show warnings if any
        if (data.errors && data.errors.length > 0) {
          alert(`Warnings:\n${data.errors.join('\n')}`);
        }
      } else {
        const errorData = await response.json();
        alert(`Failed to register players: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error registering players:', error);
      alert('Failed to register players. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBulkRegister = async () => {
    if (!bulkRegisterData.emails.trim() || !bulkRegisterData.selectedGameId) {
      return;
    }

    setBulkRegisterLoading(true);
    try {
      const response = await apiCall('/api/admin/bulk-register', {
        method: 'POST',
        body: JSON.stringify({
          emails: bulkRegisterData.emails,
          gameId: bulkRegisterData.selectedGameId,
          bypassDeadline: true
        })
      });

      if (response.ok) {
        const result = await response.json();
        setBulkRegisterResults(result);
        
        // Refresh categories to update registration counts
        await loadCategories();
      } else {
        const errorData = await response.json();
        alert(`Failed to register players: ${errorData.error}`);
      }
    } catch (error) {
      console.error('Bulk registration error:', error);
      alert('Failed to register players. Please try again.');
    } finally {
      setBulkRegisterLoading(false);
    }
  };

  const handleRegisterSinglePlayer = async (userId: string) => {
    if (!teamData?.game) return;
    
    try {
      const response = await apiCall('/api/admin/registrations', {
        method: 'POST',
        body: JSON.stringify({
          gameId: teamData.game.id,
          userIds: [userId],
          level: 'Intermediate',
          mode: 'INDIVIDUAL'
        }),
      });

      if (response.ok) {
        // Refresh team data to show updated registrations
        await handleConfigureGame(teamData.game.id);
      } else {
        const errorData = await response.json();
        alert(`Failed to register player: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error registering player:', error);
      alert('Failed to register player');
    }
  };

  const generateUniqueTeamName = (existingTeams: any[]) => {
    const existingNames = existingTeams.map(team => team.name.toLowerCase());
    let counter = 1;
    let teamName = `Team ${counter}`;
    
    while (existingNames.includes(teamName.toLowerCase())) {
      counter++;
      teamName = `Team ${counter}`;
    }
    
    return teamName;
  };

  const handleCreateTeamWithPlayer = async (registrationId: string) => {
    if (!teamData) return;
    
    // Find the registration to get the user ID
    const registration = teamData.individualRegistrations.find(reg => reg.id === registrationId);
    if (!registration) {
      alert('Registration not found');
      return;
    }

    // Generate unique team name
    const teamName = generateUniqueTeamName(teamData.teams);

    try {
      const response = await apiCall(`/api/admin/games/${teamData.game.id}/teams`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'CREATE_TEAM',
          teamName: teamName,
          teamLeadId: registration.user.id,
          memberIds: [],
          openTeam: false
        }),
      });

      if (response.ok) {
        await handleConfigureGame(teamData.game.id);
      } else {
        const errorData = await response.json();
        alert(errorData.error || 'Failed to create team');
      }
    } catch (error) {
      console.error('Error creating team:', error);
      alert('Failed to create team');
    }
  };

  const handleAssignPlayerToTeam = async (registrationId: string, teamId: string) => {
    if (!teamData) return;
    
    // Find the registration to get the user ID
    const registration = teamData.individualRegistrations.find(reg => reg.id === registrationId);
    if (!registration) {
      alert('Registration not found');
      return;
    }

    try {
      const response = await apiCall(`/api/admin/games/${teamData.game.id}/teams`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'ADD_MEMBERS',
          teamId,
          userIds: [registration.user.id]
        }),
      });

      if (response.ok) {
        await handleConfigureGame(teamData.game.id);
      } else {
        const errorData = await response.json();
        alert(errorData.error || 'Failed to assign player to team');
      }
    } catch (error) {
      console.error('Error assigning player to team:', error);
      alert('Failed to assign player to team');
    }
  };

  const handleRemovePlayerRegistration = async (registrationId: string) => {
    if (!confirm('Are you sure you want to remove this player\'s registration?')) {
      return;
    }

    try {
      const response = await apiCall('/api/admin/registrations', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          registrationId: registrationId,
        }),
      });

      if (response.ok) {
        // Refresh game stats for the current game
        if (selectedGameForTeams) {
          await refreshGameStats(selectedGameForTeams);
        }
        
        // If we're in team management modal, refresh team data
        if (showTeamManagement && selectedGameForTeams) {
          await handleConfigureGame(selectedGameForTeams);
        }
      } else {
        const errorData = await response.json();
        alert(`Failed to remove player registration: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error removing player registration:', error);
      alert('Failed to remove player registration. Please try again.');
    }
  };

  const loadAllGames = async () => {
    try {
      const allGamesData: any[] = [];
      
      // Extract games from all categories
      categories.forEach(category => {
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
    } catch (error) {
      console.error('Error loading games:', error);
    }
  };




  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-white">Loading events...</div>
      </div>
    );
  }

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

      {/* Main Content */}
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-6 sm:mb-8 gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-2 sm:mb-4">Event Management</h1>
            <p className="text-base sm:text-lg lg:text-xl text-slate-300">
              Create and manage tournament categories, games, and venues.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-shrink-0">
            {hasAdminAccess(user) && (
              <Button className="codeninja-gradient w-full sm:w-auto" onClick={() => setShowCreateForm(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Category
              </Button>
            )}
            {user?.role === 'ADMIN' && (
              <Button
                className="bg-blue-600 hover:bg-blue-700 text-white w-full sm:w-auto"
                onClick={() => {
                  loadAllGames();
                  setShowEmailPlayersModal(true);
                }}
              >
                <Mail className="h-4 w-4 mr-2" />
                Email Players
              </Button>
            )}
            {user?.role === 'ADMIN' && (
              <Button
                className="bg-green-600 hover:bg-green-700 text-white w-full sm:w-auto"
                onClick={() => {
                  setShowBulkRegisterModal(true);
                  setBulkRegisterResults(null);
                }}
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Bulk Register
              </Button>
            )}
            {hasAdminAccess(user) && (
              <Link href="/admin/events/archive" className="w-full sm:w-auto">
                <Button variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-700 w-full">
                  <Archive className="h-4 w-4 mr-2" />
                  Archive
                </Button>
              </Link>
            )}
          </div>
        </div>

        {/* Categories Grid */}
        <div className="grid gap-4 sm:gap-6">
          {categories.map((category: any) => (
            <Card key={category.id} className="bg-slate-800/50 border-slate-700">
              <CardHeader className="pb-4">
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-white text-lg sm:text-xl lg:text-2xl mb-2 truncate">{category.name}</CardTitle>
                    <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 sm:gap-4 text-xs sm:text-sm text-slate-300">
                      <div className="flex items-center">
                        <Calendar className="h-3 w-3 sm:h-4 sm:w-4 mr-1 flex-shrink-0" />
                        <span className="truncate">
                          {category.startDate === category.endDate
                            ? new Date(category.startDate).toLocaleDateString()
                            : `${new Date(category.startDate).toLocaleDateString()} - ${new Date(category.endDate).toLocaleDateString()}`
                          }
                        </span>
                      </div>
                      <div className="flex items-center">
                        <Clock className="h-3 w-3 sm:h-4 sm:w-4 mr-1 flex-shrink-0" />
                        <span className="truncate">
                          {category.dailyWindows.map((window: any) => `${window.start} - ${window.end}`).join(", ")}
                        </span>
                      </div>
                      <div className="flex items-center">
                        <MapPin className="h-3 w-3 sm:h-4 sm:w-4 mr-1 flex-shrink-0" />
                        <span className="truncate">{category.locationName}</span>
                      </div>
                      <div className="flex items-center">
                        <Users className="h-3 w-3 sm:h-4 sm:w-4 mr-1 flex-shrink-0" />
                        <span className="truncate">
                          {category.perPersonCap === 2147483647 ? "No Limit" : `${category.perPersonCap} games per person`}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-end space-x-1 sm:space-x-2 flex-shrink-0">
                    {hasAdminAccess(user) && (
                      <Button size="sm" variant="outline" onClick={() => handleEditCategory(category)} className="p-2 sm:px-3">
                        <Edit className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-1" />
                        <span className="hidden sm:inline">Edit</span>
                      </Button>
                    )}
                    {hasAdminAccess(user) && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-green-600 text-green-400 hover:bg-green-600/20 p-2 sm:px-3"
                          onClick={() => handleCategoryStatusChange(category.id, 'COMPLETED')}
                        >
                          <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-1" />
                          <span className="hidden sm:inline">Complete</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-orange-600 text-orange-400 hover:bg-orange-600/20 p-2 sm:px-3"
                          onClick={() => handleCategoryStatusChange(category.id, 'ABANDONED')}
                        >
                          <XCircle className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-1" />
                          <span className="hidden sm:inline">Abandon</span>
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => handleDeleteCategory(category.id)} className="p-2 sm:px-3">
                          <Trash2 className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-1" />
                          <span className="hidden sm:inline">Delete</span>
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="mb-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-3 gap-3">
                    <h3 className="text-base sm:text-lg font-semibold text-white flex items-center">
                      <Target className="h-4 w-4 sm:h-5 sm:w-5 mr-2 text-orange-400 flex-shrink-0" />
                      Games ({category.games.length})
                    </h3>
                    {hasAdminAccess(user) && (
                      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full sm:w-auto">
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-red-600 text-red-400 hover:bg-red-600/20 w-full sm:w-auto"
                          onClick={() => handleResetAllGames(category.id, category.name)}
                          title="Reset All Games in Category"
                        >
                          <RotateCcw className="h-4 w-4 mr-1" />
                          Reset All
                        </Button>
                        <Button size="sm" className="codeninja-gradient w-full sm:w-auto" onClick={() => handleAddGame(category.id)}>
                          <Plus className="h-4 w-4 mr-1" />
                          Add Game
                        </Button>
                      </div>
                    )}
                  </div>
                  
                  <div className="grid gap-3">
                    {category.games?.sort((a: any, b: any) => a.name.localeCompare(b.name)).map((game: any) => {
                      const stats = gameStats[game.id];
                      const isTeamGameFormat = isTeamGame(game.typeFormat);
                      
                      return (
                      <Card key={game.id} className="bg-slate-700/30 border-slate-600/50 hover:bg-slate-700/50 transition-colors">
                        <CardContent className="p-4 sm:p-5">
                          {/* Header Row - Improved Mobile Layout */}
                          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-3 gap-3 sm:gap-0">
                            <div className="flex items-center space-x-3 flex-1 min-w-0">
                              <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0">
                                <Trophy className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="font-semibold text-white text-base sm:text-lg mb-1 break-words">{game.name}</h4>
                                <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-3 text-sm text-slate-400 gap-1 sm:gap-0">
                                  <span>Format: {game.typeFormat}</span>
                                  <span className="hidden sm:inline">•</span>
                                  <span>Weightage: {game.weightage} pts</span>
                                  <span className="hidden sm:inline">•</span>
                                  <span>Avg Time: {game.avgGameTime} min</span>
                                  <span className="hidden sm:inline">•</span>
                                  <span>Courts: {game.simultaneousGames}</span>
                                  <span className="hidden sm:inline">•</span>
                                  <span className="truncate">{contestTypeLabels[game.contestType as keyof typeof contestTypeLabels]}</span>
                                </div>
                              </div>
                            </div>
                            
                            {/* Action Buttons - Mobile: Below content, Desktop: Right side */}
                            <div className="flex items-center justify-between gap-1 sm:gap-2 sm:flex-shrink-0 w-full sm:w-auto">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleConfigureGame(game.id)}
                                className="h-10 w-10 sm:w-auto p-0 sm:px-4 flex-1 sm:flex-initial"
                                title="Manage Registrations"
                              >
                                <Settings className="h-4 w-4" />
                                <span className="hidden sm:inline sm:ml-1 text-sm">Registrations</span>
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedGameForScheduling(game.id);
                                  setShowSchedulingInterface(true);
                                }}
                                className="h-10 w-10 sm:w-auto p-0 sm:px-4 border-blue-500/50 text-blue-400 hover:bg-blue-500/10 flex-1 sm:flex-initial"
                                title="Schedule Games"
                              >
                                <Calendar className="h-4 w-4" />
                                <span className="hidden sm:inline sm:ml-1 text-sm">Schedule</span>
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleEditGame(game)}
                                className="h-10 w-10 sm:w-auto p-0 sm:px-4 flex-1 sm:flex-initial"
                                title="Edit Game"
                              >
                                <Edit className="h-4 w-4" />
                                <span className="hidden sm:inline sm:ml-1 text-sm">Edit</span>
                              </Button>
                              {hasAdminAccess(user) && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleResetGame(game.id)}
                                    className="h-10 w-10 p-0 border-orange-500/50 text-orange-400 hover:bg-orange-500/10"
                                    title="Reset game (remove all registrations and schedules)"
                                  >
                                    <RotateCcw className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => handleDeleteGame(game.id)}
                                    className="h-10 w-10 p-0"
                                    title="Delete Game"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </div>
                          
                          {/* Statistics Row - Better Spaced Layout */}
                          {stats && (
                            <div className="flex flex-wrap items-center gap-2 text-xs">
                              {isTeamGameFormat && stats.isTeamGame ? (
                                // Team game statistics
                                <>
                                  {stats.completeTeams > 0 && (
                                    <span className="bg-green-500/20 text-green-300 px-2.5 py-1 rounded-full">
                                      {stats.completeTeams} Complete
                                    </span>
                                  )}
                                  <span className="bg-blue-500/20 text-blue-300 px-2.5 py-1 rounded-full">
                                    {stats.totalPlayers || 0} Players
                                  </span>
                                  {stats.incompleteTeams > 0 && (
                                    <span className="bg-orange-500/20 text-orange-300 px-2.5 py-1 rounded-full">
                                      {stats.incompleteTeams} Incomplete
                                    </span>
                                  )}
                                  {stats.individualPlayers > 0 && (
                                    <span className="bg-yellow-500/20 text-yellow-300 px-2.5 py-1 rounded-full">
                                      {stats.individualPlayers} Individual
                                    </span>
                                  )}
                                </>
                              ) : (
                                // Individual game statistics (1v1)
                                <span className="bg-green-500/20 text-green-300 px-2.5 py-1 rounded-full">
                                  {stats.totalPlayers || 0} Players
                                </span>
                              )}
                              
                              {/* Scheduling Status */}
                              {(stats.scheduledParticipants !== undefined && stats.unscheduledParticipants !== undefined) && (
                                <>
                                  {stats.scheduledParticipants > 0 && (
                                    <span className="bg-green-500/20 text-green-300 px-2.5 py-1 rounded-full">
                                      {stats.scheduledParticipants} Scheduled
                                    </span>
                                  )}
                                  {stats.unscheduledParticipants > 0 && (
                                    <span className="bg-red-500/20 text-red-300 px-2.5 py-1 rounded-full">
                                      {stats.unscheduledParticipants} Unscheduled
                                    </span>
                                  )}
                                </>
                              )}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                      );
                    })}
                  </div>
                </div>

                {/* Venues Section */}
                <div className="border-t border-slate-600 pt-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-3 gap-3">
                    <h3 className="text-base sm:text-lg font-semibold text-white flex items-center">
                      <MapPin className="h-4 w-4 sm:h-5 sm:w-5 mr-2 text-green-400 flex-shrink-0" />
                      Venues
                    </h3>
                  </div>
                  
                  <div className="text-xs sm:text-sm text-slate-400">
                    <p className="truncate">Location: {category.locationName}</p>
                    {category.locationMapsLink && (
                      <a
                        href={category.locationMapsLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300 underline inline-block mt-1"
                      >
                        View on Maps
                      </a>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Create Category Form Modal */}
        {showCreateForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-2 sm:p-4 z-50">
            <Card className="w-full max-w-2xl bg-slate-800 border-slate-700 max-h-[95vh] sm:max-h-[90vh] overflow-y-auto mx-2 sm:mx-0">
              <CardHeader>
                <CardTitle className="text-white">Create New Category</CardTitle>
                <CardDescription className="text-slate-300">
                  Set up a new tournament category with games and venues
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form className="space-y-4" onSubmit={handleCreateCategory}>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Category Name *
                    </label>
                    <Input
                      required
                      value={formData.name}
                      onChange={(e) => handleInputChange('name', e.target.value)}
                      placeholder="e.g., Indoor Games Week"
                      className="bg-slate-700/50 border-slate-600 text-white"
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Start Date *
                      </label>
                      <Input
                        required
                        type="date"
                        value={formData.startDate}
                        onChange={(e) => handleInputChange('startDate', e.target.value)}
                        className="bg-slate-700/50 border-slate-600 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        End Date *
                      </label>
                      <Input
                        required
                        type="date"
                        value={formData.endDate}
                        onChange={(e) => handleInputChange('endDate', e.target.value)}
                        className="bg-slate-700/50 border-slate-600 text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Registration Deadline
                    </label>
                    <Input
                      type="datetime-local"
                      value={formData.registrationDeadline}
                      onChange={(e) => handleInputChange('registrationDeadline', e.target.value)}
                      className="bg-slate-700/50 border-slate-600 text-white"
                      placeholder="Optional: Set deadline for user registrations"
                    />
                    <p className="text-xs text-slate-400 mt-1">
                      Users can register/schedule themselves until this date. Leave empty for no deadline.
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Daily Time Windows *
                    </label>
                    {formData.dailyWindows.map((window, index) => (
                      <div key={index} className="flex items-center space-x-2 mb-2">
                        <Input
                          required
                          type="time"
                          value={window.start}
                          onChange={(e) => {
                            const newWindows = [...formData.dailyWindows];
                            newWindows[index] = { ...newWindows[index], start: e.target.value };
                            handleInputChange('dailyWindows', newWindows);
                          }}
                          className="bg-slate-700/50 border-slate-600 text-white"
                        />
                        <span className="text-slate-300">to</span>
                        <Input
                          required
                          type="time"
                          value={window.end}
                          onChange={(e) => {
                            const newWindows = [...formData.dailyWindows];
                            newWindows[index] = { ...newWindows[index], end: e.target.value };
                            handleInputChange('dailyWindows', newWindows);
                          }}
                          className="bg-slate-700/50 border-slate-600 text-white"
                        />
                        {formData.dailyWindows.length > 1 && (
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            onClick={() => {
                              const newWindows = formData.dailyWindows.filter((_, i) => i !== index);
                              handleInputChange('dailyWindows', newWindows);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const newWindows = [...formData.dailyWindows, { start: '09:00', end: '17:00' }];
                        handleInputChange('dailyWindows', newWindows);
                      }}
                      className="mt-2"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add Time Window
                    </Button>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Location Name *
                    </label>
                    <Input
                      required
                      value={formData.locationName}
                      onChange={(e) => handleInputChange('locationName', e.target.value)}
                      placeholder="e.g., Office Recreation Area"
                      className="bg-slate-700/50 border-slate-600 text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Google Maps Link (Optional)
                    </label>
                    <Input
                      value={formData.locationMapsLink}
                      onChange={(e) => handleInputChange('locationMapsLink', e.target.value)}
                      placeholder="https://maps.google.com/..."
                      className="bg-slate-700/50 border-slate-600 text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Per Person Participation Cap *
                    </label>
                    <div className="space-y-3">
                      <label className="flex items-center text-slate-300">
                        <input
                          type="checkbox"
                          checked={formData.isUnlimitedCap}
                          onChange={(e) => handleInputChange('isUnlimitedCap', e.target.checked)}
                          className="mr-2"
                        />
                        No Limit
                      </label>
                      {!formData.isUnlimitedCap && (
                        <Input
                          required
                          type="number"
                          min="1"
                          value={formData.perPersonCap}
                          onChange={(e) => handleInputChange('perPersonCap', parseInt(e.target.value) || 1)}
                          placeholder="2"
                          className="bg-slate-700/50 border-slate-600 text-white"
                        />
                      )}
                    </div>
                  </div>

                  <div className="flex justify-end space-x-4 pt-4">
                    <Button type="button" variant="outline" onClick={() => setShowCreateForm(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" className="codeninja-gradient" disabled={submitting}>
                      {submitting ? 'Creating...' : 'Create Category'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Edit Category Modal */}
        {showEditForm && editingCategory && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4 z-50">
            <Card className="w-full max-w-md max-h-[95vh] sm:max-h-[90vh] overflow-y-auto bg-slate-800 border-slate-700 mx-2 sm:mx-0">
              <CardHeader>
                <h3 className="text-lg font-semibold text-white">Edit Category</h3>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleUpdateCategory} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Category Name *
                    </label>
                    <Input
                      required
                      value={formData.name}
                      onChange={(e) => handleInputChange('name', e.target.value)}
                      placeholder="e.g., Indoor Games Week"
                      className="bg-slate-700/50 border-slate-600 text-white"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Start Date *
                      </label>
                      <Input
                        required
                        type="date"
                        value={formData.startDate}
                        onChange={(e) => handleInputChange('startDate', e.target.value)}
                        className="bg-slate-700/50 border-slate-600 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        End Date *
                      </label>
                      <Input
                        required
                        type="date"
                        value={formData.endDate}
                        onChange={(e) => handleInputChange('endDate', e.target.value)}
                        className="bg-slate-700/50 border-slate-600 text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Registration Deadline
                    </label>
                    <Input
                      type="datetime-local"
                      value={formData.registrationDeadline}
                      onChange={(e) => handleInputChange('registrationDeadline', e.target.value)}
                      className="bg-slate-700/50 border-slate-600 text-white"
                      placeholder="Optional: Set deadline for user registrations"
                    />
                    <p className="text-xs text-slate-400 mt-1">
                      Users can register/schedule themselves until this date. Leave empty for no deadline.
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Daily Time Windows *
                    </label>
                    {formData.dailyWindows.map((window, index) => (
                      <div key={index} className="flex items-center space-x-2 mb-2">
                        <Input
                          required
                          type="time"
                          value={window.start}
                          onChange={(e) => {
                            const newWindows = [...formData.dailyWindows];
                            newWindows[index] = { ...newWindows[index], start: e.target.value };
                            handleInputChange('dailyWindows', newWindows);
                          }}
                          className="bg-slate-700/50 border-slate-600 text-white"
                        />
                        <span className="text-slate-300">to</span>
                        <Input
                          required
                          type="time"
                          value={window.end}
                          onChange={(e) => {
                            const newWindows = [...formData.dailyWindows];
                            newWindows[index] = { ...newWindows[index], end: e.target.value };
                            handleInputChange('dailyWindows', newWindows);
                          }}
                          className="bg-slate-700/50 border-slate-600 text-white"
                        />
                        {formData.dailyWindows.length > 1 && (
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            onClick={() => {
                              const newWindows = formData.dailyWindows.filter((_, i) => i !== index);
                              handleInputChange('dailyWindows', newWindows);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const newWindows = [...formData.dailyWindows, { start: '09:00', end: '17:00' }];
                        handleInputChange('dailyWindows', newWindows);
                      }}
                      className="mt-2"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add Time Window
                    </Button>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Location Name *
                    </label>
                    <Input
                      required
                      value={formData.locationName}
                      onChange={(e) => handleInputChange('locationName', e.target.value)}
                      placeholder="e.g., Office Recreation Area"
                      className="bg-slate-700/50 border-slate-600 text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Google Maps Link (Optional)
                    </label>
                    <Input
                      value={formData.locationMapsLink}
                      onChange={(e) => handleInputChange('locationMapsLink', e.target.value)}
                      placeholder="https://maps.google.com/..."
                      className="bg-slate-700/50 border-slate-600 text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Per Person Participation Cap *
                    </label>
                    <div className="space-y-3">
                      <label className="flex items-center text-slate-300">
                        <input
                          type="checkbox"
                          checked={formData.isUnlimitedCap}
                          onChange={(e) => handleInputChange('isUnlimitedCap', e.target.checked)}
                          className="mr-2"
                        />
                        No Limit
                      </label>
                      {!formData.isUnlimitedCap && (
                        <Input
                          required
                          type="number"
                          min="1"
                          value={formData.perPersonCap}
                          onChange={(e) => handleInputChange('perPersonCap', parseInt(e.target.value) || 1)}
                          placeholder="2"
                          className="bg-slate-700/50 border-slate-600 text-white"
                        />
                      )}
                    </div>
                  </div>

                  <div className="flex justify-end space-x-4 pt-4">
                    <Button type="button" variant="outline" onClick={() => {
                      setShowEditForm(false);
                      setEditingCategory(null);
                    }}>
                      Cancel
                    </Button>
                    <Button type="submit" className="codeninja-gradient" disabled={submitting}>
                      {submitting ? 'Updating...' : 'Update Category'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Add/Edit Game Modal */}
        {showAddGameForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4 z-50">
            <Card className="w-full max-w-4xl max-h-[98vh] sm:max-h-[95vh] overflow-y-auto bg-slate-800 border-slate-700 mx-2 sm:mx-0">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-semibold text-white">
                      {editingGame ? 'Edit Game' : 'Add New Game'}
                    </h3>
                    <p className="text-sm text-slate-400 mt-1">
                      {editingGame ? 'Modify game settings and configuration' : 'Configure a new game for the tournament'}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowAddGameForm(false);
                      setSelectedCategory(null);
                      setEditingGame(null);
                      setGameFormData({
                        name: '',
                        description: '',
                        weightage: 1,
                        typeFormat: '1v1',
                        contestType: 'SINGLE_ELIMINATION',
                        avgGameTime: 30,
                        levels: ['Beginner'],
                        simultaneousGames: 1,
                        oneLoserMode: false
                      });
                    }}
                    className="text-slate-400 hover:text-white"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <form onSubmit={handleCreateGame} className="space-y-6">
                  {/* Basic Information Section */}
                  <div className="bg-slate-700/30 rounded-lg p-4">
                    <h4 className="text-lg font-medium text-white mb-4 flex items-center">
                      <Trophy className="h-5 w-5 mr-2 text-orange-400" />
                      Basic Information
                    </h4>
                    <div className="grid grid-cols-1 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                          Game Name *
                        </label>
                        <Input
                          required
                          value={gameFormData.name}
                          onChange={(e) => setGameFormData(prev => ({ ...prev, name: e.target.value }))}
                          className="bg-slate-700/50 border-slate-600 text-white"
                          placeholder="e.g., Table Tennis, Chess, Football"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                          Game Description
                        </label>
                        <RichTextEditor
                          value={gameFormData.description}
                          onChange={(value) => setGameFormData(prev => ({ ...prev, description: value }))}
                          placeholder="Optional description of the game rules, format, or special instructions..."
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                          Weightage (1-10)
                        </label>
                        <Input
                          type="number"
                          min="1"
                          max="10"
                          value={gameFormData.weightage}
                          onChange={(e) => setGameFormData(prev => ({ ...prev, weightage: parseInt(e.target.value) }))}
                          className="bg-slate-700/50 border-slate-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                          placeholder="Points weight for leaderboard"
                          disabled={gameFormData.contestType === 'SCORING'}
                        />
                        {gameFormData.contestType === 'SCORING' && (
                          <p className="text-xs text-yellow-400 mt-1">
                            Scoring contests automatically use weightage of 3 for balanced leaderboard scoring
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Game Format Section */}
                  <div className="bg-slate-700/30 rounded-lg p-4">
                    <h4 className="text-lg font-medium text-white mb-4 flex items-center">
                      <Users className="h-5 w-5 mr-2 text-blue-400" />
                      Game Format
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                          Type Format *
                        </label>
                        <select
                          value={gameFormData.typeFormat}
                          onChange={(e) => setGameFormData(prev => ({ ...prev, typeFormat: e.target.value }))}
                          className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                          required
                          disabled={gameFormData.contestType === 'SCORING' || (!hasAdminAccess(user) && editingGame && (gameStats[editingGame.id]?.scheduledParticipants > 0 || gameStats[editingGame.id]?.totalTeams > 0)) || !hasAdminAccess(user)}
                        >
                          <option value="1v1">1v1 (Individual)</option>
                          {gameFormData.contestType !== 'SCORING' && (
                            <>
                              <option value="2v2">2v2 (Pairs)</option>
                              <option value="3v3">3v3 (Small Teams)</option>
                              <option value="4v4">4v4 (Medium Teams)</option>
                              <option value="5v5">5v5 (Large Teams)</option>
                              <option value="6v6">6v6 (Extra Large)</option>
                              <option value="8v8">8v8 (Squad)</option>
                              <option value="11v11">11v11 (Full Team)</option>
                            </>
                          )}
                        </select>
                        {gameFormData.contestType === 'SCORING' && (
                          <p className="text-xs text-yellow-400 mt-1">
                            Scoring contests only support individual (1v1) format
                          </p>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                          Contest Type *
                        </label>
                        <select
                          value={gameFormData.contestType}
                          onChange={(e) => {
                            const newContestType = e.target.value;
                            setGameFormData(prev => ({
                              ...prev,
                              contestType: newContestType,
                              // Auto-set format to 1v1 and weightage to 3 if Scoring Contest is selected
                              typeFormat: newContestType === 'SCORING' ? '1v1' : prev.typeFormat,
                              weightage: newContestType === 'SCORING' ? 3 : prev.weightage
                            }));
                          }}
                          className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                          required
                          disabled={(!hasAdminAccess(user) && editingGame && gameStats[editingGame.id]?.scheduledParticipants > 0) || !hasAdminAccess(user)}
                        >
                          <option value="SINGLE_ELIMINATION">Single Elimination</option>
                          <option value="SINGLE_ELIMINATION_1V1V1V1">Single Elimination (4 Participants)</option>
                          <option value="ROUND_ROBIN">Round Robin (League)</option>
                          <option value="SCORING">Scoring Contest</option>
                        </select>
                      </div>
                      {gameFormData.contestType === 'SINGLE_ELIMINATION_1V1V1V1' && (
                        <div>
                          <label className="flex items-center space-x-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={gameFormData.oneLoserMode}
                              onChange={(e) => setGameFormData(prev => ({ ...prev, oneLoserMode: e.target.checked }))}
                              className="w-4 h-4 text-blue-600 bg-slate-700 border-slate-600 rounded focus:ring-blue-500 focus:ring-2"
                              disabled={!hasAdminAccess(user) && editingGame && gameStats[editingGame.id]?.scheduledParticipants > 0}
                            />
                            <span className="text-sm font-medium text-slate-300">
                              1 Loser Mode (3 Winners)
                            </span>
                          </label>
                          <p className="text-xs text-slate-400 mt-1 ml-6">
                            When enabled, 3 players win and only 1 player loses in each match
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Scheduling & Logistics Section */}
                  <div className="bg-slate-700/30 rounded-lg p-4">
                    <h4 className="text-lg font-medium text-white mb-4 flex items-center">
                      <Clock className="h-5 w-5 mr-2 text-green-400" />
                      Scheduling & Logistics
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                          Average Game Time (minutes)
                        </label>
                        <Input
                          type="number"
                          min="5"
                          max="180"
                          value={gameFormData.avgGameTime}
                          onChange={(e) => setGameFormData(prev => ({ ...prev, avgGameTime: parseInt(e.target.value) }))}
                          className="bg-slate-700/50 border-slate-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                          placeholder="Duration per match"
                          disabled={!hasAdminAccess(user) && editingGame && gameStats[editingGame.id]?.scheduledParticipants > 0}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                          Simultaneous Games
                        </label>
                        <Input
                          type="number"
                          min="1"
                          max="10"
                          value={gameFormData.simultaneousGames}
                          onChange={(e) => setGameFormData(prev => ({ ...prev, simultaneousGames: parseInt(e.target.value) }))}
                          className="bg-slate-700/50 border-slate-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                          placeholder="Concurrent matches"
                          disabled={!hasAdminAccess(user) && editingGame && gameStats[editingGame.id]?.scheduledParticipants > 0}
                        />
                        <p className="text-xs text-slate-400 mt-1">
                          Number of matches that can be played simultaneously
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Skill Levels Section */}
                  <div className="bg-slate-700/30 rounded-lg p-4">
                    <h4 className="text-lg font-medium text-white mb-4 flex items-center">
                      <Target className="h-5 w-5 mr-2 text-purple-400" />
                      Skill Levels
                    </h4>
                    <div className="grid grid-cols-3 gap-4">
                      {['Beginner', 'Intermediate', 'Advanced'].map(level => (
                        <label key={level} className="flex items-center text-slate-300 p-3 bg-slate-600/30 rounded-lg hover:bg-slate-600/50 cursor-pointer transition-colors">
                          <input
                            type="checkbox"
                            checked={gameFormData.levels.includes(level)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setGameFormData(prev => ({
                                  ...prev,
                                  levels: [...prev.levels, level]
                                }));
                              } else {
                                setGameFormData(prev => ({
                                  ...prev,
                                  levels: prev.levels.filter(l => l !== level)
                                }));
                              }
                            }}
                            className="mr-3 w-4 h-4"
                          />
                          <span className="font-medium">{level}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex justify-end space-x-4 pt-6 border-t border-slate-600">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setShowAddGameForm(false);
                        setSelectedCategory(null);
                        setEditingGame(null);
                        setGameFormData({
                          name: '',
                          description: '',
                          weightage: 1,
                          typeFormat: '1v1',
                          contestType: 'SINGLE_ELIMINATION',
                          avgGameTime: 30,
                          levels: ['Beginner'],
                          simultaneousGames: 1,
                          oneLoserMode: false
                        });
                      }}
                      className="px-6"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      className="codeninja-gradient px-6"
                      disabled={submitting}
                    >
                      {submitting
                        ? (editingGame ? 'Updating...' : 'Creating...')
                        : (editingGame ? 'Update Game' : 'Create Game')
                      }
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Add Venue Modal */}
        {showAddVenueForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4 z-50">
            <Card className="w-full max-w-md bg-slate-800 border-slate-700 mx-2 sm:mx-0">
              <CardHeader>
                <h3 className="text-lg font-semibold text-white">Add Venue</h3>
              </CardHeader>
              <CardContent>
                <form onSubmit={(e) => {
                  e.preventDefault();
                  setSubmitting(true);
                  const formData = new FormData(e.target as HTMLFormElement);
                  const venueData = {
                    categoryId: selectedCategory,
                    name: formData.get('name') as string,
                    courtCount: parseInt(formData.get('courtCount') as string),
                    notes: formData.get('notes') as string
                  };
                  
                  apiCall('/api/venues', {
                    method: 'POST',
                    body: JSON.stringify(venueData)
                  }).then(async (response) => {
                    if (response.ok) {
                      setShowAddVenueForm(false);
                      setSelectedCategory(null);
                      await loadCategories(true);
                    } else {
                      const error = await response.json();
                      alert('Failed to create venue: ' + (error.error || 'Unknown error'));
                    }
                  }).catch((error) => {
                    console.error('Failed to create venue:', error);
                    alert('Failed to create venue. Please try again.');
                  }).finally(() => {
                    setSubmitting(false);
                  });
                }} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Venue Name *
                    </label>
                    <Input
                      name="name"
                      required
                      className="bg-slate-700/50 border-slate-600 text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Number of Courts *
                    </label>
                    <Input
                      name="courtCount"
                      type="number"
                      min="1"
                      max="20"
                      required
                      className="bg-slate-700/50 border-slate-600 text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Notes
                    </label>
                    <textarea
                      name="notes"
                      rows={3}
                      className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="flex justify-end space-x-4 pt-4">
                    <Button type="button" variant="outline" onClick={() => {
                      setShowAddVenueForm(false);
                      setSelectedCategory(null);
                    }}>
                      Cancel
                    </Button>
                    <Button type="submit" className="codeninja-gradient" disabled={submitting}>
                      {submitting ? 'Creating...' : 'Create Venue'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Team Management Modal */}
        {showTeamManagement && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-0 sm:p-4 z-50">
            <Card className="w-full h-full sm:h-auto sm:max-w-6xl bg-slate-800 border-0 sm:border sm:border-slate-700 sm:rounded-lg sm:max-h-[90vh] overflow-y-auto flex flex-col">
              <CardHeader className="flex-shrink-0 border-b border-slate-700 sm:border-b-0">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-white text-lg sm:text-xl">
                      {teamData?.game.typeFormat === '1v1' || teamData?.game.typeFormat === 'Individual'
                        ? `Player Management`
                        : `Team Management`
                      }
                    </CardTitle>
                    <CardDescription className="text-slate-300 text-sm hidden sm:block">
                      <div className="text-2xl font-bold text-white mb-2">{teamData?.game.name}</div>
                      {teamData?.game.typeFormat === '1v1' || teamData?.game.typeFormat === 'Individual'
                        ? `Manage individual players for ${teamData?.game.typeFormat} format`
                        : `Manage teams for ${teamData?.game.typeFormat} format`
                      }
                    </CardDescription>
                    <CardDescription className="text-slate-300 text-xs sm:hidden mt-1">
                      {teamData?.game.name}
                    </CardDescription>
                  </div>
                  <div className="flex items-center space-x-2 flex-shrink-0 ml-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedGameForScheduling(selectedGameForTeams);
                        setShowSchedulingInterface(true);
                      }}
                      className="text-blue-400 hover:text-blue-300 hover:bg-blue-900/20 border-blue-500/50"
                    >
                      <Calendar className="h-4 w-4 mr-1" />
                      <span className="hidden sm:inline">Schedule</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setShowTeamManagement(false);
                        setTeamData(null);
                        setSelectedGameForTeams(null);
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col px-4 sm:px-6">
                {loadingTeams ? (
                  <div className="text-center py-8">
                    <div className="text-white">Loading team data...</div>
                  </div>
                ) : teamData ? (
                  <>
                    {/* Sticky Global Search Input */}
                    <div className="sticky top-0 z-10 bg-slate-800 border-b border-slate-600 -mx-4 sm:-mx-6 px-4 sm:px-6 py-2 mb-2">
                      <div className="bg-slate-700/30 border border-slate-600 rounded-lg p-3">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                          <Input
                            placeholder="Search players, teams, or users..."
                            value={globalSearchTerm}
                            onChange={(e) => setGlobalSearchTerm(e.target.value)}
                            className="pl-10 bg-slate-700/50 border-slate-600 text-white text-sm"
                          />
                        </div>
                        {globalSearchTerm && (
                          <p className="text-xs text-slate-400 mt-2">
                            Searching across all sections for: "{globalSearchTerm}"
                          </p>
                        )}
                      </div>
                    </div>
                    
                    {/* Scrollable Content */}
                    <div className="flex-1 overflow-y-auto space-y-4 sm:space-y-6">

                    {teamData.game.typeFormat === '1v1' || teamData.game.typeFormat === 'Individual' ? (
                      /* Individual Games Interface */
                      <>
                        {/* Collapsible Registered Players Section */}
                        <div className="border border-slate-600 rounded-lg bg-slate-700/30">
                          <button
                            onClick={() => setShowRegisteredPlayersSection(!showRegisteredPlayersSection)}
                            className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-700/50 transition-colors"
                          >
                            <div className="flex items-center space-x-2">
                              <Users className="h-5 w-5 text-green-400" />
                              <span className="text-white font-medium">
                                Registered Players ({teamData.individualRegistrations.length})
                              </span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <span className="text-xs text-slate-400">
                                {showRegisteredPlayersSection ? 'Collapse' : 'Expand'}
                              </span>
                              <div className={`transform transition-transform ${showRegisteredPlayersSection ? 'rotate-180' : ''}`}>
                                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </div>
                            </div>
                          </button>
                          
                          {showRegisteredPlayersSection && (
                            <div className="border-t border-slate-600 p-4">
                              {/* Individual Players List */}
                              <div className="grid gap-3">
                                {teamData.individualRegistrations
                                  .filter(reg => {
                                    if (!globalSearchTerm.trim()) return true;
                                    const searchLower = globalSearchTerm.toLowerCase();
                                    const fullName = `${reg.user.firstName} ${reg.user.lastName}`.toLowerCase();
                                    const email = reg.user.email.toLowerCase();
                                    return fullName.includes(searchLower) || email.includes(searchLower);
                                  })
                                  .map((reg) => (
                                  <Card key={reg.id} className="bg-slate-700/50 border-slate-600">
                                    <CardContent className="p-3 sm:p-4">
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center space-x-2 sm:space-x-3 flex-1 min-w-0">
                                          {reg.user.avatarUrl ? (
                                            <img
                                              src={reg.user.avatarUrl}
                                              alt={reg.user.firstName}
                                              className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex-shrink-0"
                                            />
                                          ) : (
                                            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-medium text-sm flex-shrink-0">
                                              {reg.user.firstName?.[0] || reg.user.email[0]}
                                            </div>
                                          )}
                                          <div className="min-w-0 flex-1">
                                            <p className="text-white font-medium text-sm sm:text-base truncate">
                                              {reg.user.firstName} {reg.user.lastName}
                                            </p>
                                            <p className="text-xs sm:text-sm text-slate-400 truncate">{reg.user.email}</p>
                                            <p className="text-xs text-slate-500 hidden sm:block">
                                              Player Registration
                                            </p>
                                          </div>
                                        </div>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => handleRemovePlayerRegistration(reg.id)}
                                          className="text-red-400 hover:text-red-300 hover:bg-red-900/20 flex-shrink-0 ml-2"
                                        >
                                          <UserMinus className="h-4 w-4 sm:mr-1" />
                                          <span className="hidden sm:inline">Remove</span>
                                        </Button>
                                      </div>
                                    </CardContent>
                                  </Card>
                                ))}
                                {teamData.individualRegistrations.length === 0 && (
                                  <div className="text-center py-8">
                                    <p className="text-slate-400">No players registered yet.</p>
                                  </div>
                                )}
                                {teamData.individualRegistrations.length > 0 &&
                                 teamData.individualRegistrations.filter(reg => {
                                   if (!globalSearchTerm.trim()) return true;
                                   const searchLower = globalSearchTerm.toLowerCase();
                                   const fullName = `${reg.user.firstName} ${reg.user.lastName}`.toLowerCase();
                                   const email = reg.user.email.toLowerCase();
                                   return fullName.includes(searchLower) || email.includes(searchLower);
                                 }).length === 0 && (
                                  <div className="text-center py-8">
                                    <p className="text-slate-400">No players found matching "{globalSearchTerm}"</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Collapsible Unregistered Players Section */}
                        <div className="border border-slate-600 rounded-lg bg-slate-700/30">
                          <button
                            onClick={() => setShowUnregisteredPlayersSection(!showUnregisteredPlayersSection)}
                            className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-700/50 transition-colors"
                          >
                            <div className="flex items-center space-x-2">
                              <UserPlus className="h-5 w-5 text-blue-400" />
                              <span className="text-white font-medium">
                                Unregistered Players ({teamData.availableUsers.length})
                              </span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <span className="text-xs text-slate-400">
                                {showUnregisteredPlayersSection ? 'Collapse' : 'Expand'}
                              </span>
                              <div className={`transform transition-transform ${showUnregisteredPlayersSection ? 'rotate-180' : ''}`}>
                                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </div>
                            </div>
                          </button>
                          
                          {showUnregisteredPlayersSection && (
                            <div className="border-t border-slate-600 p-4">
                              {/* Unregistered Players List */}
                              <div className="grid gap-3">
                                {teamData.availableUsers
                                  .filter(user => {
                                    if (!globalSearchTerm.trim()) return true;
                                    const searchLower = globalSearchTerm.toLowerCase();
                                    const fullName = `${user.firstName} ${user.lastName}`.toLowerCase();
                                    const email = user.email.toLowerCase();
                                    return fullName.includes(searchLower) || email.includes(searchLower);
                                  })
                                  .map((user) => (
                                  <Card key={user.id} className="bg-slate-700/50 border-slate-600">
                                    <CardContent className="p-3 sm:p-4">
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center space-x-2 sm:space-x-3 flex-1 min-w-0">
                                          {user.avatarUrl ? (
                                            <img
                                              src={user.avatarUrl}
                                              alt={user.firstName}
                                              className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex-shrink-0"
                                            />
                                          ) : (
                                            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-medium text-sm flex-shrink-0">
                                              {user.firstName?.[0] || user.email[0]}
                                            </div>
                                          )}
                                          <div className="min-w-0 flex-1">
                                            <p className="text-white font-medium text-sm sm:text-base truncate">
                                              {user.firstName} {user.lastName}
                                            </p>
                                            <p className="text-xs sm:text-sm text-slate-400 truncate">{user.email}</p>
                                            <p className="text-xs text-slate-500 hidden sm:block">
                                              Available for Registration
                                            </p>
                                          </div>
                                        </div>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => handleRegisterSinglePlayer(user.id)}
                                          className="text-green-400 hover:text-green-300 hover:bg-green-900/20 flex-shrink-0 ml-2"
                                        >
                                          <UserPlus className="h-4 w-4 sm:mr-1" />
                                          <span className="hidden sm:inline">Register</span>
                                        </Button>
                                      </div>
                                    </CardContent>
                                  </Card>
                                ))}
                                {teamData.availableUsers.length === 0 && (
                                  <div className="text-center py-8">
                                    <p className="text-slate-400">No unregistered players available.</p>
                                  </div>
                                )}
                                {teamData.availableUsers.length > 0 &&
                                 teamData.availableUsers.filter(user => {
                                   if (!globalSearchTerm.trim()) return true;
                                   const searchLower = globalSearchTerm.toLowerCase();
                                   const fullName = `${user.firstName} ${user.lastName}`.toLowerCase();
                                   const email = user.email.toLowerCase();
                                   return fullName.includes(searchLower) || email.includes(searchLower);
                                 }).length === 0 && (
                                  <div className="text-center py-8">
                                    <p className="text-slate-400">No unregistered players found matching "{globalSearchTerm}"</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </>
                    ) : (
                      /* Team Games Interface */
                      <>

                        {/* Collapsible Teams Section */}
                        <div className="border border-slate-600 rounded-lg bg-slate-700/30">
                          <button
                            onClick={() => setShowTeamsSection(!showTeamsSection)}
                            className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-700/50 transition-colors"
                          >
                            <div className="flex items-center space-x-2">
                              <Users className="h-5 w-5 text-green-400" />
                              <span className="text-white font-medium">
                                Teams ({showIncompleteOnly ? getFilteredTeams().length : teamData.teams.length})
                              </span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <span className="text-xs text-slate-400">
                                {showTeamsSection ? 'Collapse' : 'Expand'}
                              </span>
                              <div className={`transform transition-transform ${showTeamsSection ? 'rotate-180' : ''}`}>
                                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </div>
                            </div>
                          </button>
                          
                          {showTeamsSection && (
                            <div className="border-t border-slate-600 p-4">
                              {/* Team Controls */}
                              <div className="flex flex-col space-y-3 sm:flex-row sm:justify-between sm:items-center sm:space-y-0 mb-4">
                                <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-4">
                                  <Button
                                    size="sm"
                                    variant={showIncompleteOnly ? "default" : "outline"}
                                    onClick={() => setShowIncompleteOnly(!showIncompleteOnly)}
                                    className={`w-full sm:w-auto ${showIncompleteOnly ? "bg-orange-600 hover:bg-orange-700" : ""}`}
                                  >
                                    <Filter className="h-4 w-4 mr-1" />
                                    {showIncompleteOnly ? "Show All" : "Incomplete Only"}
                                  </Button>
                                </div>
                              </div>

                              {/* Existing Teams */}
                              <div className="grid gap-4 grid-cols-1 lg:grid-cols-3 md:grid-cols-2">
                      {getFilteredTeams().map((team) => {
                        const incomplete = isTeamIncomplete(team);
                        return (
                        <Card
                          key={team.id}
                          className={`border-slate-600 ${
                            incomplete
                              ? "bg-orange-900/30 border-orange-500/50"
                              : "bg-slate-700/50"
                          }`}
                        >
                          <CardContent className="p-3 sm:p-4">
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center space-x-2">
                                  {editingTeamId === team.id ? (
                                    <div className="flex items-center space-x-2 flex-1">
                                      <Input
                                        value={editingTeamName}
                                        onChange={(e) => setEditingTeamName(e.target.value)}
                                        className="bg-slate-800 border-slate-600 text-white text-sm"
                                        placeholder="Team name"
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') {
                                            handleSaveTeamName(team.id);
                                          } else if (e.key === 'Escape') {
                                            handleCancelEditTeamName();
                                          }
                                        }}
                                        autoFocus
                                      />
                                      <Button
                                        size="sm"
                                        onClick={() => handleSaveTeamName(team.id)}
                                        className="bg-green-600 hover:bg-green-700 text-white px-2"
                                      >
                                        <CheckCircle className="h-3 w-3" />
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={handleCancelEditTeamName}
                                        className="text-slate-400 hover:text-slate-300 px-2"
                                      >
                                        <XCircle className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  ) : (
                                    <>
                                      <h4 className="font-semibold text-white text-base sm:text-lg truncate">{team.name}</h4>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => handleEditTeamName(team.id, team.name)}
                                        className="text-slate-400 hover:text-slate-300 hover:bg-slate-700/50 p-1 h-auto"
                                        title="Edit team name"
                                      >
                                        <Edit className="h-3 w-3" />
                                      </Button>
                                      {incomplete && (
                                        <span className="text-xs bg-orange-500 text-white px-2 py-1 rounded flex-shrink-0">
                                          Incomplete
                                        </span>
                                      )}
                                    </>
                                  )}
                                </div>
                                <p className="text-xs sm:text-sm text-slate-400 truncate">
                                  Leader: {team.leader.firstName} {team.leader.lastName}
                                </p>
                              </div>
                              <div className="flex items-center space-x-2 sm:space-x-3 flex-shrink-0 ml-2">
                                <div className="text-xs sm:text-sm text-slate-400 text-right">
                                  <div>{team.members.length} member{team.members.length !== 1 ? 's' : ''}</div>
                                  {teamData?.game.typeFormat && (
                                    <div className="text-xs">
                                      / {parseInt(teamData.game.typeFormat.split('v')[0])} needed
                                    </div>
                                  )}
                                </div>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleDeleteTeam(team.id, team.name)}
                                  className="text-red-400 hover:text-red-300 hover:bg-red-900/20 border-red-500/50"
                                  title="Delete team and remove all members"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                            
                            <div className="flex flex-wrap gap-1 sm:gap-2 mb-3">
                              {team.members.map((member) => (
                                <div
                                  key={member.user.id}
                                  className="relative flex items-center space-x-1 sm:space-x-2 bg-slate-600/50 rounded-lg px-2 sm:px-3 py-1 pr-6 sm:pr-8"
                                >
                                  {member.user.avatarUrl ? (
                                    <img
                                      src={member.user.avatarUrl}
                                      alt={member.user.firstName}
                                      className="w-5 h-5 sm:w-6 sm:h-6 rounded-full flex-shrink-0"
                                    />
                                  ) : (
                                    <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-xs text-white flex-shrink-0">
                                      {member.user.firstName?.[0] || member.user.email[0]}
                                    </div>
                                  )}
                                  <span className="text-xs sm:text-sm text-white truncate">
                                    <span className="hidden sm:inline">{member.user.firstName} {member.user.lastName}</span>
                                    <span className="sm:hidden">{member.user.firstName}</span>
                                    {member.user.id === team.teamLead && (
                                      <span className="ml-1 text-xs bg-orange-500 text-white px-1 rounded">
                                        L
                                      </span>
                                    )}
                                  </span>
                                  {member.user.id !== team.teamLead && (
                                    <button
                                      onClick={() => handleRemoveMemberFromTeam(team.id, member.user.id)}
                                      className="absolute top-1 right-1 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded p-0.5"
                                      title="Remove member"
                                    >
                                      <UserMinus className="h-3 w-3" />
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>

                            {/* Add Members to Team */}
                            {(() => {
                              const requiredSize = teamData?.game.typeFormat ? parseInt(teamData.game.typeFormat.split('v')[0]) : 0;
                              const isTeamComplete = team.members.length >= requiredSize;
                              const hasAvailableUsers = teamData.individualRegistrations.length > 0 || teamData.availableUsers.length > 0;
                              
                              return hasAvailableUsers && !isTeamComplete;
                            })() && (
                              <div className="border-t border-slate-600 pt-3">
                                <p className="text-xs sm:text-sm text-slate-400 mb-2">Add members to this team:</p>
                                
                                {/* Search Input */}
                                <div className="relative mb-3">
                                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                                  <Input
                                    placeholder="Search users..."
                                    value={memberSearchTerms[team.id] || ''}
                                    onChange={(e) => setMemberSearchTerms(prev => ({
                                      ...prev,
                                      [team.id]: e.target.value
                                    }))}
                                    className="pl-10 bg-slate-700/50 border-slate-600 text-white text-sm"
                                  />
                                </div>

                                {/* Filtered Users */}
                                <div className="flex flex-wrap gap-1 sm:gap-2 max-h-24 sm:max-h-32 overflow-y-auto">
                                  {filterAvailableUsers(team.id).map((user) => (
                                    <Button
                                      key={user.id}
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleAddMembersToTeam(team.id, [user.id])}
                                      className="text-xs px-2 py-1"
                                      title={user.email}
                                    >
                                      <UserPlus className="h-3 w-3 mr-1" />
                                      <span className="hidden sm:inline">{user.firstName} {user.lastName}</span>
                                      <span className="sm:hidden">{user.firstName}</span>
                                      {'isRegistered' in user && user.isRegistered && (
                                        <span className="ml-1 text-xs bg-blue-500 text-white px-1 rounded">
                                          R
                                        </span>
                                      )}
                                    </Button>
                                  ))}
                                  {filterAvailableUsers(team.id).length === 0 && memberSearchTerms[team.id] && (
                                    <p className="text-xs sm:text-sm text-slate-400 italic">No users found matching "{memberSearchTerms[team.id]}"</p>
                                  )}
                                  </div>
                                </div>
                              )}
                          </CardContent>
                        </Card>
                        );
                      })}
                      {getFilteredTeams().length === 0 && showIncompleteOnly && (
                        <div className="text-center py-8">
                          <p className="text-slate-400">No incomplete teams found. All teams are properly filled!</p>
                        </div>
                      )}
                              </div>
                            </div>
                          )}
                        </div>

                    {/* Individual Registrations */}
                    {teamData.individualRegistrations.length > 0 && (
                      <div className="border border-slate-600 rounded-lg bg-slate-700/30">
                        <button
                          onClick={() => setShowIndividualRegistrationsSection(!showIndividualRegistrationsSection)}
                          className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-700/50 transition-colors"
                        >
                          <div className="flex items-center space-x-2">
                            <Users className="h-5 w-5 text-orange-400" />
                            <span className="text-white font-medium">
                              Individual Registrations ({teamData.individualRegistrations.filter(reg => {
                                if (!globalSearchTerm) return true;
                                const searchLower = globalSearchTerm.toLowerCase();
                                const fullName = `${reg.user.firstName} ${reg.user.lastName}`.toLowerCase();
                                const email = reg.user.email.toLowerCase();
                                return fullName.includes(searchLower) || email.includes(searchLower);
                              }).length})
                            </span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className="text-xs text-slate-400">
                              {showIndividualRegistrationsSection ? 'Collapse' : 'Expand'}
                            </span>
                            <div className={`transform transition-transform ${showIndividualRegistrationsSection ? 'rotate-180' : ''}`}>
                              <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </div>
                          </div>
                        </button>
                        
                        {showIndividualRegistrationsSection && (
                          <div className="border-t border-slate-600 p-4">
                        <div className="grid gap-2">
                          {teamData.individualRegistrations
                            .filter(reg => {
                              if (!globalSearchTerm) return true;
                              const searchLower = globalSearchTerm.toLowerCase();
                              const fullName = `${reg.user.firstName} ${reg.user.lastName}`.toLowerCase();
                              const email = reg.user.email.toLowerCase();
                              return fullName.includes(searchLower) || email.includes(searchLower);
                            })
                            .map((reg) => (
                            <div
                              key={reg.id}
                              className="flex items-center justify-between p-2 sm:p-3 bg-slate-700/30 rounded-lg"
                            >
                              <div className="flex items-center space-x-2 sm:space-x-3 flex-1 min-w-0">
                                {reg.user.avatarUrl ? (
                                  <img
                                    src={reg.user.avatarUrl}
                                    alt={reg.user.firstName}
                                    className="w-6 h-6 sm:w-8 sm:h-8 rounded-full flex-shrink-0"
                                  />
                                ) : (
                                  <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-xs sm:text-sm text-white flex-shrink-0">
                                    {reg.user.firstName?.[0] || reg.user.email[0]}
                                  </div>
                                )}
                                <div className="min-w-0 flex-1">
                                  <p className="text-white font-medium text-sm sm:text-base truncate">
                                    {reg.user.firstName} {reg.user.lastName}
                                  </p>
                                  <p className="text-xs sm:text-sm text-slate-400 truncate">{reg.user.email}</p>
                                </div>
                              </div>
                              <div className="flex items-center space-x-1 sm:space-x-2 flex-shrink-0 ml-2">
                                <select
                                  onChange={(e) => {
                                    if (e.target.value) {
                                      handleAssignPlayerToTeam(reg.id, e.target.value);
                                    }
                                  }}
                                  className="text-xs sm:text-sm bg-slate-700 border border-slate-600 text-white rounded px-2 py-1 min-w-0 max-w-[120px] sm:max-w-[200px]"
                                  defaultValue=""
                                >
                                  <option value="" disabled>
                                    <span className="hidden sm:inline">Assign to Team</span>
                                    <span className="sm:hidden">Assign</span>
                                  </option>
                                  {teamData.teams
                                    .filter(team => isTeamIncomplete(team))
                                    .map(team => (
                                      <option key={team.id} value={team.id}>
                                        {team.name} ({team.leader.firstName} {team.leader.lastName})
                                      </option>
                                    ))}
                                </select>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleCreateTeamWithPlayer(reg.id)}
                                  className="text-green-400 hover:text-green-300 hover:bg-green-900/20 flex-shrink-0"
                                  title="Create new team with this player as leader"
                                >
                                  <Users className="h-4 w-4 sm:mr-1" />
                                  <span className="hidden sm:inline">Create Team</span>
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleRemovePlayerRegistration(reg.id)}
                                  className="text-red-400 hover:text-red-300 hover:bg-red-900/20 flex-shrink-0"
                                >
                                  <UserMinus className="h-4 w-4 sm:mr-1" />
                                  <span className="hidden sm:inline">Remove</span>
                                </Button>
                              </div>
                            </div>
                          ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                        {/* Collapsible Unregistered Players Section for Team Games */}
                        <div className="border border-slate-600 rounded-lg bg-slate-700/30">
                          <button
                            onClick={() => setShowUnregisteredPlayersSection(!showUnregisteredPlayersSection)}
                            className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-700/50 transition-colors"
                          >
                            <div className="flex items-center space-x-2">
                              <UserPlus className="h-5 w-5 text-blue-400" />
                              <span className="text-white font-medium">
                                Unregistered Players ({teamData.availableUsers.length})
                              </span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <span className="text-xs text-slate-400">
                                {showUnregisteredPlayersSection ? 'Collapse' : 'Expand'}
                              </span>
                              <div className={`transform transition-transform ${showUnregisteredPlayersSection ? 'rotate-180' : ''}`}>
                                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </div>
                            </div>
                          </button>
                          
                          {showUnregisteredPlayersSection && (
                            <div className="border-t border-slate-600 p-4">
                              {/* Unregistered Players List */}
                              <div className="grid gap-3">
                                {teamData.availableUsers
                                  .filter(user => {
                                    if (!globalSearchTerm.trim()) return true;
                                    const searchLower = globalSearchTerm.toLowerCase();
                                    const fullName = `${user.firstName} ${user.lastName}`.toLowerCase();
                                    const email = user.email.toLowerCase();
                                    return fullName.includes(searchLower) || email.includes(searchLower);
                                  })
                                  .map((user) => (
                                  <Card key={user.id} className="bg-slate-700/50 border-slate-600">
                                    <CardContent className="p-3 sm:p-4">
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center space-x-2 sm:space-x-3 flex-1 min-w-0">
                                          {user.avatarUrl ? (
                                            <img
                                              src={user.avatarUrl}
                                              alt={user.firstName}
                                              className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex-shrink-0"
                                            />
                                          ) : (
                                            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-medium text-sm flex-shrink-0">
                                              {user.firstName?.[0] || user.email[0]}
                                            </div>
                                          )}
                                          <div className="min-w-0 flex-1">
                                            <p className="text-white font-medium text-sm sm:text-base truncate">
                                              {user.firstName} {user.lastName}
                                            </p>
                                            <p className="text-xs sm:text-sm text-slate-400 truncate">{user.email}</p>
                                            <p className="text-xs text-slate-500 hidden sm:block">
                                              Available for Registration
                                            </p>
                                          </div>
                                        </div>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => handleRegisterSinglePlayer(user.id)}
                                          className="text-green-400 hover:text-green-300 hover:bg-green-900/20 flex-shrink-0 ml-2"
                                        >
                                          <UserPlus className="h-4 w-4 sm:mr-1" />
                                          <span className="hidden sm:inline">Register</span>
                                        </Button>
                                      </div>
                                    </CardContent>
                                  </Card>
                                ))}
                                {teamData.availableUsers.length === 0 && (
                                  <div className="text-center py-8">
                                    <p className="text-slate-400">No unregistered players available.</p>
                                  </div>
                                )}
                                {teamData.availableUsers.length > 0 &&
                                 teamData.availableUsers.filter(user => {
                                   if (!globalSearchTerm.trim()) return true;
                                   const searchLower = globalSearchTerm.toLowerCase();
                                   const fullName = `${user.firstName} ${user.lastName}`.toLowerCase();
                                   const email = user.email.toLowerCase();
                                   return fullName.includes(searchLower) || email.includes(searchLower);
                                 }).length === 0 && (
                                  <div className="text-center py-8">
                                    <p className="text-slate-400">No unregistered players found matching "{globalSearchTerm}"</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                     </>
                   )}
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8">
                    <div className="text-slate-400">Failed to load team data</div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}


        {/* Register Player Modal */}
        {showRegisterPlayerModal && selectedGameForRegistration && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-0 sm:p-4 z-50">
            <Card className="w-full h-full sm:h-auto sm:max-w-2xl bg-slate-800 border-0 sm:border sm:border-slate-700 sm:rounded-lg sm:max-h-[90vh] overflow-y-auto">
              <CardHeader className="flex-shrink-0 border-b border-slate-700 sm:border-b-0">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-white text-lg sm:text-xl">Register Players</CardTitle>
                    <CardDescription className="text-slate-300 text-sm hidden sm:block">
                      Register players for {selectedGameForRegistration.name} ({selectedGameForRegistration.typeFormat})
                    </CardDescription>
                    <CardDescription className="text-slate-300 text-xs sm:hidden mt-1">
                      {selectedGameForRegistration.name}
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-shrink-0 ml-2"
                    onClick={() => {
                      setShowRegisterPlayerModal(false);
                      setSelectedGameForRegistration(null);
                      setSelectedUsersForRegistration([]);
                      setGlobalSearchTerm('');
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto p-4 sm:p-6">
                {loadingUsers ? (
                  <div className="text-center py-8">
                    <div className="text-white">Loading users...</div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="text-sm text-slate-300 mb-4 hidden sm:block">
                      {selectedGameForRegistration.typeFormat === '1v1' || selectedGameForRegistration.typeFormat === 'Individual'
                        ? 'Selected players will be registered directly for individual play.'
                        : 'Selected players will be registered as unassigned and can be assigned to teams later via the Configure button.'
                      }
                    </div>

                    <div className="space-y-4">
                      {/* Registration Settings */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 p-3 sm:p-4 bg-slate-700/30 rounded-lg">
                        <div>
                          <label className="block text-sm font-medium text-slate-300 mb-2">
                            Skill Level *
                          </label>
                          <select
                            value={registrationFormData.level}
                            onChange={(e) => setRegistrationFormData(prev => ({ ...prev, level: e.target.value }))}
                            className="w-full bg-slate-700/50 border border-slate-600 text-white rounded-md px-3 py-2 text-sm"
                          >
                            {(() => {
                              try {
                                const levels = selectedGameForRegistration.levels
                                  ? (typeof selectedGameForRegistration.levels === 'string'
                                      ? JSON.parse(selectedGameForRegistration.levels)
                                      : selectedGameForRegistration.levels)
                                  : ['Beginner', 'Intermediate', 'Advanced'];
                                return levels.map((level: string) => (
                                  <option key={level} value={level}>{level}</option>
                                ));
                              } catch (e) {
                                return ['Beginner', 'Intermediate', 'Advanced'].map((level: string) => (
                                  <option key={level} value={level}>{level}</option>
                                ));
                              }
                            })()}
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-slate-300 mb-2">
                            Registration Mode
                          </label>
                          <select
                            value={registrationFormData.mode}
                            onChange={(e) => setRegistrationFormData(prev => ({ ...prev, mode: e.target.value }))}
                            className="w-full bg-slate-700/50 border border-slate-600 text-white rounded-md px-3 py-2 text-sm"
                            disabled={selectedGameForRegistration.typeFormat !== '1v1' && selectedGameForRegistration.typeFormat !== 'Individual'}
                          >
                            <option value="INDIVIDUAL">Individual</option>
                            <option value="TEAM">Team (Unassigned)</option>
                          </select>
                        </div>

                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                          Search Users
                        </label>
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                          <Input
                            value={globalSearchTerm}
                            onChange={(e) => setGlobalSearchTerm(e.target.value)}
                            placeholder="Search by name or email..."
                            className="bg-slate-700/50 border-slate-600 text-white pl-10 text-sm"
                            autoComplete="off"
                            autoCorrect="off"
                            autoCapitalize="off"
                            spellCheck="false"
                          />
                        </div>
                      </div>

                      <div className="text-sm font-medium text-slate-300">
                        Available Users ({getFilteredUsers().length} of {availableUsers.length})
                      </div>
                    </div>

                    <div className="max-h-64 sm:max-h-96 overflow-y-auto space-y-2">
                      {getFilteredUsers().map((user) => (
                        <label key={user.id} className="flex items-center p-2 sm:p-3 bg-slate-700/50 rounded-lg hover:bg-slate-700/70 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedUsersForRegistration.includes(user.id)}
                            onChange={() => handleUserSelectionToggle(user.id)}
                            className="mr-2 sm:mr-3 flex-shrink-0"
                          />
                          <div className="flex items-center space-x-2 sm:space-x-3 flex-1 min-w-0">
                            {user.avatarUrl ? (
                              <img
                                src={user.avatarUrl}
                                alt={`${user.firstName} ${user.lastName}`}
                                className="w-6 h-6 sm:w-8 sm:h-8 rounded-full object-cover flex-shrink-0"
                              />
                            ) : (
                              <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0">
                                <span className="text-white text-xs sm:text-sm font-medium">
                                  {user.firstName[0]}{user.lastName[0]}
                                </span>
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="text-white font-medium text-sm sm:text-base truncate">
                                {user.firstName} {user.lastName}
                              </div>
                              <div className="text-slate-400 text-xs sm:text-sm truncate">
                                {user.email}
                              </div>
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>

                    {selectedUsersForRegistration.length > 0 && (
                      <div className="text-sm text-slate-300 mt-4">
                        Selected: {selectedUsersForRegistration.length} user(s)
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-4 pt-4 border-t border-slate-700 sm:border-t-0">
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full sm:w-auto"
                        onClick={() => {
                          setShowRegisterPlayerModal(false);
                          setSelectedGameForRegistration(null);
                          setSelectedUsersForRegistration([]);
                          setGlobalSearchTerm('');
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleSubmitPlayerRegistration}
                        className="codeninja-gradient w-full sm:w-auto"
                        disabled={submitting || selectedUsersForRegistration.length === 0}
                      >
                        {submitting ? 'Registering...' : `Register ${selectedUsersForRegistration.length} Player(s)`}
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Game Scheduling Interface */}
        {showSchedulingInterface && selectedGameForScheduling && (
          <GameSchedulingInterface
            gameId={selectedGameForScheduling}
            onClose={async () => {
              // Refresh game stats for the scheduled game
              if (selectedGameForScheduling) {
                await refreshGameStats(selectedGameForScheduling);
              }
              setShowSchedulingInterface(false);
              setSelectedGameForScheduling(null);
            }}
            onShowRegistrations={async () => {
              // Close scheduling interface and open team management modal
              setShowSchedulingInterface(false);
              if (selectedGameForScheduling) {
                await handleConfigureGame(selectedGameForScheduling);
              }
            }}
            apiCall={apiCall}
          />
        )}

        {/* Email Players Modal */}
        <EmailPlayersModal
          isOpen={showEmailPlayersModal}
          onClose={() => setShowEmailPlayersModal(false)}
          allGames={allGames}
        />

        {/* Bulk Registration Modal */}
        {showBulkRegisterModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="bg-slate-800 border-slate-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-white text-xl">Bulk Register Players</CardTitle>
                    <CardDescription className="text-slate-300">
                      Register multiple players for a game using their email addresses
                    </CardDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowBulkRegisterModal(false);
                      setBulkRegisterData({ emails: '', selectedCategoryId: '', selectedGameId: '' });
                      setBulkRegisterResults(null);
                    }}
                    className="text-slate-400 hover:text-white"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {!bulkRegisterResults ? (
                  <>
                    {/* Email Input */}
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Email Addresses (comma-separated)
                      </label>
                      <textarea
                        value={bulkRegisterData.emails}
                        onChange={(e) => setBulkRegisterData(prev => ({ ...prev, emails: e.target.value }))}
                        placeholder="user1@example.com, user2@example.com, user3@example.com"
                        className="w-full h-32 px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={bulkRegisterLoading}
                      />
                    </div>

                    {/* Category Selection */}
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Select Category
                      </label>
                      <select
                        value={bulkRegisterData.selectedCategoryId}
                        onChange={(e) => setBulkRegisterData(prev => ({
                          ...prev,
                          selectedCategoryId: e.target.value,
                          selectedGameId: '' // Reset game selection when category changes
                        }))}
                        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={bulkRegisterLoading}
                      >
                        <option value="">Select a category</option>
                        {categories.map(category => (
                          <option key={category.id} value={category.id}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Game Selection */}
                    {bulkRegisterData.selectedCategoryId && (
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                          Select Game
                        </label>
                        <select
                          value={bulkRegisterData.selectedGameId}
                          onChange={(e) => setBulkRegisterData(prev => ({ ...prev, selectedGameId: e.target.value }))}
                          className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          disabled={bulkRegisterLoading}
                        >
                          <option value="">Select a game</option>
                          {categories
                            .find(cat => cat.id === bulkRegisterData.selectedCategoryId)
                            ?.games.map(game => (
                              <option key={game.id} value={game.id}>
                                {game.name} ({game.typeFormat})
                              </option>
                            ))}
                        </select>
                      </div>
                    )}

                    {/* Register Button */}
                    <div className="flex justify-end space-x-3">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setShowBulkRegisterModal(false);
                          setBulkRegisterData({ emails: '', selectedCategoryId: '', selectedGameId: '' });
                        }}
                        disabled={bulkRegisterLoading}
                        className="border-slate-600 text-slate-300 hover:bg-slate-700"
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleBulkRegister}
                        disabled={bulkRegisterLoading || !bulkRegisterData.emails.trim() || !bulkRegisterData.selectedGameId}
                        className="bg-green-600 hover:bg-green-700 text-white"
                      >
                        {bulkRegisterLoading ? 'Registering...' : 'Register Players'}
                      </Button>
                    </div>
                  </>
                ) : (
                  /* Results Display */
                  <div className="space-y-4">
                    <div className="text-center">
                      <h3 className="text-lg font-semibold text-white mb-2">Registration Results</h3>
                      <div className="grid grid-cols-3 gap-4 mb-4">
                        <div className="bg-green-500/20 border border-green-500/50 rounded-lg p-3">
                          <div className="text-2xl font-bold text-green-400">{bulkRegisterResults.results.successful}</div>
                          <div className="text-sm text-green-300">Successful</div>
                        </div>
                        <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-lg p-3">
                          <div className="text-2xl font-bold text-yellow-400">{bulkRegisterResults.results.skipped}</div>
                          <div className="text-sm text-yellow-300">Skipped</div>
                        </div>
                        <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3">
                          <div className="text-2xl font-bold text-red-400">{bulkRegisterResults.results.failed}</div>
                          <div className="text-sm text-red-300">Failed</div>
                        </div>
                      </div>
                    </div>

                    {/* Detailed Results */}
                    <div className="space-y-3 max-h-64 overflow-y-auto">
                      {bulkRegisterResults.results.details.successful.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium text-green-400 mb-2">Successfully Registered:</h4>
                          <div className="space-y-1">
                            {bulkRegisterResults.results.details.successful.map((item: any, index: number) => (
                              <div key={index} className="text-sm text-slate-300 bg-green-500/10 p-2 rounded">
                                {item.name} ({item.email})
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {bulkRegisterResults.results.details.skipped.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium text-yellow-400 mb-2">Skipped:</h4>
                          <div className="space-y-1">
                            {bulkRegisterResults.results.details.skipped.map((item: any, index: number) => (
                              <div key={index} className="text-sm text-slate-300 bg-yellow-500/10 p-2 rounded">
                                {item.email} - {item.reason}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {bulkRegisterResults.results.details.failed.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium text-red-400 mb-2">Failed:</h4>
                          <div className="space-y-1">
                            {bulkRegisterResults.results.details.failed.map((item: any, index: number) => (
                              <div key={index} className="text-sm text-slate-300 bg-red-500/10 p-2 rounded">
                                {item.email} - {item.reason}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex justify-end">
                      <Button
                        onClick={() => {
                          setShowBulkRegisterModal(false);
                          setBulkRegisterData({ emails: '', selectedCategoryId: '', selectedGameId: '' });
                          setBulkRegisterResults(null);
                        }}
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        Close
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
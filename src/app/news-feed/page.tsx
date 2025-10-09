"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Megaphone,
  MessageSquare,
  Newspaper,
  Heart,
  ThumbsUp,
  Smile,
  Trophy,
  Pin,
  Calendar,
  User,
  Send,
  Image as ImageIcon,
  MoreHorizontal,
  Flag,
  Trash2
} from "lucide-react";
import Navigation from "@/components/Navigation";
import { useUser } from "@/contexts/UserContext";

interface NewsItem {
  id: string;
  title: string;
  body: string;
  isPinned: boolean;
  mediaUrls?: string[];
  createdAt: string;
  createdBy: {
    firstName: string;
    lastName: string;
    email: string;
  };
  _count: {
    reactions: number;
  };
  reactions: Array<{
    type: string;
    user: {
      firstName: string;
      lastName: string;
    };
  }>;
  userReaction?: {
    type: string;
  };
}

interface Post {
  id: string;
  content: string;
  mediaUrls: string[];
  createdAt: string;
  author: {
    firstName: string;
    lastName: string;
    email: string;
    avatarUrl?: string;
  };
  _count: {
    comments: number;
    reactions: number;
  };
  reactions: Array<{
    type: string;
    user: {
      firstName: string;
      lastName: string;
    };
  }>;
  userReaction?: {
    type: string;
  };
}

interface Comment {
  id: string;
  content: string;
  createdAt: string;
  author: {
    firstName: string;
    lastName: string;
    email: string;
    avatarUrl?: string;
  };
}

export default function NewsFeedPage() {
  const { apiCall, user: currentUser, loading: userLoading } = useUser();
  const [activeSection, setActiveSection] = useState<'news' | 'feed'>('news');
  const [isMobile, setIsMobile] = useState(false);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [newsLoading, setNewsLoading] = useState(true);
  const [posts, setPosts] = useState<Post[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [expandedPost, setExpandedPost] = useState<string | null>(null);
  const [comments, setComments] = useState<{ [postId: string]: Comment[] }>({});
  const [newComment, setNewComment] = useState<{ [postId: string]: string }>({});
  const [newPost, setNewPost] = useState('');
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);

  // Admin news creation state
  const [showNewsCreator, setShowNewsCreator] = useState(false);
  const [newNewsTitle, setNewNewsTitle] = useState('');
  const [newNewsBody, setNewNewsBody] = useState('');
  const [newNewsImages, setNewNewsImages] = useState<File[]>([]);
  const [isPinned, setIsPinned] = useState(false);
  const [newsUploadStatus, setNewsUploadStatus] = useState<string>('');
  const [isCreatingNews, setIsCreatingNews] = useState(false);

  // Dropdown and flag functionality
  const [showNewsDropdown, setShowNewsDropdown] = useState<string | null>(null);
  const [showPostDropdown, setShowPostDropdown] = useState<string | null>(null);
  const [showFlagModal, setShowFlagModal] = useState<string | null>(null);
  const [flagReason, setFlagReason] = useState('');

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    // Only load data if user context is ready
    if (!userLoading) {
      if (currentUser) {
        loadNews();
        loadPosts();
      } else {
        // User is not logged in, redirect to login
        window.location.href = '/auth/login';
        return;
      }
    }
  }, [userLoading, currentUser]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showNewsDropdown || showPostDropdown) {
        setShowNewsDropdown(null);
        setShowPostDropdown(null);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showNewsDropdown, showPostDropdown]);

  const loadNews = async () => {
    setNewsLoading(true);
    try {
      const response = await apiCall('/api/news');
      if (response.ok) {
        const data = await response.json();
        setNews(data);
      }
    } catch (error) {
      console.error('Failed to load news:', error);
    } finally {
      setNewsLoading(false);
    }
  };

  const loadPosts = async () => {
    setPostsLoading(true);
    try {
      const response = await apiCall('/api/posts');
      if (response.ok) {
        const data = await response.json();
        setPosts(data);
      }
    } catch (error) {
      console.error('Failed to load posts:', error);
    } finally {
      setPostsLoading(false);
    }
  };

  const toggleNewsReaction = async (newsId: string, type: string) => {
    try {
      const response = await apiCall(`/api/news/${newsId}/reactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      });

      if (response.ok) {
        await loadNews();
      }
    } catch (error) {
      console.error('Failed to toggle news reaction:', error);
    }
  };

  const loadComments = async (postId: string) => {
    try {
      const response = await apiCall(`/api/posts/${postId}/comments`);
      if (response.ok) {
        const data = await response.json();
        setComments(prev => ({ ...prev, [postId]: data }));
      }
    } catch (error) {
      console.error('Failed to load comments:', error);
    }
  };

  const addComment = async (postId: string) => {
    const content = newComment[postId];
    if (!content?.trim()) return;

    try {
      const response = await apiCall(`/api/posts/${postId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });

      if (response.ok) {
        setNewComment(prev => ({ ...prev, [postId]: '' }));
        await loadComments(postId);
        // Update post comment count
        setPosts(prev => prev.map(post =>
          post.id === postId
            ? { ...post, _count: { ...post._count, comments: post._count.comments + 1 } }
            : post
        ));
      }
    } catch (error) {
      console.error('Failed to add comment:', error);
    }
  };

  const createPost = async () => {
    if (!newPost.trim() && selectedImages.length === 0) return;

    setIsUploading(true);
    setUploadStatus('');

    try {
      const formData = new FormData();
      formData.append('content', newPost);
      selectedImages.forEach(image => {
        formData.append('images', image);
      });

      const response = await apiCall('/api/posts', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const result = await response.json();

        // Show success message with upload info
        if (result.uploadErrors && result.uploadErrors.length > 0) {
          setUploadStatus(`Post created! ${result.mediaCount} images uploaded successfully. ${result.uploadErrors.length} failed: ${result.uploadErrors.join(', ')}`);
        } else if (result.mediaCount > 0) {
          setUploadStatus(`Post created successfully with ${result.mediaCount} images!`);
        } else {
          setUploadStatus('Post created successfully!');
        }

        setNewPost('');
        setSelectedImages([]);
        await loadPosts();

        // Clear status after 5 seconds
        setTimeout(() => setUploadStatus(''), 5000);
      } else {
        const errorData = await response.json();
        setUploadStatus(`Failed to create post: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to create post:', error);
      setUploadStatus('Failed to create post. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    setSelectedImages(prev => [...prev, ...imageFiles].slice(0, 4)); // Max 4 images
  };

  const removeImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
  };

  const toggleComments = (postId: string) => {
    if (expandedPost === postId) {
      setExpandedPost(null);
    } else {
      setExpandedPost(postId);
      if (!comments[postId]) {
        loadComments(postId);
      }
    }
  };

  const togglePostReaction = async (postId: string, type: string) => {
    try {
      const response = await apiCall(`/api/posts/${postId}/reactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      });

      if (response.ok) {
        await loadPosts();
      }
    } catch (error) {
      console.error('Failed to toggle post reaction:', error);
    }
  };

  const createNews = async () => {
    if (!newNewsTitle.trim() || !newNewsBody.trim()) return;

    setIsCreatingNews(true);
    setNewsUploadStatus('');

    try {
      const formData = new FormData();
      formData.append('title', newNewsTitle);
      formData.append('body', newNewsBody);
      formData.append('isPinned', isPinned.toString());
      newNewsImages.forEach(image => {
        formData.append('images', image);
      });

      const response = await apiCall('/api/news', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const result = await response.json();

        // Show success message with upload info
        if (result.uploadErrors && result.uploadErrors.length > 0) {
          setNewsUploadStatus(`News created! ${result.mediaCount} images uploaded successfully. ${result.uploadErrors.length} failed: ${result.uploadErrors.join(', ')}`);
        } else if (result.mediaCount > 0) {
          setNewsUploadStatus(`News created successfully with ${result.mediaCount} images!`);
        } else {
          setNewsUploadStatus('News created successfully!');
        }

        setNewNewsTitle('');
        setNewNewsBody('');
        setNewNewsImages([]);
        setIsPinned(false);
        setShowNewsCreator(false);
        await loadNews();

        // Clear status after 5 seconds
        setTimeout(() => setNewsUploadStatus(''), 5000);
      } else {
        const errorData = await response.json();
        setNewsUploadStatus(`Failed to create news: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to create news:', error);
      setNewsUploadStatus('Failed to create news. Please try again.');
    } finally {
      setIsCreatingNews(false);
    }
  };

  const handleNewsImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    setNewNewsImages(prev => [...prev, ...imageFiles].slice(0, 4)); // Max 4 images
  };

  const removeNewsImage = (index: number) => {
    setNewNewsImages(prev => prev.filter((_, i) => i !== index));
  };

  const deleteNews = async (newsId: string) => {
    if (!confirm('Are you sure you want to delete this news article?')) return;

    try {
      const response = await apiCall(`/api/news?id=${newsId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        await loadNews();
        setShowNewsDropdown(null);
      } else {
        const errorData = await response.json();
        alert(`Failed to delete news: ${errorData.error}`);
      }
    } catch (error) {
      console.error('Failed to delete news:', error);
      alert('Failed to delete news. Please try again.');
    }
  };

  const deletePost = async (postId: string) => {
    if (!confirm('Are you sure you want to delete this post?')) return;

    try {
      const response = await apiCall(`/api/posts?id=${postId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        await loadPosts();
        setShowPostDropdown(null);
      } else {
        const errorData = await response.json();
        alert(`Failed to delete post: ${errorData.error}`);
      }
    } catch (error) {
      console.error('Failed to delete post:', error);
      alert('Failed to delete post. Please try again.');
    }
  };

  const flagPost = async (postId: string) => {
    if (!flagReason.trim()) {
      alert('Please provide a reason for flagging this post.');
      return;
    }

    try {
      const response = await apiCall(`/api/posts/${postId}/flag`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: flagReason.trim() })
      });

      if (response.ok) {
        const result = await response.json();
        alert(result.message || 'Post has been flagged for review');
        setShowFlagModal(null);
        setFlagReason('');
        setShowPostDropdown(null);
        await loadPosts();
      } else {
        const errorData = await response.json();
        alert(`Failed to flag post: ${errorData.error}`);
      }
    } catch (error) {
      console.error('Failed to flag post:', error);
      alert('Failed to flag post. Please try again.');
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

  const getReactionIcon = (type: string) => {
    switch (type) {
      case 'like': return <ThumbsUp className="h-4 w-4" />;
      case 'love': return <Heart className="h-4 w-4" />;
      case 'celebrate': return <Trophy className="h-4 w-4" />;
      default: return <Smile className="h-4 w-4" />;
    }
  };

  const getReactionColor = (type: string) => {
    switch (type) {
      case 'like': return 'text-blue-400';
      case 'love': return 'text-red-400';
      case 'celebrate': return 'text-yellow-400';
      default: return 'text-slate-400';
    }
  };

  if (userLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-white text-lg">Loading...</div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-white">Redirecting to login...</div>
      </div>
    );
  }

  if (!currentUser) {
    return null;
  }

  const pinnedNews = news.filter(item => item.isPinned);
  const regularNews = news.filter(item => !item.isPinned);

  return (
    <div className="h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col">
      <Navigation currentPage="news-feed" />

      <div className="border-b border-slate-700/50 bg-slate-900/50 backdrop-blur-sm">
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center space-x-2">
            <Newspaper className="h-6 w-6 sm:h-8 sm:w-8 text-orange-400" />
            <span>News & Community</span>
          </h1>
          <p className="text-sm sm:text-base text-slate-400">Stay updated and connect with the community</p>
        </div>
      </div>

      {isMobile && (
        <div className="bg-slate-900/90 backdrop-blur-sm border-b border-slate-700/50">
          <div className="container mx-auto px-3 py-2">
            <div className="flex items-center justify-center space-x-2">
              <Button
                variant={activeSection === 'news' ? 'default' : 'ghost'}
                onClick={() => setActiveSection('news')}
                className="flex items-center space-x-1 h-8 px-3 text-sm"
                size="sm"
              >
                <Megaphone className="h-3 w-3" />
                <span>News</span>
              </Button>
              <Button
                variant={activeSection === 'feed' ? 'default' : 'ghost'}
                onClick={() => setActiveSection('feed')}
                className="flex items-center space-x-1 h-8 px-3 text-sm"
                size="sm"
              >
                <MessageSquare className="h-3 w-3" />
                <span>Feed</span>
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-hidden">
        <div className={`h-full ${isMobile ? 'block' : 'container mx-auto grid lg:grid-cols-2 gap-1'}`}>


          {/* News Section */}
          <div className={`${isMobile && activeSection !== 'news' ? 'hidden' : 'flex'} flex-col h-full ${!isMobile ? 'border-r border-slate-700/30' : ''}`}>
            <div className="flex items-center justify-between px-3 sm:px-6 py-3 sm:py-4 border-b border-slate-700/50 bg-slate-900/50 sticky top-0 z-10">
              <div className="flex items-center space-x-2 min-w-0 flex-1">
                <Megaphone className="h-5 w-5 sm:h-6 sm:w-6 text-orange-400 flex-shrink-0" />
                <h2 className="text-lg sm:text-xl font-bold text-white truncate">News & Announcements</h2>
              </div>
              {currentUser?.role === 'ADMIN' && (
                <Button
                  onClick={() => setShowNewsCreator(!showNewsCreator)}
                  className="codeninja-gradient flex-shrink-0"
                  size="sm"
                >
                  <Megaphone className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">{showNewsCreator ? 'Cancel' : 'Create News'}</span>
                  <span className="sm:hidden">{showNewsCreator ? 'Cancel' : 'Create'}</span>
                </Button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-slate-800">
              <div className="px-3 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6 max-w-2xl mx-auto">

            {/* Admin News Creator */}
            {currentUser?.role === 'ADMIN' && showNewsCreator && (
              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader className="pb-3 sm:pb-6">
                  <h3 className="text-white font-medium text-base sm:text-lg">Create News Announcement</h3>
                </CardHeader>
                <CardContent className="space-y-3 sm:space-y-4">
                  <Input
                    value={newNewsTitle}
                    onChange={(e) => setNewNewsTitle(e.target.value)}
                    placeholder="News title..."
                    className="bg-slate-700 border-slate-600 text-white text-sm sm:text-base"
                  />

                  <textarea
                    value={newNewsBody}
                    onChange={(e) => setNewNewsBody(e.target.value)}
                    placeholder="Write your announcement..."
                    className="w-full bg-slate-700 border-slate-600 text-white rounded-lg p-2 sm:p-3 min-h-[100px] sm:min-h-[120px] resize-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm sm:text-base"
                  />

                  {/* Image Preview */}
                  {newNewsImages.length > 0 && (
                    <div className="grid grid-cols-2 gap-2">
                      {newNewsImages.map((image, index) => (
                        <div key={index} className="relative">
                          <img
                            src={URL.createObjectURL(image)}
                            alt={`Preview ${index + 1}`}
                            className="w-full h-24 sm:h-32 object-cover rounded-lg"
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => removeNewsImage(index)}
                            className="absolute top-1 right-1 sm:top-2 sm:right-2 h-5 w-5 sm:h-6 sm:w-6 p-0 bg-red-500 hover:bg-red-600 border-none text-xs sm:text-sm"
                          >
                            ×
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                    <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-4">
                      <div className="flex items-center space-x-2">
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={handleNewsImageSelect}
                          className="hidden"
                          id="image-upload-news"
                        />
                        <label htmlFor="image-upload-news">
                          <Button variant="outline" size="sm" className="cursor-pointer h-8 px-3" asChild>
                            <span className="flex items-center space-x-1 sm:space-x-2">
                              <ImageIcon className="h-3 w-3 sm:h-4 sm:w-4" />
                              <span className="text-xs sm:text-sm">Add Photos</span>
                            </span>
                          </Button>
                        </label>
                        <span className="text-xs text-slate-400 whitespace-nowrap">
                          {newNewsImages.length}/4 images
                        </span>
                      </div>

                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="pin-news"
                          checked={isPinned}
                          onChange={(e) => setIsPinned(e.target.checked)}
                          className="rounded border-slate-600 bg-slate-700 text-orange-500 focus:ring-orange-500"
                        />
                        <label htmlFor="pin-news" className="text-xs sm:text-sm text-slate-300 flex items-center space-x-1">
                          <Pin className="h-3 w-3 sm:h-4 sm:w-4" />
                          <span className="whitespace-nowrap">Pin announcement</span>
                        </label>
                      </div>
                    </div>

                    <Button
                      onClick={createNews}
                      disabled={(!newNewsTitle.trim() || !newNewsBody.trim()) || isCreatingNews}
                      className="codeninja-gradient w-full sm:w-auto"
                      size="sm"
                    >
                      <Send className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                      <span className="text-xs sm:text-sm">{isCreatingNews ? 'Creating...' : 'Create News'}</span>
                    </Button>
                  </div>

                  {/* Upload Status */}
                  {newsUploadStatus && (
                    <div className={`text-xs sm:text-sm p-2 sm:p-3 rounded-lg ${
                      newsUploadStatus.includes('Failed') || newsUploadStatus.includes('failed')
                        ? 'bg-red-900/20 text-red-400 border border-red-800'
                        : 'bg-green-900/20 text-green-400 border border-green-800'
                    }`}>
                      {newsUploadStatus}
                    </div>
                  )}

                  {/* Loading indicator */}
                  {isCreatingNews && (
                    <div className="flex items-center justify-center space-x-2 text-orange-400">
                      <div className="animate-spin h-3 w-3 sm:h-4 sm:w-4 border-2 border-orange-500 border-t-transparent rounded-full"></div>
                      <span className="text-xs sm:text-sm">Creating news...</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {newsLoading ? (
              <Card className="bg-slate-800/50 border-slate-700">
                <CardContent className="text-center py-12">
                  <div className="animate-spin h-8 w-8 border-2 border-orange-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                  <p className="text-slate-400">Loading news...</p>
                </CardContent>
              </Card>
            ) : news.length === 0 ? (
              <Card className="bg-slate-800/50 border-slate-700">
                <CardContent className="text-center py-12">
                  <Megaphone className="h-12 w-12 mx-auto mb-4 text-slate-400" />
                  <h3 className="text-lg font-medium text-white mb-2">No announcements yet</h3>
                  <p className="text-slate-400">Check back later for updates from the organizers.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {[...pinnedNews, ...regularNews].map((item) => (
                  <Card key={item.id} className={`${item.isPinned ? 'bg-gradient-to-r from-orange-500/10 to-red-500/10 border-orange-500/30' : 'bg-slate-800/50 border-slate-700'}`}>
                    <CardHeader className="pb-3 sm:pb-6">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1">
                          <div className={`h-8 w-8 sm:h-10 sm:w-10 rounded-full flex items-center justify-center flex-shrink-0 ${item.isPinned ? 'bg-gradient-to-r from-orange-500 to-red-500' : 'bg-gradient-to-r from-blue-500 to-green-500'}`}>
                            {item.isPinned ? <Pin className="h-4 w-4 sm:h-5 sm:w-5 text-white" /> : <Megaphone className="h-4 w-4 sm:h-5 sm:w-5 text-white" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <CardTitle className="text-white text-lg sm:text-xl truncate">{item.title}</CardTitle>
                            <div className="flex items-center space-x-1 sm:space-x-2 text-slate-400 text-xs sm:text-sm">
                              <User className="h-3 w-3 flex-shrink-0" />
                              <span className="truncate">{item.createdBy.firstName} {item.createdBy.lastName}</span>
                              <Calendar className="h-3 w-3 ml-1 sm:ml-2 flex-shrink-0" />
                              <span className="flex-shrink-0">{formatTimeAgo(item.createdAt)}</span>
                            </div>
                          </div>
                        </div>

                        {/* News Dropdown Menu - Only for Admin */}
                        {currentUser?.role === 'ADMIN' && (
                          <div className="relative">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowNewsDropdown(showNewsDropdown === item.id ? null : item.id);
                              }}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>

                            {showNewsDropdown === item.id && (
                              <div className="absolute right-0 top-8 bg-slate-800 border border-slate-700 rounded-lg shadow-lg z-10 min-w-[150px]">
                                <button
                                  onClick={() => deleteNews(item.id)}
                                  className="w-full text-left px-4 py-2 text-red-400 hover:bg-slate-700 flex items-center space-x-2 rounded-lg"
                                >
                                  <Trash2 className="h-4 w-4" />
                                  <span>Delete News</span>
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-3 sm:space-y-4 pt-0">
                      <div className="prose prose-invert max-w-none">
                        <p className="text-slate-200 whitespace-pre-wrap leading-relaxed text-sm sm:text-base">
                          {item.body}
                        </p>
                      </div>

                      {/* News Images */}
                      {item.mediaUrls && item.mediaUrls.length > 0 && (
                        <div className={`grid gap-2 ${item.mediaUrls.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                          {item.mediaUrls.map((url, index) => (
                            <img
                              key={index}
                              src={url}
                              alt={`News image ${index + 1}`}
                              className="w-full h-24 sm:h-32 object-cover rounded-lg"
                            />
                          ))}
                        </div>
                      )}

                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pt-3 sm:pt-4 border-t border-slate-700/50 gap-2 sm:gap-0">
                        <div className="flex items-center space-x-1 sm:space-x-4 flex-wrap">
                          {['like', 'love', 'celebrate'].map((reactionType) => (
                            <Button
                              key={reactionType}
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleNewsReaction(item.id, reactionType)}
                              className={`flex items-center space-x-1 h-7 px-2 sm:h-8 sm:px-3 text-xs sm:text-sm ${
                                item.userReaction?.type === reactionType
                                  ? getReactionColor(reactionType)
                                  : 'text-slate-400 hover:text-white'
                              }`}
                            >
                              <div className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0">
                                {getReactionIcon(reactionType)}
                              </div>
                              <span className="min-w-0">
                                {item.reactions.filter(r => r.type === reactionType).length || ''}
                              </span>
                            </Button>
                          ))}
                        </div>

                        <div className="text-xs sm:text-sm text-slate-500 text-right sm:text-left">
                          {item._count.reactions} reactions
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
              </div>
            </div>
          </div>

          {/* Feed Section */}
          <div className={`${isMobile && activeSection !== 'feed' ? 'hidden' : 'flex'} flex-col h-full`}>
            <div className="flex items-center space-x-2 px-3 sm:px-6 py-3 sm:py-4 border-b border-slate-700/50 bg-slate-900/50 sticky top-0 z-10">
              <MessageSquare className="h-5 w-5 sm:h-6 sm:w-6 text-blue-400" />
              <h2 className="text-lg sm:text-xl font-bold text-white">Community Feed</h2>
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-slate-800">
              <div className="px-3 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6 max-w-2xl mx-auto">
            {/* Create Post */}
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <h3 className="text-white font-medium">Share an update</h3>
              </CardHeader>
              <CardContent className="space-y-4">
                <textarea
                  value={newPost}
                  onChange={(e) => setNewPost(e.target.value)}
                  placeholder="What's happening with CodeNinja Hub?"
                  className="w-full bg-slate-700 border-slate-600 text-white rounded-lg p-3 min-h-[100px] resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />

                {/* Image Preview */}
                {selectedImages.length > 0 && (
                  <div className="grid grid-cols-2 gap-2">
                    {selectedImages.map((image, index) => (
                      <div key={index} className="relative">
                        <img
                          src={URL.createObjectURL(image)}
                          alt={`Preview ${index + 1}`}
                          className="w-full h-32 object-cover rounded-lg"
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => removeImage(index)}
                          className="absolute top-2 right-2 h-6 w-6 p-0 bg-red-500 hover:bg-red-600 border-none"
                        >
                          ×
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleImageSelect}
                      className="hidden"
                      id="image-upload-feed"
                    />
                    <label htmlFor="image-upload-feed">
                      <Button variant="outline" size="sm" className="cursor-pointer" asChild>
                        <span className="flex items-center space-x-2">
                          <ImageIcon className="h-4 w-4" />
                          <span>Add Photos</span>
                        </span>
                      </Button>
                    </label>
                    <span className="text-xs text-slate-400">
                      {selectedImages.length}/4 images
                    </span>
                  </div>

                  <Button
                    onClick={createPost}
                    disabled={(!newPost.trim() && selectedImages.length === 0) || isUploading}
                    className="codeninja-gradient"
                  >
                    <Send className="h-4 w-4 mr-2" />
                    {isUploading ? 'Posting...' : 'Post'}
                  </Button>
                </div>

                {/* Upload Status */}
                {uploadStatus && (
                  <div className={`text-sm p-3 rounded-lg ${
                    uploadStatus.includes('Failed') || uploadStatus.includes('failed')
                      ? 'bg-red-900/20 text-red-400 border border-red-800'
                      : 'bg-green-900/20 text-green-400 border border-green-800'
                  }`}>
                    {uploadStatus}
                  </div>
                )}

                {/* Loading indicator */}
                {isUploading && (
                  <div className="flex items-center justify-center space-x-2 text-blue-400">
                    <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                    <span>Uploading...</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {postsLoading ? (
              <Card className="bg-slate-800/50 border-slate-700">
                <CardContent className="text-center py-12">
                  <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                  <p className="text-slate-400">Loading posts...</p>
                </CardContent>
              </Card>
            ) : posts.length === 0 ? (
              <Card className="bg-slate-800/50 border-slate-700">
                <CardContent className="text-center py-12">
                  <MessageSquare className="h-12 w-12 mx-auto mb-4 text-slate-400" />
                  <h3 className="text-lg font-medium text-white mb-2">No posts yet</h3>
                  <p className="text-slate-400">Be the first to share something with the community!</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {posts.map((post) => (
                  <Card key={post.id} className="bg-slate-800/50 border-slate-700">
                    <CardHeader className="pb-3 sm:pb-6">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1">
                          <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-gradient-to-r from-blue-500 to-green-500 flex items-center justify-center flex-shrink-0">
                            <span className="text-white font-medium text-sm sm:text-base">
                              {post.author.firstName[0]}{post.author.lastName[0]}
                            </span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <h4 className="text-white font-medium text-sm sm:text-base truncate">
                              {post.author.firstName} {post.author.lastName}
                            </h4>
                            <p className="text-slate-400 text-xs sm:text-sm">{formatTimeAgo(post.createdAt)}</p>
                          </div>
                        </div>

                        {/* Post Dropdown Menu */}
                        {currentUser && (currentUser.email === post.author.email || currentUser.role === 'ADMIN') ? (
                          <div className="relative">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowPostDropdown(showPostDropdown === post.id ? null : post.id);
                              }}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>

                            {showPostDropdown === post.id && (
                              <div className="absolute right-0 top-8 bg-slate-800 border border-slate-700 rounded-lg shadow-lg z-10 min-w-[150px]">
                                <button
                                  onClick={() => deletePost(post.id)}
                                  className="w-full text-left px-4 py-2 text-red-400 hover:bg-slate-700 flex items-center space-x-2 rounded-lg"
                                >
                                  <Trash2 className="h-4 w-4" />
                                  <span>Delete Post</span>
                                </button>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div></div>
                        )}
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-3 sm:space-y-4 pt-0">
                      <p className="text-slate-200 whitespace-pre-wrap leading-relaxed text-sm sm:text-base">
                        {post.content}
                      </p>
                      {post.mediaUrls.length > 0 && (
                        <div className={`grid gap-2 ${post.mediaUrls.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                          {post.mediaUrls.map((url, index) => (
                            <img
                              key={index}
                              src={url}
                              alt={`Post image ${index + 1}`}
                              className="w-full h-24 sm:h-32 object-cover rounded-lg"
                            />
                          ))}
                        </div>
                      )}

                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pt-2 border-t border-slate-700 gap-2 sm:gap-0">
                        <div className="flex items-center space-x-1 sm:space-x-4 flex-wrap">
                          {['like', 'love', 'celebrate'].map((reactionType) => (
                            <Button
                              key={reactionType}
                              variant="ghost"
                              size="sm"
                              onClick={() => togglePostReaction(post.id, reactionType)}
                              className={`flex items-center space-x-1 h-7 px-2 sm:h-8 sm:px-3 text-xs sm:text-sm ${
                                post.userReaction?.type === reactionType
                                  ? getReactionColor(reactionType)
                                  : 'text-slate-400 hover:text-white'
                              }`}
                            >
                              <div className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0">
                                {getReactionIcon(reactionType)}
                              </div>
                              <span className="min-w-0">
                                {post.reactions.filter(r => r.type === reactionType).length || ''}
                              </span>
                            </Button>
                          ))}

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleComments(post.id)}
                            className="flex items-center space-x-1 text-slate-400 hover:text-white h-7 px-2 sm:h-8 sm:px-3 text-xs sm:text-sm"
                          >
                            <MessageSquare className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                            <span className="min-w-0">{post._count.comments}</span>
                          </Button>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end space-x-2 sm:space-x-4">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-slate-400 hover:text-yellow-400 h-7 px-2 sm:h-8 sm:px-2"
                            onClick={() => setShowFlagModal(post.id)}
                          >
                            <Flag className="h-3 w-3 sm:h-4 sm:w-4" />
                          </Button>

                          <div className="text-xs sm:text-sm text-slate-500 text-right">
                            {post._count.reactions} reactions • {post._count.comments} comments
                          </div>
                        </div>
                      </div>

                      {/* Comments Section */}
                      {expandedPost === post.id && (
                        <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-slate-700/50 space-y-3 sm:space-y-4">
                          {/* Add Comment */}
                          <div className="flex items-center space-x-2">
                            <Input
                              value={newComment[post.id] || ''}
                              onChange={(e) => setNewComment(prev => ({ ...prev, [post.id]: e.target.value }))}
                              placeholder="Write a comment..."
                              className="flex-1 bg-slate-700 border-slate-600 text-white text-sm sm:text-base h-8 sm:h-10"
                              onKeyPress={(e) => {
                                if (e.key === 'Enter') {
                                  addComment(post.id);
                                }
                              }}
                            />
                            <Button
                              size="sm"
                              onClick={() => addComment(post.id)}
                              disabled={!newComment[post.id]?.trim()}
                              className="codeninja-gradient h-8 w-8 sm:h-10 sm:w-10 p-0"
                            >
                              <Send className="h-3 w-3 sm:h-4 sm:w-4" />
                            </Button>
                          </div>

                          {/* Comments List */}
                          {comments[post.id]?.map((comment) => (
                            <div key={comment.id} className="flex items-start space-x-2 sm:space-x-3">
                              <div className="h-6 w-6 sm:h-8 sm:w-8 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0">
                                <span className="text-white text-xs sm:text-sm font-medium">
                                  {comment.author.firstName[0]}{comment.author.lastName[0]}
                                </span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="bg-slate-700/50 rounded-lg p-2 sm:p-3">
                                  <div className="flex items-center space-x-1 sm:space-x-2 mb-1">
                                    <span className="text-white text-xs sm:text-sm font-medium truncate">
                                      {comment.author.firstName} {comment.author.lastName}
                                    </span>
                                    <span className="text-slate-400 text-xs flex-shrink-0">
                                      {formatTimeAgo(comment.createdAt)}
                                    </span>
                                  </div>
                                  <p className="text-slate-200 text-xs sm:text-sm leading-relaxed">{comment.content}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Flag Modal */}
      {showFlagModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-3 sm:p-4 z-50">
          <Card className="w-full max-w-md bg-slate-800 border-slate-700 mx-3 sm:mx-0">
            <CardHeader>
              <h3 className="text-white font-medium text-base sm:text-lg">Flag Post</h3>
            </CardHeader>
            <CardContent className="space-y-3 sm:space-y-4">
              <p className="text-slate-300 text-xs sm:text-sm">
                Please provide a reason for flagging this post. Our moderation team will review it.
              </p>

              <textarea
                value={flagReason}
                onChange={(e) => setFlagReason(e.target.value)}
                placeholder="Reason for flagging..."
                className="w-full bg-slate-700 border-slate-600 text-white rounded-lg p-2 sm:p-3 min-h-[80px] sm:min-h-[100px] resize-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent text-sm sm:text-base"
              />

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end space-y-2 sm:space-y-0 sm:space-x-2">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setShowFlagModal(null);
                    setFlagReason('');
                  }}
                  className="w-full sm:w-auto"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => flagPost(showFlagModal)}
                  disabled={!flagReason.trim()}
                  className="bg-yellow-600 hover:bg-yellow-700 text-white w-full sm:w-auto"
                >
                  <Flag className="h-4 w-4 mr-2" />
                  Flag Post
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
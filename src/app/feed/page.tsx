
"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUser } from "@/contexts/UserContext";
import Navigation from "@/components/Navigation";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  MessageSquare,
  Heart,
  ThumbsUp,
  Smile,
  Trophy,
  Image as ImageIcon,
  Send,
  MoreHorizontal,
  Flag,
  Trash2,
  Zap,
  LogOut
} from "lucide-react";

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
  isFlaggedByUser?: boolean;
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

export default function FeedPage() {
  const { apiCall, user: currentUser, logout, loading } = useUser();
  const router = useRouter();
  
  // All useState hooks must be at the top, before any conditional returns
  const [posts, setPosts] = useState<Post[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [newPost, setNewPost] = useState('');
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [expandedPost, setExpandedPost] = useState<string | null>(null);
  const [comments, setComments] = useState<{ [postId: string]: Comment[] }>({});
  const [newComment, setNewComment] = useState<{ [postId: string]: string }>({});
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const [showDropdown, setShowDropdown] = useState<string | null>(null);
  const [showFlagModal, setShowFlagModal] = useState<string | null>(null);
  const [flagReason, setFlagReason] = useState('');

  // All useEffect hooks must be at the top, before any conditional returns
  useEffect(() => {
    if (!loading && !currentUser) {
      router.push("/");
    }
  }, [currentUser, loading, router]);

  useEffect(() => {
    if (currentUser) {
      loadPosts();
    }
  }, [currentUser]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showDropdown) {
        setShowDropdown(null);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showDropdown]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-white text-lg">Loading...</div>
      </div>
    );
  }

  if (!currentUser) {
    return null;
  }


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

  const toggleReaction = async (postId: string, type: string) => {
    try {
      const response = await apiCall(`/api/posts/${postId}/reactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      });

      if (response.ok) {
        await loadPosts(); // Reload to get updated reactions
      }
    } catch (error) {
      console.error('Failed to toggle reaction:', error);
    }
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

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    setSelectedImages(prev => [...prev, ...imageFiles].slice(0, 4)); // Max 4 images
  };

  const removeImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
  };

  const deletePost = async (postId: string) => {
    if (!confirm('Are you sure you want to delete this post?')) return;

    try {
      const response = await apiCall(`/api/posts?id=${postId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        await loadPosts(); // Reload posts
        setShowDropdown(null);
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
        setShowDropdown(null);
        // Reload posts to update flag status
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <Navigation currentPage="feed" />

      {/* Page Title */}
      <div className="border-b border-slate-700/50 bg-slate-900/30">
        <div className="container mx-auto px-4 py-6">
          <h1 className="text-2xl font-bold text-white flex items-center space-x-2">
            <MessageSquare className="h-8 w-8 text-blue-400" />
            <span>Community Feed</span>
          </h1>
          <p className="text-slate-400 mt-1">Share updates, photos, and connect with your team</p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="space-y-6">
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
                    id="image-upload"
                  />
                  <label htmlFor="image-upload">
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
                  disabled={!newPost.trim() && selectedImages.length === 0}
                  className="codeninja-gradient"
                >
                  <Send className="h-4 w-4 mr-2" />
                  Post
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

          {/* Posts Feed */}
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
            posts.map((post) => (
              <Card key={post.id} className="bg-slate-800/50 border-slate-700">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="h-10 w-10 rounded-full bg-gradient-to-r from-blue-500 to-green-500 flex items-center justify-center">
                        <span className="text-white font-medium">
                          {post.author.firstName[0]}{post.author.lastName[0]}
                        </span>
                      </div>
                      <div>
                        <h4 className="text-white font-medium">
                          {post.author.firstName} {post.author.lastName}
                        </h4>
                        <p className="text-slate-400 text-sm">{formatTimeAgo(post.createdAt)}</p>
                      </div>
                    </div>
                    
                    {currentUser && (currentUser.email === post.author.email || currentUser.role === 'ADMIN') ? (
                      <div className="relative">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowDropdown(showDropdown === post.id ? null : post.id)}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                        
                        {showDropdown === post.id && (
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
                
                <CardContent className="space-y-4">
                  {post.content && (
                    <p className="text-slate-200 whitespace-pre-wrap">{post.content}</p>
                  )}
                  
                  {/* Post Images */}
                  {post.mediaUrls.length > 0 && (
                    <div className={`grid gap-2 ${
                      post.mediaUrls.length === 1 ? 'grid-cols-1' :
                      post.mediaUrls.length === 2 ? 'grid-cols-2' :
                      'grid-cols-2'
                    }`}>
                      {post.mediaUrls.map((url, index) => (
                        <img
                          key={index}
                          src={url}
                          alt={`Post image ${index + 1}`}
                          className="w-full h-48 object-cover rounded-lg"
                        />
                      ))}
                    </div>
                  )}
                  
                  {/* Reactions and Comments Bar */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-700">
                    <div className="flex items-center space-x-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleReaction(post.id, 'like')}
                        className={`flex items-center space-x-2 ${
                          post.userReaction?.type === 'like' ? 'text-blue-400' : 'text-slate-400'
                        }`}
                      >
                        <ThumbsUp className="h-4 w-4" />
                        <span>{post._count.reactions}</span>
                      </Button>
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleComments(post.id)}
                        className="flex items-center space-x-2 text-slate-400 hover:text-white"
                      >
                        <MessageSquare className="h-4 w-4" />
                        <span>{post._count.comments}</span>
                      </Button>
                    </div>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      className={`${
                        post.isFlaggedByUser === true
                          ? 'text-red-400 hover:text-red-300'
                          : 'text-slate-400 hover:text-yellow-400'
                      }`}
                      onClick={() => setShowFlagModal(post.id)}
                    >
                      <Flag className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  {/* Comments Section */}
                  {expandedPost === post.id && (
                    <div className="space-y-3 pt-4 border-t border-slate-700">
                      {/* Add Comment */}
                      <div className="flex items-center space-x-2">
                        <Input
                          value={newComment[post.id] || ''}
                          onChange={(e) => setNewComment(prev => ({ ...prev, [post.id]: e.target.value }))}
                          placeholder="Write a comment..."
                          className="bg-slate-700 border-slate-600 text-white flex-1"
                          onKeyPress={(e) => e.key === 'Enter' && addComment(post.id)}
                        />
                        <Button
                          size="sm"
                          onClick={() => addComment(post.id)}
                          disabled={!newComment[post.id]?.trim()}
                          className="codeninja-gradient"
                        >
                          <Send className="h-4 w-4" />
                        </Button>
                      </div>
                      
                      {/* Comments List */}
                      {comments[post.id]?.map((comment) => (
                        <div key={comment.id} className="flex items-start space-x-3">
                          <div className="h-8 w-8 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0">
                            <span className="text-white text-xs font-medium">
                              {comment.author.firstName[0]}{comment.author.lastName[0]}
                            </span>
                          </div>
                          <div className="flex-1">
                            <div className="bg-slate-700/50 rounded-lg p-3">
                              <div className="flex items-center space-x-2 mb-1">
                                <span className="text-white text-sm font-medium">
                                  {comment.author.firstName} {comment.author.lastName}
                                </span>
                                <span className="text-slate-400 text-xs">
                                  {formatTimeAgo(comment.createdAt)}
                                </span>
                              </div>
                              <p className="text-slate-200 text-sm">{comment.content}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* Flag Modal */}
      {showFlagModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-white text-lg font-medium mb-4">Flag Post</h3>
            <p className="text-slate-400 text-sm mb-4">
              Please provide a reason for flagging this post. Our moderation team will review it.
            </p>
            <textarea
              value={flagReason}
              onChange={(e) => setFlagReason(e.target.value)}
              placeholder="Reason for flagging (e.g., inappropriate content, spam, harassment)..."
              className="w-full bg-slate-700 border-slate-600 text-white rounded-lg p-3 min-h-[100px] resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <div className="flex items-center justify-end space-x-3 mt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setShowFlagModal(null);
                  setFlagReason('');
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={() => flagPost(showFlagModal)}
                disabled={!flagReason.trim()}
                className="bg-yellow-600 hover:bg-yellow-700"
              >
                <Flag className="h-4 w-4 mr-2" />
                Flag Post
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
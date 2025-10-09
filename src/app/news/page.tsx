"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Megaphone, 
  Heart, 
  ThumbsUp, 
  Smile, 
  Trophy,
  Pin,
  Calendar,
  User
} from "lucide-react";

interface NewsItem {
  id: string;
  title: string;
  body: string;
  isPinned: boolean;
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

export default function NewsPage() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadNews();
  }, []);

  const loadNews = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/news');
      if (response.ok) {
        const data = await response.json();
        setNews(data);
      }
    } catch (error) {
      console.error('Failed to load news:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleReaction = async (newsId: string, type: string) => {
    try {
      const response = await fetch(`/api/news/${newsId}/reactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      });

      if (response.ok) {
        await loadNews(); // Reload to get updated reactions
      }
    } catch (error) {
      console.error('Failed to toggle reaction:', error);
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

  // Separate pinned and regular news
  const pinnedNews = news.filter(item => item.isPinned);
  const regularNews = news.filter(item => !item.isPinned);

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <div className="border-b border-slate-700/50 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center space-x-2">
            <Megaphone className="h-6 w-6 sm:h-8 sm:w-8 text-orange-400" />
            <span>News & Announcements</span>
          </h1>
          <p className="text-sm sm:text-base text-slate-400">Stay updated with the latest CodeNinja Hub news</p>
        </div>
      </div>

      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 max-w-4xl">
        <div className="space-y-6">
          {loading ? (
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
            <>
              {/* Pinned News */}
              {pinnedNews.length > 0 && (
                <div className="space-y-3 sm:space-y-4">
                  <div className="flex items-center space-x-2">
                    <Pin className="h-4 w-4 sm:h-5 sm:w-5 text-orange-400" />
                    <h2 className="text-base sm:text-lg font-semibold text-white">Pinned Announcements</h2>
                  </div>
                  
                  {pinnedNews.map((item) => (
                    <Card key={item.id} className="bg-gradient-to-r from-orange-500/10 to-red-500/10 border-orange-500/30">
                      <CardHeader className="pb-3 sm:pb-6">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1">
                            <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-gradient-to-r from-orange-500 to-red-500 flex items-center justify-center flex-shrink-0">
                              <Pin className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
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
                        </div>
                      </CardHeader>
                      
                      <CardContent className="space-y-3 sm:space-y-4 pt-0">
                        <div className="prose prose-invert max-w-none">
                          <p className="text-slate-200 whitespace-pre-wrap leading-relaxed text-sm sm:text-base">
                            {item.body}
                          </p>
                        </div>
                        
                        {/* Reactions */}
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pt-3 sm:pt-4 border-t border-slate-700/50 gap-2 sm:gap-0">
                          <div className="flex items-center space-x-1 sm:space-x-4 flex-wrap">
                            {['like', 'love', 'celebrate'].map((reactionType) => (
                              <Button
                                key={reactionType}
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleReaction(item.id, reactionType)}
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

              {/* Regular News */}
              {regularNews.length > 0 && (
                <div className="space-y-3 sm:space-y-4">
                  {pinnedNews.length > 0 && (
                    <div className="flex items-center space-x-2 mt-6 sm:mt-8">
                      <Megaphone className="h-4 w-4 sm:h-5 sm:w-5 text-blue-400" />
                      <h2 className="text-base sm:text-lg font-semibold text-white">Recent Announcements</h2>
                    </div>
                  )}
                  
                  {regularNews.map((item) => (
                    <Card key={item.id} className="bg-slate-800/50 border-slate-700">
                      <CardHeader className="pb-3 sm:pb-6">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1">
                            <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-gradient-to-r from-blue-500 to-green-500 flex items-center justify-center flex-shrink-0">
                              <Megaphone className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
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
                        </div>
                      </CardHeader>
                      
                      <CardContent className="space-y-3 sm:space-y-4 pt-0">
                        <div className="prose prose-invert max-w-none">
                          <p className="text-slate-200 whitespace-pre-wrap leading-relaxed text-sm sm:text-base">
                            {item.body}
                          </p>
                        </div>
                        
                        {/* Reactions */}
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pt-3 sm:pt-4 border-t border-slate-700/50 gap-2 sm:gap-0">
                          <div className="flex items-center space-x-1 sm:space-x-4 flex-wrap">
                            {['like', 'love', 'celebrate'].map((reactionType) => (
                              <Button
                                key={reactionType}
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleReaction(item.id, reactionType)}
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}
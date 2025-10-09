"use client";

import { Button } from "@/components/ui/button";
import { LogOut, User, Menu, X, Calendar, Trophy, Newspaper, Shield, Users } from "lucide-react";
import Link from "next/link";
import { useUser } from "@/contexts/UserContext";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Image from "next/image";

interface NavigationProps {
  currentPage?: 'feed' | 'news-feed' | 'leaderboard' | 'events' | 'admin' | 'profile' | 'players';
}

export default function Navigation({ currentPage }: NavigationProps) {
  const { user: currentUser, logout, loading } = useUser();
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!loading && !currentUser) {
      router.push("/");
    }
  }, [currentUser, loading, router]);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-white text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <header className="sticky top-0 z-40 border-b border-slate-700/50 bg-slate-900/50 backdrop-blur-sm">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Logo and Title */}
          <Link href="/" className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-lg overflow-hidden">
              <Image
                src="/logo.jpg"
                alt="CodeNinja Logo"
                width={40}
                height={40}
                className="object-cover"
              />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-xl font-bold text-white">CodeNinja Hub ❤</h1>
              <p className="text-sm text-slate-400">
                {currentPage === 'feed' && 'News & Community'}
                {currentPage === 'news-feed' && 'News & Community'}
                {currentPage === 'leaderboard' && 'Leaderboard'}
                {currentPage === 'events' && 'Events & Competitions'}
                {currentPage === 'profile' && 'My Profile'}
                {currentPage === 'players' && 'Players Directory'}
                {!currentPage && 'Sports Hub'}
              </p>
            </div>
            <div className="sm:hidden">
              <h1 className="text-lg font-bold text-white">CodeNinja</h1>
            </div>
          </Link>
          
          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center space-x-6">
            <Link
              href="/events"
              className={`flex items-center space-x-2 ${currentPage === 'events' ? 'text-white font-medium' : 'text-slate-300 hover:text-white transition-colors'}`}
            >
              <Calendar className={`h-4 w-4 ${currentPage === 'events' ? 'text-blue-500' : 'text-slate-300'}`} />
              <span>Events</span>
            </Link>
            <Link
              href="/players"
              className={`flex items-center space-x-2 ${currentPage === 'players' ? 'text-white font-medium' : 'text-slate-300 hover:text-white transition-colors'}`}
            >
              <Users className={`h-4 w-4 ${currentPage === 'players' ? 'text-blue-500' : 'text-slate-300'}`} />
              <span>Players</span>
            </Link>
            <Link
              href="/leaderboard"
              className={`flex items-center space-x-2 ${currentPage === 'leaderboard' ? 'text-white font-medium' : 'text-slate-300 hover:text-white transition-colors'}`}
            >
              <Trophy className={`h-4 w-4 ${currentPage === 'leaderboard' ? 'text-blue-500' : 'text-slate-300'}`} />
              <span>Leaderboard</span>
            </Link>
            <Link
              href="/news-feed"
              className={`flex items-center space-x-2 ${currentPage === 'feed' || currentPage === 'news-feed' ? 'text-white font-medium' : 'text-slate-300 hover:text-white transition-colors'}`}
            >
              <Newspaper className={`h-4 w-4 ${currentPage === 'feed' || currentPage === 'news-feed' ? 'text-blue-500' : 'text-slate-300'}`} />
              <span>News & Feed</span>
            </Link>
            {currentUser && (
              <div className="flex items-center space-x-4">
                <Link
                  href="/profile"
                  className={`flex items-center justify-center w-8 h-8 rounded-full transition-all ${
                    currentPage === 'profile'
                      ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-slate-900'
                      : 'hover:ring-2 hover:ring-slate-400 hover:ring-offset-2 hover:ring-offset-slate-900'
                  }`}
                  title={`${currentUser.firstName} ${currentUser.lastName} - View Profile`}
                >
                  {currentUser.avatarUrl ? (
                    <Image
                      src={currentUser.avatarUrl}
                      alt={`${currentUser.firstName} ${currentUser.lastName}`}
                      width={32}
                      height={32}
                      className="w-8 h-8 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center">
                      <User className="h-4 w-4 text-slate-300" />
                    </div>
                  )}
                </Link>
                <span className="text-slate-300 hidden xl:inline">
                  Welcome, {currentUser.firstName}
                </span>
                {(currentUser.role === 'ADMIN' || currentUser.role === 'MODERATOR') && (
                  <Button variant="outline" size="sm" asChild className="flex items-center space-x-2">
                    <Link href="/admin">
                      <Shield className={`h-4 w-4 ${(currentPage === 'admin') ? 'text-red-500' : 'text-slate-300'}`} />
                      <span>{currentUser.role === 'ADMIN' ? 'Admin' : 'Moderator'}</span>
                    </Link>
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={logout} className="flex items-center space-x-2">
                  <LogOut className="h-4 w-4" />
                  <span className="hidden sm:inline">Sign Out</span>
                </Button>
              </div>
            )}
          </nav>

          {/* Mobile Navigation Icons */}
          <div className="lg:hidden flex items-center space-x-1">
            {/* Main navigation icons */}
            <Link
              href="/events"
              className={`flex items-center justify-center w-9 h-9 rounded-lg transition-all ${
                currentPage === 'events'
                  ? ''
                  : 'hover:bg-slate-800'
              }`}
              title="Events"
            >
              <Calendar className={`h-4 w-4 ${currentPage === 'events' ? 'text-blue-500' : 'text-slate-300'}`} />
            </Link>
            <Link
              href="/players"
              className={`flex items-center justify-center w-9 h-9 rounded-lg transition-all ${
                currentPage === 'players'
                  ? ''
                  : 'hover:bg-slate-800'
              }`}
              title="Players"
            >
              <Users className={`h-4 w-4 ${currentPage === 'players' ? 'text-blue-500' : 'text-slate-300'}`} />
            </Link>
            <Link
              href="/leaderboard"
              className={`flex items-center justify-center w-9 h-9 rounded-lg transition-all ${
                currentPage === 'leaderboard'
                  ? ''
                  : 'hover:bg-slate-800'
              }`}
              title="Leaderboard"
            >
              <Trophy className={`h-4 w-4 ${currentPage === 'leaderboard' ? 'text-blue-500' : 'text-slate-300'}`} />
            </Link>
            
            {/* Admin Panel Icon - Show for admin and moderator users */}
            {currentUser && (currentUser.role === 'ADMIN' || currentUser.role === 'MODERATOR') && (
              <Link
                href="/admin"
                className={`flex items-center justify-center w-9 h-9 rounded-lg transition-all ${
                  currentPage === 'admin'
                    ? ''
                    : 'hover:bg-slate-800'
                }`}
                title="Admin Panel"
              >
                <Shield className={`h-4 w-4 ${currentPage === 'admin' ? 'text-red-500' : 'text-slate-300'}`} />
              </Link>
            )}
            
            {/* Profile and Menu */}
            {currentUser && (
              <Link
                href="/profile"
                className={`flex items-center justify-center w-8 h-8 rounded-full transition-all ml-2 ${
                  currentPage === 'profile'
                    ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-slate-900'
                    : 'hover:ring-2 hover:ring-slate-400 hover:ring-offset-2 hover:ring-offset-slate-900'
                }`}
                title={`${currentUser.firstName} ${currentUser.lastName} - View Profile`}
              >
                {currentUser.avatarUrl ? (
                  <Image
                    src={currentUser.avatarUrl}
                    alt={`${currentUser.firstName} ${currentUser.lastName}`}
                    width={32}
                    height={32}
                    className="w-8 h-8 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center">
                    <User className="h-4 w-4 text-slate-300" />
                  </div>
                )}
              </Link>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleMobileMenu}
              className="text-white hover:bg-slate-800 ml-1"
            >
              {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        {isMobileMenuOpen && (
          <div className="lg:hidden mt-4 pb-4 border-t border-slate-700/50">
            <nav className="flex flex-col space-y-4 mt-4">
              <Link
                href="/events"
                className={`text-left px-2 py-1 rounded transition-colors ${
                  currentPage === 'events' ? 'text-white font-medium bg-slate-800' : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
                }`}
                onClick={closeMobileMenu}
              >
                Events
              </Link>
              <Link
                href="/players"
                className={`text-left px-2 py-1 rounded transition-colors ${
                  currentPage === 'players' ? 'text-white font-medium bg-slate-800' : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
                }`}
                onClick={closeMobileMenu}
              >
                Players
              </Link>
              <Link
                href="/leaderboard"
                className={`text-left px-2 py-1 rounded transition-colors ${
                  currentPage === 'leaderboard' ? 'text-white font-medium bg-slate-800' : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
                }`}
                onClick={closeMobileMenu}
              >
                Leaderboard
              </Link>
              <Link
                href="/news-feed"
                className={`text-left px-2 py-1 rounded transition-colors ${
                  currentPage === 'feed' || currentPage === 'news-feed' ? 'text-white font-medium bg-slate-800' : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
                }`}
                onClick={closeMobileMenu}
              >
                News & Feed
              </Link>
              {currentUser && (
                <>
                  <div className="border-t border-slate-700/50 pt-4">
                    <div className="text-slate-300 text-sm mb-3">
                      Welcome, {currentUser.firstName} {currentUser.lastName}
                    </div>
                    {(currentUser.role === 'ADMIN' || currentUser.role === 'MODERATOR') && (
                      <Link
                        href="/admin"
                        className="block text-left px-2 py-1 rounded transition-colors text-slate-300 hover:text-white hover:bg-slate-800/50 mb-2"
                        onClick={closeMobileMenu}
                      >
                        {currentUser.role === 'ADMIN' ? 'Admin Panel' : 'Moderator Panel'}
                      </Link>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        logout();
                        closeMobileMenu();
                      }}
                      className="w-full justify-start"
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      Sign Out
                    </Button>
                  </div>
                </>
              )}
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
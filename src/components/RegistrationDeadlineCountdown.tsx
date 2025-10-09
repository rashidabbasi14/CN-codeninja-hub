"use client";

import { useState, useEffect } from 'react';
import { Clock, AlertTriangle } from 'lucide-react';

interface RegistrationDeadlineCountdownProps {
  deadline: string | null;
  className?: string;
}

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

export default function RegistrationDeadlineCountdown({ deadline, className = '' }: RegistrationDeadlineCountdownProps) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(null);
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    if (!deadline) return;

    const calculateTimeLeft = () => {
      const now = new Date().getTime();
      const deadlineTime = new Date(deadline).getTime();
      const difference = deadlineTime - now;

      if (difference <= 0) {
        setIsExpired(true);
        setTimeLeft(null);
        return;
      }

      const days = Math.floor(difference / (1000 * 60 * 60 * 24));
      const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((difference % (1000 * 60)) / 1000);

      setTimeLeft({ days, hours, minutes, seconds });
      setIsExpired(false);
    };

    // Calculate immediately
    calculateTimeLeft();

    // Update every second
    const timer = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(timer);
  }, [deadline]);

  if (!deadline) {
    return null;
  }

  if (isExpired) {
    return (
      <div className={`flex items-center space-x-2 text-red-400 ${className}`}>
        <AlertTriangle className="h-4 w-4" />
        <span className="text-sm font-medium">Registration Closed</span>
      </div>
    );
  }

  if (!timeLeft) {
    return null;
  }

  const formatDeadline = (deadline: string) => {
    return new Date(deadline).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const getUrgencyColor = () => {
    if (timeLeft.days === 0 && timeLeft.hours < 6) {
      return 'text-red-400';
    } else if (timeLeft.days === 0) {
      return 'text-orange-400';
    } else if (timeLeft.days < 2) {
      return 'text-yellow-400';
    }
    return 'text-green-400';
  };

  const formatTimeLeft = () => {
    if (timeLeft.days > 0) {
      return `${timeLeft.days}d ${timeLeft.hours}h ${timeLeft.minutes}m`;
    } else if (timeLeft.hours > 0) {
      return `${timeLeft.hours}h ${timeLeft.minutes}m ${timeLeft.seconds}s`;
    } else {
      return `${timeLeft.minutes}m ${timeLeft.seconds}s`;
    }
  };

  return (
    <div className={`${className}`}>
      <div className="flex items-center space-x-2">
        <Clock className={`h-4 w-4 ${getUrgencyColor()}`} />
        <div className="flex flex-col">
          <span className={`text-sm font-medium ${getUrgencyColor()}`}>
            {formatTimeLeft()} left
          </span>
          <span className="text-xs text-slate-400">
            Deadline: {formatDeadline(deadline)}
          </span>
        </div>
      </div>
    </div>
  );
}
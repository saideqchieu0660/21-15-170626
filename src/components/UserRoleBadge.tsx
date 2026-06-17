import React from 'react';
import { Shield, Heart, Activity } from 'lucide-react';
import { cn } from '../lib/utils';

export const UserRoleBadge = React.memo(({ role, isSchoolLover, isPro, className }: { role: string; isSchoolLover?: boolean; isPro?: boolean; className?: string }) => {
  if (role === "Admin" || role === "admin" || role === "teacher") {
    return (
      <span className={cn("text-xs font-bold px-3 py-1 rounded-full bg-rose-500/10 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 flex items-center gap-1.5 shadow-sm", className)}>
        <Shield className="w-3.5 h-3.5 text-rose-500" /> Admin
      </span>
    );
  }
  if (isSchoolLover && isPro) {
    return (
      <span className={cn("text-xs font-bold px-3 py-1 rounded-full bg-pink-500/10 dark:bg-pink-500/20 text-pink-600 dark:text-pink-400 border border-pink-500/30 flex items-center gap-1.5 shadow-sm", className)}>
        <Heart className="w-3.5 h-3.5 text-pink-500 fill-pink-500 animate-pulse" /> VIP
      </span>
    );
  }
  return null;
});

UserRoleBadge.displayName = "UserRoleBadge";

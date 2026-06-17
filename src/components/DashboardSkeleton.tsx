import React from "react";

export function DashboardSkeleton() {
  return (
    <div className="space-y-8 animate-in fade-in pb-12 w-full max-w-7xl mx-auto px-4 md:px-8 mt-8">
      {/* Header Skeleton */}
      <div className="bg-zinc-200/50 dark:bg-zinc-800/50 rounded-2xl p-8 relative overflow-hidden animate-pulse">
        <div className="h-10 bg-zinc-300/50 dark:bg-zinc-700/50 rounded w-1/3 mb-4"></div>
        <div className="h-6 bg-zinc-300/50 dark:bg-zinc-700/50 rounded w-2/3 mb-8"></div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="h-10 w-48 bg-zinc-300/50 dark:bg-zinc-700/50 rounded-lg"></div>
          <div className="h-10 w-40 bg-zinc-300/50 dark:bg-zinc-700/50 rounded-lg"></div>
          <div className="h-10 w-40 bg-zinc-300/50 dark:bg-zinc-700/50 rounded-lg"></div>
        </div>
      </div>

      {/* Tabs Skeleton */}
      <div className="flex gap-4 mb-6 border-b border-zinc-300/20 dark:border-zinc-700/30 pb-4">
        <div className="h-10 w-32 bg-zinc-200/50 dark:bg-zinc-800/50 rounded-lg animate-pulse"></div>
        <div className="h-10 w-32 bg-zinc-200/50 dark:bg-zinc-800/50 rounded-lg animate-pulse"></div>
        <div className="h-10 w-48 bg-zinc-200/50 dark:bg-zinc-800/50 rounded-lg animate-pulse"></div>
      </div>

      {/* Content Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
           <div className="h-[200px] bg-zinc-200/50 dark:bg-zinc-800/50 rounded-2xl animate-pulse"></div>
           <div className="h-[300px] bg-zinc-200/50 dark:bg-zinc-800/50 rounded-2xl animate-pulse"></div>
        </div>
        <div className="space-y-6">
           <div className="h-[400px] bg-zinc-200/50 dark:bg-zinc-800/50 rounded-2xl animate-pulse"></div>
        </div>
      </div>
    </div>
  );
}

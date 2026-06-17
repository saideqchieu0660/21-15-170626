import React from "react";
import { motion } from "motion/react";
import { Crown, Flame, ChevronUp, ChevronDown, Sparkles, Trophy, Award, Shield, BrainCircuit } from "lucide-react";
import { cn } from "../lib/utils";
import { User } from "../lib/store";
import { getLevelInfo, getCustomTitleBadgeClass } from "../utils/xp";
import { UserRoleBadge } from "./UserRoleBadge";

interface TopPerformersWidgetProps {
  users: User[];
  currentUserId?: string;
  rankTrends?: Record<string, 'up' | 'down' | 'same'>;
  onUserClick?: (user: User) => void;
}

export const getTier = (points: number) => {
    if (points >= 100) return { name: "Grandmaster", color: "text-purple-500 bg-purple-500/10 border-purple-500/30", gradient: "from-purple-500 to-fuchsia-600", icon: <Crown className="w-3 h-3" /> };
    if (points >= 50) return { name: "Diamond", color: "text-cyan-500 bg-cyan-500/10 border-cyan-500/30", gradient: "from-cyan-400 to-blue-500", icon: <Sparkles className="w-3 h-3" /> };
    if (points >= 20) return { name: "Gold", color: "text-orange-500 bg-orange-500/10 border-orange-500/30", gradient: "from-orange-400 to-orange-600", icon: <Trophy className="w-3 h-3" /> };
    if (points >= 10) return { name: "Silver", color: "text-gray-400 bg-gray-400/10 border-gray-400/30", gradient: "from-gray-300 to-gray-500", icon: <Award className="w-3 h-3" /> };
    return { name: "Bronze", color: "text-orange-500 bg-orange-500/10 border-orange-500/30", gradient: "from-orange-400 to-red-500", icon: <Shield className="w-3 h-3" /> };
};

interface LeaderboardRowProps {
  user: User;
  index: number;
  currentUserId?: string;
  trend: 'up' | 'down' | 'same';
  onUserClick?: (user: User) => void;
}

const LeaderboardRow = React.memo<LeaderboardRowProps>(({ user, index, currentUserId, trend, onUserClick }) => {
  const tier = getTier(user.points || 0);
  const isFirst = index === 0;
  const isSecond = index === 1;
  const isThird = index === 2;
  const isTop3 = index < 3;

  let bgClass = "bg-white/40 dark:bg-black/40 border-zinc-200 dark:border-zinc-800";
  let ringClass = user.id === currentUserId ? "ring-2 ring-orange-500 ring-offset-2 ring-offset-white dark:ring-offset-black" : "";
  let shadowClass = "";
  let rankIcon = null;
  let rankBadgeBg = "bg-zinc-200/60 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300";

  if (isFirst) {
    bgClass = "bg-gradient-to-r from-orange-500/10 to-orange-500/15 border-orange-500/40 shadow-[0_0_20px_-5px_rgba(234,179,8,0.15)]";
    shadowClass = "shadow-[0_0_15px_-3px_rgba(234,179,8,0.3)]";
    rankIcon = <Crown className="w-4 h-4 text-orange-500 animate-pulse shrink-0" />;
    rankBadgeBg = "bg-gradient-to-br from-orange-300 via-orange-400 to-orange-600 text-black border shadow-orange-500/30";
  } else if (isSecond) {
    bgClass = "bg-gradient-to-r from-slate-400/10 to-gray-500/15 border-slate-400/30";
    rankIcon = <Trophy className="w-4 h-4 text-slate-400 shrink-0" />;
    rankBadgeBg = "bg-gradient-to-br from-gray-100 via-gray-300 to-gray-500 text-black border shadow-gray-400/30";
  } else if (isThird) {
    bgClass = "bg-gradient-to-r from-orange-400/10 to-orange-600/15 border-orange-400/35";
    rankIcon = <Award className="w-4 h-4 text-orange-500 shrink-0" />;
    rankBadgeBg = "bg-gradient-to-br from-orange-200 via-orange-400 to-orange-600 text-black border shadow-orange-500/30";
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ type: "spring", stiffness: 350, damping: 25, delay: index * 0.05 }}
      whileHover={{ scale: 1.02 }}
      onClick={() => onUserClick && onUserClick(user)}
      className={cn(
        "relative flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all duration-300 border backdrop-blur-xl",
        bgClass,
        ringClass,
        isTop3 ? "py-4" : "py-2.5",
        user.id === currentUserId ? "border-orange-500/50" : ""
      )}
    >
      <div className="flex items-center gap-3 overflow-hidden">
        <div className="flex items-center justify-center shrink-0 w-8 h-8 font-display font-bold rounded-full relative">
          <div className={cn(
            "w-full h-full rounded-full flex items-center justify-center text-xs font-black",
            rankBadgeBg,
            shadowClass
          )}>
            {index + 1}
          </div>
          {trend === "up" && <ChevronUp className="absolute -top-1 -right-1 w-3.5 h-3.5 text-green-500 animate-bounce" />}
          {trend === "down" && <ChevronDown className="absolute -top-1 -right-1 w-3.5 h-3.5 text-red-500" />}
        </div>

        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-2">
            {rankIcon}
            <h4 className="font-bold text-sm line-clamp-1 break-all leading-tight">
              {user.name}
            </h4>
            {user.id === currentUserId && (
              <span className="text-[9px] bg-orange-500 text-black px-1.5 py-0.5 rounded-full uppercase tracking-wider font-bold shrink-0">
                You
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
            <span className="text-[10px] font-mono font-bold bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 px-1.5 py-0.5 rounded border border-zinc-300 dark:border-zinc-700">
              Lv.{user.level || getLevelInfo(user.points || 0).currentLevel}
            </span>
            <span className={cn("text-[8px] sm:text-[9px] font-bold px-1.5 py-0.5 rounded border", getCustomTitleBadgeClass(user.title, getLevelInfo(user.points || 0).badgeColors))}>
              {user.title || getLevelInfo(user.points || 0).title}
            </span>
            <UserRoleBadge role={user.role} isSchoolLover={user.isSchoolLover} isPro={user.isPro} />
            {user.streak && (
              <div className="flex items-center gap-0.5 text-[9px] font-bold text-orange-500 bg-orange-500/10 px-1 py-0.5 rounded-full border border-orange-500/10 whitespace-nowrap">
                <Flame className="w-2.5 h-2.5" /> {user.streak}
              </div>
            )}
            <span className={cn("text-[9px] hidden sm:flex font-bold px-1.5 py-0.5 rounded items-center gap-1 border", tier.color)}>
              {tier.icon} <span>{tier.name}</span>
            </span>
          </div>
        </div>
      </div>

      <div className="text-right shrink-0 pl-2">
        <span className="text-sm font-mono font-black text-zinc-800 dark:text-zinc-200">
          {user.points || 0}
        </span>
        <span className="text-[10px] opacity-50 ml-1 font-sans">pts</span>
      </div>
    </motion.div>
  );
});

LeaderboardRow.displayName = "LeaderboardRow";

export const TopPerformersWidget: React.FC<TopPerformersWidgetProps> = ({ users, currentUserId, rankTrends = {}, onUserClick }) => {
  if (!users || users.length === 0) return null;

  return (
    <div className="glass p-6 rounded-2xl">
      <div className="flex items-center gap-2 mb-6 border-b border-orange-600/20 dark:border-orange-500/30 pb-3">
        <Trophy className="w-5 h-5 text-orange-500" />
        <h3 className="font-bold text-lg font-display text-transparent bg-clip-text bg-gradient-to-r from-orange-700 via-orange-500 to-orange-600 dark:from-orange-200 dark:via-orange-400 dark:to-orange-500">
            Top Phong Độ Tuần Nay
        </h3>
      </div>
      
      <div className="flex flex-col gap-2 pt-2">
        {users.slice(0, 10).map((u, index) => {
          const trend = rankTrends[u.id] || "same";
          return (
            <LeaderboardRow
              key={u.id}
              user={u}
              index={index}
              currentUserId={currentUserId}
              trend={trend}
              onUserClick={onUserClick}
            />
          );
        })}
      </div>
    </div>
  );
};

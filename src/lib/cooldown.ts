import { useState, useEffect } from "react";
import { User } from "./store";

const COOLDOWN_KEY = "ai_request_cooldown_timestamp";
const COOLDOWN_DURATION = 10000; // 10 seconds (10000ms)

export function getAICooldownTimeRemaining(user: User | null): number {
  if (!user || user.role !== "student" || user.isPro) return 0;
  
  if (user.argusEyesUntil && user.argusEyesUntil > Date.now()) return 0; // Bypass cooldown
  
  const lastTimeStr = localStorage.getItem(`${COOLDOWN_KEY}_${user.id}`);
  if (!lastTimeStr) return 0;
  
  const lastTime = parseInt(lastTimeStr, 10);
  const elapsed = Date.now() - lastTime;
  
  if (elapsed < COOLDOWN_DURATION) {
    return Math.ceil((COOLDOWN_DURATION - elapsed) / 1000);
  }
  return 0;
}

export function triggerAICooldown(user: User | null): void {
  if (!user || user.role !== "student" || user.isPro) return;
  if (user.argusEyesUntil && user.argusEyesUntil > Date.now()) return;
  
  const now = Date.now();
  localStorage.setItem(`${COOLDOWN_KEY}_${user.id}`, now.toString());
  
  // Dispatch a global custom event to communicate cooldown state immediately to other components
  window.dispatchEvent(new CustomEvent("ai-cooldown-trigger", { detail: { userId: user.id, timestamp: now } }));
}

export function useAICooldown(user: User | null) {
  const [cooldownRemaining, setCooldownRemaining] = useState<number>(() => getAICooldownTimeRemaining(user));

  useEffect(() => {
    if (!user || user.role !== "student" || user.isPro || (user.argusEyesUntil && user.argusEyesUntil > Date.now())) {
      setCooldownRemaining(0);
      return;
    }

    const updateRemaining = () => {
      const remaining = getAICooldownTimeRemaining(user);
      setCooldownRemaining(remaining);
    };

    const interval = setInterval(updateRemaining, 1000);

    const handleCooldownTrigger = (e: Event) => {
      const detail = (e as CustomEvent)?.detail;
      if (detail && detail.userId === user.id) {
        setCooldownRemaining(getAICooldownTimeRemaining(user));
      }
    };

    window.addEventListener("ai-cooldown-trigger", handleCooldownTrigger);
    
    // Listen to storage events (cross-tab coordination)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === `${COOLDOWN_KEY}_${user.id}`) {
        setCooldownRemaining(getAICooldownTimeRemaining(user));
      }
    };
    window.addEventListener("storage", handleStorageChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener("ai-cooldown-trigger", handleCooldownTrigger);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [user?.id, user?.role]);

  const startCooldown = () => {
    triggerAICooldown(user);
  };

  return {
    cooldownRemaining,
    startCooldown
  };
}

import React, { createContext, useContext, useEffect, useState } from "react";
import { getIsMuted, setMutedStatus, initAudio } from "../lib/audio";

interface SoundContextType {
  isSoundEnabled: boolean;
  toggleSound: () => void;
}

const SoundContext = createContext<SoundContextType | undefined>(undefined);

export function SoundProvider({ children }: { children: React.ReactNode }) {
  const [isSoundEnabled, setIsSoundEnabled] = useState<boolean>(!getIsMuted());

  useEffect(() => {
    // Initial sync
    setIsSoundEnabled(!getIsMuted());
  }, []);

  const toggleSound = () => {
    initAudio(); // Try to resume context if not already
    const newVal = !isSoundEnabled;
    setIsSoundEnabled(newVal);
    setMutedStatus(!newVal);
  };

  return (
    <SoundContext.Provider value={{ isSoundEnabled, toggleSound }}>
      {children}
    </SoundContext.Provider>
  );
}

export const useSoundContext = () => {
  const context = useContext(SoundContext);
  if (!context) throw new Error("useSoundContext must be used within SoundProvider");
  return context;
};

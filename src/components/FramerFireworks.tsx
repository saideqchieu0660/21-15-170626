import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";

const colors = ["#ff0000", "#00ff00", "#0000ff", "#ffff00", "#ff00ff", "#00ffff", "#ffbaba", "#a3f7bf"];

export const FramerFireworks = ({ active, onComplete }: { active: boolean; onComplete: () => void }) => {
  const [particles, setParticles] = useState<any[]>([]);

  useEffect(() => {
    if (active) {
      // Create bursts of particles
      const newParticles = Array.from({ length: 60 }).map((_, i) => ({
        id: i,
        x: (Math.random() - 0.5) * window.innerWidth * 1.2,
        y: (Math.random() - 0.5) * window.innerHeight * 1.2,
        color: colors[Math.floor(Math.random() * colors.length)],
        scale: Math.random() * 2 + 0.5,
        rotation: Math.random() * 360,
        delay: Math.random() * 0.2
      }));
      setParticles(newParticles);
      
      const timer = setTimeout(() => {
        setParticles([]);
        onComplete();
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [active, onComplete]);

  if (!active) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[150] flex items-center justify-center overflow-hidden">
      <AnimatePresence>
        {particles.map((p) => (
          <motion.div
            key={p.id}
            initial={{ opacity: 1, scale: 0, x: 0, y: 0 }}
            animate={{ 
              opacity: [1, 1, 0], 
              scale: [0, p.scale, p.scale * 1.5], 
              x: p.x, 
              y: p.y,
              rotate: [0, p.rotation, p.rotation + 180]
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.5 + Math.random(), delay: p.delay, ease: "easeOut" }}
            className="absolute rounded-full"
            style={{ 
              backgroundColor: p.color, 
              width: `${Math.random() > 0.5 ? 6 : 8}px`,
              height: `${Math.random() > 0.5 ? 6 : 8}px`,
              boxShadow: `0 0 10px ${p.color}, 0 0 20px ${p.color}, 0 0 40px ${p.color}` 
            }}
          />
        ))}
      </AnimatePresence>
    </div>
  );
};

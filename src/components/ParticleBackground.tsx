import React, { useMemo } from 'react';
import { useTheme } from './ThemeProvider';

export const ParticleBackground = () => {
  const { isFixLagEnabled } = useTheme();

  const numStars = isFixLagEnabled ? 12 : 40;

  const stars = useMemo(() => {
    return Array.from({ length: 40 }).map((_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 100}%`,
      size: `${Math.random() * 3 + 1}px`,
      delay: `${Math.random() * 5}s`,
      duration: `${Math.random() * 4 + 3}s` // 3s to 7s
    }));
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden opacity-60">
      {stars.slice(0, numStars).map((star) => (
        <div
          key={star.id}
          className="absolute rounded-full bg-orange-600 dark:bg-orange-500 will-change-transform"
          style={{
            left: star.left,
            top: star.top,
            width: star.size,
            height: star.size,
            animation: isFixLagEnabled ? 'none' : `sparklePulse ${star.duration} infinite ease-in-out`,
            animationDelay: star.delay,
            transform: 'translateZ(0)',
            opacity: isFixLagEnabled ? 0.3 : 1
          }}
        />
      ))}
    </div>
  );
};

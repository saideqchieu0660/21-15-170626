import { useEffect, useState } from 'react';
import { motion, useMotionValue, useSpring } from 'motion/react';
import { useTheme } from './ThemeProvider';

export const CustomCursor = () => {
  const { isFixLagEnabled } = useTheme();
  const [isHovering, setIsHovering] = useState(false);
  const cursorX = useMotionValue(-100);
  const cursorY = useMotionValue(-100);
  
  const springConfig = { damping: 25, stiffness: 400, mass: 0.2 };
  const cursorXSpring = useSpring(cursorX, springConfig);
  const cursorYSpring = useSpring(cursorY, springConfig);

  useEffect(() => {
    if (isFixLagEnabled) return;

    const moveCursor = (e: MouseEvent) => {
      cursorX.set(e.clientX - 16);
      cursorY.set(e.clientY - 16);
    };

    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target) return;
      
      const isInteractive = 
        target.tagName.toLowerCase() === 'button' ||
        target.tagName.toLowerCase() === 'a' ||
        target.closest('button') ||
        target.closest('a') ||
        target.closest('.card-3d') ||
        target.closest('.btn-3d') ||
        target.closest('.perspective-1000');
        
      setIsHovering(!!isInteractive);
    };

    window.addEventListener('mousemove', moveCursor);
    window.addEventListener('mouseover', handleMouseOver);

    return () => {
      window.removeEventListener('mousemove', moveCursor);
      window.removeEventListener('mouseover', handleMouseOver);
    };
  }, [cursorX, cursorY, isFixLagEnabled]);

  if (isFixLagEnabled) {
    return null;
  }

  return (
    <motion.div
      className="fixed top-0 left-0 w-8 h-8 rounded-full pointer-events-none z-[9999] hidden md:flex items-center justify-center transition-shadow duration-300"
      style={{
        x: cursorXSpring,
        y: cursorYSpring,
      }}
      animate={{
        scale: isHovering ? 1.8 : 1,
        backgroundColor: isHovering ? 'rgba(245, 158, 11, 0.15)' : 'rgba(245, 158, 11, 0.05)',
        borderColor: isHovering ? 'rgba(245, 158, 11, 0.8)' : 'rgba(245, 158, 11, 0.4)',
        borderWidth: isHovering ? '2px' : '1px',
        borderStyle: 'solid',
        boxShadow: isHovering ? '0 0 20px rgba(245, 158, 11, 0.6), inset 0 0 10px rgba(245, 158, 11, 0.3)' : '0 0 10px rgba(245, 158, 11, 0.2)',
      }}
      transition={{ duration: 0.15 }}
    >
      <motion.div
        className="w-1.5 h-1.5 bg-orange-500 rounded-full"
        animate={{
          scale: isHovering ? 0 : 1,
          opacity: isHovering ? 0 : 1
        }}
        transition={{ duration: 0.15 }}
      />
    </motion.div>
  );
};

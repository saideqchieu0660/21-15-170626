import React from "react";
import { motion } from "motion/react";

interface CinematicContainerProps {
  children: React.ReactNode;
  className?: string;
  staggerDelay?: number;
  speed?: number; // 1 = default, higher is faster
}

export function CinematicContainer({
  children,
  className = "",
  staggerDelay = 0.08,
  speed = 1
}: CinematicContainerProps) {
  // Cinematic staggering options
  const containerVariants = {
    hidden: { 
      opacity: 0 
    },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: staggerDelay / speed,
        delayChildren: 0.05
      }
    }
  };

  const itemVariants = {
    hidden: { 
      opacity: 0,
      y: 24,
      filter: "blur(6px)",
      scale: 0.98
    },
    visible: {
      opacity: 1,
      y: 0,
      filter: "blur(0px)",
      scale: 1,
      transition: {
        type: "spring" as const,
        damping: 22,
        stiffness: 100,
        mass: 0.8
      }
    }
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-40px" }}
      className={className}
    >
      {React.Children.map(children, (child, idx) => {
        if (!child) return null;
        
        return (
          <motion.div 
            key={idx} 
            variants={itemVariants}
            className="w-full h-full flex justify-center"
          >
            {child}
          </motion.div>
        );
      })}
    </motion.div>
  );
}

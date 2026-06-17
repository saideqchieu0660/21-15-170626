import React, { useState, useRef } from "react";
import { motion, useMotionValue, useTransform } from "motion/react";

interface CyberCardProps {
  title: string;
  subtitle?: string;
  category?: string;
  description?: string;
  extraDetails?: string;
  badge?: string;
  isFlippedInitially?: boolean;
  onActionClick?: () => void;
  actionText?: string;
}

export function CyberCard({
  title,
  subtitle,
  category = "SYS.UNIT_01",
  description,
  extraDetails,
  badge,
  onActionClick,
  actionText = "EXECUTE"
}: CyberCardProps) {
  const [isFlipped, setIsFlipped] = useState(false);
  const [isPressed, setIsPressed] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // Motion values for smooth 3D tilt
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  // Transform hover coordinates into degrees of rotation
  const rotateX = useTransform(y, [-150, 150], [15, -15]);
  const rotateY = useTransform(x, [-150, 150], [-15, 15]);

  // Transform for fine lighting sheen / shadow offsets
  const shadowX = useTransform(x, [-150, 150], [10, -10]);
  const shadowY = useTransform(y, [-150, 150], [10, -10]);

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    
    // Relative position from center of the card
    const relativeX = e.clientX - rect.left - width / 2;
    const relativeY = e.clientY - rect.top - height / 2;

    x.set(relativeX);
    y.set(relativeY);
  };

  const handlePointerLeave = () => {
    // Gracefully spring back to center
    x.set(0);
    y.set(0);
    setIsPressed(false);
  };

  return (
    <div className="perspective-1000 w-full max-w-sm h-[400px] cursor-pointer">
      <motion.div
        ref={cardRef}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        onPointerDown={() => setIsPressed(true)}
        onPointerUp={() => setIsPressed(false)}
        onClick={() => setIsFlipped(!isFlipped)}
        style={{
          rotateX: isFlipped ? 0 : rotateX,
          rotateY: isFlipped ? 180 : rotateY,
          transformStyle: "preserve-3d",
        }}
        animate={{
          scale: isPressed ? 0.96 : 1.0,
          z: isPressed ? -20 : 0,
        }}
        transition={{
          type: "spring",
          stiffness: 300,
          damping: 20
        }}
        className="relative w-full h-full transition-shadow duration-300 transform-style-3d select-none"
      >
        {/* FRONT FACE */}
        <div 
          className="absolute inset-0 w-full h-full p-6 flex flex-col justify-between backface-hidden clip-cyber-corner border-[0.5px] border-zinc-300 dark:border-zinc-800 bg-white/95 dark:bg-black/95 text-zinc-900 dark:text-zinc-100 shadow-md hover:border-orange-500/50 dark:hover:border-orange-500/50 hover:cyber-glow transition-colors duration-300"
          style={{
            backfaceVisibility: "hidden",
          }}
        >
          {/* Cyberpunk grid bg lines & details */}
          <div className="absolute inset-0 bg-[linear-gradient(rgba(245,158,11,0.02)_1px,transparent_1px)] bg-[size:100%_16px] pointer-events-none opacity-40 rounded-xl" />
          <div className="absolute top-0 left-0 w-12 h-1 border-t-2 border-l-2 border-orange-500" />
          <div className="absolute bottom-0 right-0 w-12 h-1 border-b-2 border-r-2 border-orange-500" />

          {/* Top mechanical header */}
          <div className="flex justify-between items-center z-10">
            <span className="font-mono text-[10px] tracking-widest text-zinc-400 dark:text-zinc-500 font-bold">
              {category} // ACC_INIT
            </span>
            {badge && (
              <span className="font-cyber text-[9px] font-bold px-2 py-0.5 border border-orange-500 text-orange-500 rounded bg-orange-500/5 uppercase tracking-wider">
                {badge}
              </span>
            )}
          </div>

          {/* Main content body */}
          <div className="flex-1 flex flex-col justify-center py-4 z-10">
            {subtitle && (
              <p className="font-cyber text-xs uppercase tracking-widest text-orange-500 font-medium mb-1.5">
                {subtitle}
              </p>
            )}
            <h3 className="font-sans text-3xl font-semibold leading-tight tracking-tight text-zinc-950 dark:text-white group-hover:text-orange-500 transition-colors">
              {title}
            </h3>
            {description && (
              <p className="mt-4 font-sans text-zinc-600 dark:text-zinc-400 text-sm leading-relaxed line-clamp-4 italic border-l-2 border-zinc-300 dark:border-zinc-800 pl-3">
                "{description}"
              </p>
            )}
          </div>

          {/* Footer controls & cyber details */}
          <div className="flex justify-between items-end border-t border-zinc-150 dark:border-zinc-900 pt-4 z-10">
            <div className="font-mono text-[10px] text-zinc-400 dark:text-zinc-500">
              <span className="text-orange-500 font-bold">[!]</span> CLICK_TO_DECRYPT
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
              <span className="font-mono text-[9px] font-bold text-orange-500/80 tracking-widest">
                ACTIVE_SYS
              </span>
            </div>
          </div>
        </div>

        {/* BACK FACE */}
        <div 
          className="absolute inset-0 w-full h-full p-6 flex flex-col justify-between backface-hidden clip-cyber-corner border-[0.5px] border-orange-500/40 bg-zinc-50/98 dark:bg-zinc-950/98 text-zinc-900 dark:text-zinc-100 cyber-inset-glow rotate-y-180"
          style={{
            backfaceVisibility: "hidden",
            transform: "rotateY(180deg)"
          }}
        >
          {/* Subtle grid pattern card back */}
          <div className="absolute inset-0 bg-[linear-gradient(rgba(245,158,11,0.03)_1px,transparent_1px)] bg-[size:100%_12px] opacity-60 pointer-events-none" />
          <div className="absolute top-0 right-0 w-12 h-1 border-t-2 border-r-2 border-orange-500" />
          <div className="absolute bottom-0 left-0 w-12 h-1 border-b-2 border-l-2 border-orange-500" />

          {/* Header */}
          <div className="flex justify-between items-center z-10">
            <span className="font-mono text-[10px] tracking-widest text-orange-500 font-bold">
              SYS.DECRYPTED // CONFIDENTIAL
            </span>
            <span className="font-mono text-[9px] text-zinc-500">
              REV_1.09
            </span>
          </div>

          {/* Details body */}
          <div className="flex-grow flex flex-col justify-center py-4 z-10">
            <span className="font-mono text-[9px] uppercase tracking-wider text-zinc-400 dark:text-zinc-600 mb-1">
              DEFINITION_SUMMARY
            </span>
            <div className="font-sans text-sm text-zinc-800 dark:text-zinc-300 leading-relaxed overflow-y-auto max-h-[180px] pr-2 custom-scrollbar">
              {extraDetails || description || "No further decrypted details available on this sector node."}
            </div>
          </div>

          {/* Footer Action Button */}
          <div className="flex justify-between items-center border-t border-orange-500/20 pt-4 z-10">
            <div className="font-mono text-[9px] text-zinc-400 dark:text-zinc-500">
              PRESS_ESC // TO_CLOSE
            </div>
            {onActionClick ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onActionClick();
                }}
                className="font-cyber text-[10px] font-bold bg-orange-500 text-black px-4 py-1.5 clip-cyber-sm hover:bg-orange-400 active:scale-95 transition-all"
              >
                {actionText}
              </button>
            ) : (
              <div className="font-cyber text-[10px] font-bold text-orange-500/80">
                LOCKED_ACC
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

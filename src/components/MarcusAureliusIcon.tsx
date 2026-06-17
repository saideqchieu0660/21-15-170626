import React from 'react';

export function MarcusAureliusIcon({ className = "" }: { className?: string }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      viewBox="0 0 64 64" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="3" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <path d="M32 4 C24 4, 18 10, 18 18 C18 24, 22 29, 26 33 L26 40 C20 42, 14 46, 12 56 L52 56 C50 46, 44 42, 38 40 L38 33 C42 29, 46 24, 46 18 C46 10, 40 4, 32 4 Z" />
      <path d="M24 16 Q32 12, 40 16" />
      <path d="M22 24 Q32 28, 42 24" />
      <path d="M32 30 L32 38" />
    </svg>
  );
}

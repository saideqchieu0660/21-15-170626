import React, { useEffect, useRef } from 'react';
import { globalAnalyser } from '../lib/audio';
import { useTheme } from './ThemeProvider';

export const AudioVisualizer = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { isFixLagEnabled } = useTheme();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || isFixLagEnabled) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = globalAnalyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    let animationId: number;

    const draw = () => {
      animationId = requestAnimationFrame(draw);
      
      const width = canvas.width;
      const height = canvas.height;
      
      globalAnalyser.getByteFrequencyData(dataArray);
      
      // If no audio is playing, skip heavy drawing to maintain 60fps
      let hasSignal = false;
      for (let i = 0; i < bufferLength; i++) {
        if (dataArray[i] > 0) {
          hasSignal = true;
          break;
        }
      }

      ctx.clearRect(0, 0, width, height);
      if (!hasSignal) return;

      const barWidth = (width / bufferLength) * 2.5;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const value = dataArray[i];
        const percent = value / 255;
        const barHeight = height * percent;
        
        ctx.fillStyle = `rgba(217, 119, 6, ${percent + 0.1})`;
        ctx.fillRect(x, height - barHeight, barWidth, barHeight);

        x += barWidth + 1;
      }
    };

    draw();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [isFixLagEnabled]);

  if (isFixLagEnabled) return null;

  return (
    <canvas 
      ref={canvasRef} 
      width={40} 
      height={24} 
      className="rounded opacity-70"
      style={{ display: 'block', width: '40px', height: '24px' }}
    />
  );
};
